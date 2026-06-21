// SPDX-License-Identifier: PROPRIETARY
// Read-only local safety/selector validation for strict AuroraGate facade.
// No deployment, no RPC, no secrets, no transactions.

const fs = require("fs");
const path = require("path");

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected} got ${actual}`);
  console.log(`[OK] ${label}`);
}
function assertTrue(condition, label) { if (!condition) throw new Error(`${label}: expected truthy`); console.log(`[OK] ${label}`); }
function assertFalse(condition, label) { if (!!condition) throw new Error(`${label}: expected falsy`); console.log(`[OK] ${label}`); }

function run() {
  const srcPath = path.resolve(__dirname, "..", "contracts", "AuroraGate.sol");
  const src = fs.readFileSync(srcPath, "utf8");

  console.log("\n[1] Source exposure/surface minimization");
  assertTrue(src.startsWith("// SPDX-License-Identifier: PROPRIETARY"), "SPDX proprietary present");
  assertFalse(/0x56310d7e48d9249df358ab9daa6a2dad0e03e242/.test(src), "Genesis address absent from source");
  assertFalse(/contract EIP777G/.test(src), "no EIP777G contract name");
  assertFalse(/Empress|@Hope_ology|0xA0eb/.test(src), "no attribution/thank-you");
  assertFalse(/cut1|cut2|queue\b|auth\b|run\b|f20|f721|root\(/.test(src), "no pre-deployment legacy surface");
  assertTrue(src.includes("function defaultDropWallet()"), "defaultDropWallet read-through present");
  assertFalse(/root\(/.test(src), "root removed");
  assertFalse(/delegatecall/.test(src), "no delegatecall");

  console.log("\n[2] Public-surface minimization");
  assertTrue(src.includes("address private immutable _gn"), "Genesis address immutable declared private");
  assertTrue(src.includes("address private immutable _k3"), "K3 immutable declared private");
  assertFalse(/address public immutable/.test(src), "no public immutable addresses");

  console.log("\n[3] Authorized surface only");
  const requiredExternal = [
    "receive()",
    "function defaultDropWallet()",
    "function queueTransaction(",
    "function authorizeTransaction(",
    "function executeTransaction(",
    "function forwardERC20(",
    "function forwardERC721(",
  ];
  for (const fn of requiredExternal) {
    assertTrue(src.includes(fn), `authorized external present: ${fn}`);
  }
  assertFalse(/function .* external.*call/.test(src), "no arbitrary external call");

  console.log("\n[4] Authorized selectors");
  const selectors = {
    queueTransaction: "0x6d322d66",
    authorizeTransaction: "0x72b99a39",
    executeTransaction: "0x4a146868",
    forwardERC20: "0x0c8d69d2",
    forwardERC721: "0x559332a0",
    defaultDropWallet: "0x3ea239f1",
  };
  for (const [name, sel] of Object.entries(selectors)) {
    assertTrue(src.includes(sel), `selector exact for ${name}: ${sel}`);
  }

  console.log("\n[5] Reentrancy guard on mutable pass-throughs");
  assertTrue(src.includes("modifier nonReentrant()"), "nonReentrant modifier present");
  assertTrue(src.includes("bool private _lock"), "nonReentrant lock state present");
  assertTrue(src.includes("require(!_lock"), "nonReentrant require present");
  assertTrue((src.match(/nonReentrant\)/g) || []).length >= 5, "nonReentrant applied to 5 state-changing pass-throughs");

  console.log("\n[6] Storage/confinement invariant");
  assertFalse(/address\(this\)\.balance[^\n]*\n[^\n]*require/.test(src), "no ETH retention in wrapper");
  assertTrue(src.includes("_gn.call{value: msg.value}"), "ETH explicitly passed through to settlement");
  assertTrue(src.includes("require(ok"), "forwarding failures revert");

  console.log("\n[7] Filesystem/artifact containment");
  assertTrue(path.resolve(__dirname, "..", "contracts", "AuroraGate.sol") !== path.resolve(__dirname, "..", "private-artifacts"), "AuroraGate not PrivateArtifact path");
  const below = fs.readdirSync(path.resolve(__dirname, "..")).filter((f) => ["abi.json", "EIP777G.json", "bytecode.txt", "artifacts"].includes(f));
  assertEqual(below.length, 0, "no private artifact files in repo root");
  const gitignore = fs.readFileSync(path.resolve(__dirname, "..", ".gitignore"), "utf8");
  assertTrue(gitignore.includes("private-artifacts/"), ".gitignore blocks private-artifacts/");
  const vercelignore = fs.readFileSync(path.resolve(__dirname, "..", ".vercelignore"), "utf8");
  assertTrue(vercelignore.includes("private-artifacts/"), ".vercelignore blocks private-artifacts/");

  console.log("\n[DONE] strict facade read-only validation passed");
}

try {
  run();
} catch (err) {
  console.error("[FAIL] " + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
