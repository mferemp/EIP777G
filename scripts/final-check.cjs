#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGETS = ['api', 'live', 'package.json', 'vercel.json', '.env.example'];

const EXCLUDE_TEXT = new Set([
  'live/vendor/ethers.min.js',
  'live/vendor/qrcode.min.js',
  'live/vendor/tailwindcss.min.js',
  'live/artifacts/EIP777G.json',
]);

const ALLOWED_WALLET = '0xREPLACE_ME'.toLowerCase();

let failures = 0;
const fail = m => { failures++; console.error('FAIL:', m); };
const ok = m => console.log('ok:', m);
const exists = p => fs.existsSync(path.join(ROOT, p));

function norm(p) {
  return p.replace(/\\/g, '/');
}

function isObfuscated(text) {
  return /^(\(function\(_0x|const\s+_0x[0-9a-f]+\s*=\s*function)/.test(text.trimStart().slice(0, 80));
}

function walk(p) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return [];
  const st = fs.statSync(abs);
  if (st.isFile()) return [p];

  let out = [];
  for (const n of fs.readdirSync(abs)) {
    if (n === 'node_modules' || n === '.git') continue;
    out = out.concat(walk(path.join(p, n)));
  }
  return out;
}

const files = TARGETS.flatMap(walk).filter(f => !f.endsWith('.lock'));
const textFiles = files
  .filter(f => !EXCLUDE_TEXT.has(norm(f)))
  .map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);

const checks = [
  ['deployerPrivateKey', /deployerPrivateKey/],
  ['k1PrivateKey', /k1PrivateKey/],
  ['deprecated /api/deploy refs', /\/api\/deploy/],
  ['legacy bypass leftovers', /sg_bypass_hash|BYPASS_HASH|setAdminBypassHash|checkAdminBypass/],
  ['third-party browser egress', /api\.etherscan\.io|api\.coingecko\.com|api\.fontshare\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/],
  ['zero-address fallback', /0x0000000000000000000000000000000000000000/],
  ['committed RPC key', /alchemy\.com\/v2\//],
  ['operator private key value', /OPERATOR_SIGNING_KEY=0x[0-9a-fA-F]{64}/],
];

for (const [label, re] of checks) {
  const hits = textFiles.filter(([f, s]) => {
    if ((label === 'deployerPrivateKey' || label === 'k1PrivateKey') && isObfuscated(s)) return false;
    return re.test(s);
  }).map(([f]) => f);
  hits.length ? fail(label + ': ' + [...new Set(hits)].join(', ')) : ok('no ' + label);
}

for (const [f, s] of textFiles) {
  const hits = s.match(/0x[a-fA-F0-9]{40}/g) || [];
  for (const h of hits) {
    if (norm(f) === 'live/index.html' && h.toLowerCase() === ALLOWED_WALLET) continue;
    fail('hardcoded EVM address in ' + f + ': ' + h);
  }
}

for (const [p, label] of [
  ['api/relay.js', 'api/relay.js'],
  ['api/bypass-verify.js', 'api/bypass-verify.js'],
  ['live/artifacts/EIP777G.json', 'live/artifacts/EIP777G.json']
]) {
  exists(p) ? ok(label + ' present') : fail(label + ' missing');
}

for (const p of [
  'api/deploy',
  'live/api',
  'live/js/genesis-verification.js',
  'live/js/gate_test.js',
  'live/js/gate.js.bak'
]) {
  exists(p) ? fail(p + ' still exists') : ok('no ' + p);
}

try {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  Array.isArray(v.routes) ? fail('legacy vercel routes present') : ok('no legacy vercel routes');
  v.outputDirectory === 'live' ? ok('vercel outputDirectory live') : fail('vercel outputDirectory is not live');
} catch {
  fail('vercel.json invalid');
}

if (failures) {
  console.error('\n' + failures + ' final-check failure(s).');
  process.exit(1);
}

console.log('\nfinal-check passed');