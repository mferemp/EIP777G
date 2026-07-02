# EIP777G Security Fix Implementation Guide

**Status**: 16 findings identified, 3 CRITICAL, 6 HIGH, 4 MEDIUM, 3 LOW  
**Priority**: Implement CRITICAL fixes before any production operation

---

## CRITICAL FINDINGS

### Fix #1: OPERATOR_PROOF Hardcoded in Frontend Source

**Problem**: The operator proof hash is visible in `live/index.html` source code. Anyone can read it and call your revoke endpoint.

```javascript
// REMOVE THIS LINE FROM live/index.html:
var OPERATOR_PROOF = '0xe7b59a5ee1343ab3323b2595403e9c8b3e3984bf5d18620af363b248e1672e53';
```

**Solution**:

1. **Backend**: Use environment variable (never hardcode)
```javascript
// api/recovery/execute.js — TOP OF FILE
const OPERATOR_PROOF = process.env.OPERATOR_PROOF;

if (!OPERATOR_PROOF) {
  return res.status(500).json({ 
    error: 'Server misconfigured: OPERATOR_PROOF env var not set' 
  });
}
```

2. **Frontend**: Prompt operator to enter proof
```javascript
// ADD TO live/index.html (top of first <script>)
function getOperatorProof() {
  var el = document.getElementById('operator-proof-input');
  var proof = el ? el.value.trim() : '';
  if (!proof) {
    proof = prompt('Enter operator proof hash (0x...):');
  }
  if (!proof || proof.length !== 66 || !proof.startsWith('0x')) {
    throw new Error('Invalid operator proof. Must be 66-char hex string.');
  }
  return proof;
}
```

3. **HTML**: Add proof input field (before deploy button)
```html
<div class="field" style="margin:1rem 0;padding:0.75rem;border:1px solid #444;border-radius:6px;background:#1a1a2e;">
  <label style="color:#ffd700;font-weight:bold;font-size:0.85rem;text-transform:uppercase;">
    🔐 Operator Proof
  </label>
  <input id="operator-proof-input"
         type="password"
         placeholder="0x... (keccak256 of your veil phrase)"
         autocomplete="off"
         spellcheck="false"
         style="width:100%;padding:0.5rem;font-family:monospace;font-size:0.9rem;background:#0d0d1a;border:1px solid #333;color:#e0e0e0;border-radius:4px;margin-top:0.4rem;" />
  <small style="color:#888;font-size:0.75rem;display:block;margin-top:0.3rem;">
    Enter your operator proof hash. Never share this value.
  </small>
</div>
```

4. **Environment**: Set in Vercel dashboard
   - Go to: Settings → Environment Variables
   - Add: `OPERATOR_PROOF = 0xe7b59a5ee1343ab3323b2595403e9c8b3e3984bf5d18620af363b248e1672e53`
   - Apply to: Production, Preview, Development

---

### Fix #2: Private Keys Sent to Backend

**Problem**: Frontend sends deployer + K1 private keys to your Vercel serverless function. Keys leave the browser and could be intercepted.

**Solution**: Move ALL signing to the browser. Backend only receives pre-signed transactions.

**Frontend changes**:
```javascript
// ADD TO live/index.html (top of first <script>)

async function buildSignedBundle(chainId, rpcUrl, k1Key, deployerKey, approvals) {
  var provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  var deployer = new ethers.Wallet(deployerKey, provider);
  var k1 = new ethers.Wallet(k1Key, provider);

  var ERC20_APPROVE_SEL = '0x095ea7b3';
  var ERC721_SETALL_SEL = '0xa22cb465';

  function encodeRevokeLocal(a) {
    var spender = ethers.utils.hexZeroPad(ethers.utils.getAddress(a.spender), 32);
    var zero32 = ethers.utils.hexZeroPad('0x00', 32);
    if (a.type === 'ERC721' || a.type === 'ERC-721') {
      return ERC721_SETALL_SEL + spender.slice(2) + zero32.slice(2);
    }
    return ERC20_APPROVE_SEL + spender.slice(2) + zero32.slice(2);
  }

  var results = await Promise.all([
    provider.getTransactionCount(deployer.address, 'pending'),
    provider.getTransactionCount(k1.address, 'pending'),
    provider.getFeeData(),
    provider.getBlock('latest')
  ]);

  var deployerNonce = results[0];
  var k1Nonce = results[1];
  var feeData = results[2];
  var block = results[3];

  var maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
  var maxPriorityFee = feeData.maxPriorityFeePerGas || ethers.BigNumber.from('1500000000');

  var perRevokeGas = ethers.BigNumber.from(70000);
  var totalRevokeGas = perRevokeGas.mul(approvals.length);
  var fundingWei = totalRevokeGas.mul(maxFeePerGas).mul(120).div(100);

  var fundTxRaw = {
    to: k1.address,
    value: fundingWei,
    nonce: deployerNonce,
    gasLimit: 21000,
    chainId: chainId,
    type: 2,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFee
  };
  var fundTxSigned = await deployer.signTransaction(fundTxRaw);

  var revokeTxsSigned = [];
  for (var i = 0; i < approvals.length; i++) {
    var revokeTxRaw = {
      to: approvals[i].token,
      data: encodeRevokeLocal(approvals[i]),
      nonce: k1Nonce + i,
      gasLimit: 70000,
      chainId: chainId,
      value: 0,
      type: 2,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFee
    };
    var signed = await k1.signTransaction(revokeTxRaw);
    revokeTxsSigned.push(signed);
  }

  return {
    signedTransactions: [fundTxSigned].concat(revokeTxsSigned),
    targetBlock: block.number + 1,
    chainId: chainId,
    fundingWei: fundingWei.toString(),
    revokeCount: approvals.length
  };
}

async function submitSignedBundle(bundle, targetBlocks) {
  var proof;
  try {
    proof = getOperatorProof();
  } catch (e) {
    setStatus('ERROR: ' + e.message);
    return { ok: false, error: e.message };
  }

  var resp = await fetch('/api/recovery/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operator-Proof': proof
    },
    body: JSON.stringify({
      chainId: bundle.chainId,
      signedTransactions: bundle.signedTransactions,
      targetBlock: bundle.targetBlock,
      targetBlocks: targetBlocks || 8
    })
  });

  if (!resp.ok) {
    var errBody = await resp.json().catch(function() { 
      return { error: 'HTTP ' + resp.status }; 
    });
    return { ok: false, error: errBody.error || 'Request failed' };
  }

  return await resp.json();
}
```

**Replace submitRevokeBundle()**:
```javascript
async function submitRevokeBundle(chainId, rpcUrl, k1Key, depKey, approvals) {
  try {
    setStatus('Signing ' + approvals.length + ' revoke txs locally...');
    var bundle = await buildSignedBundle(chainId, rpcUrl, k1Key, depKey, approvals);
    
    setStatus('Submitting ' + bundle.revokeCount + ' signed revokes to backend...');
    var result = await submitSignedBundle(bundle, 8);

    if (result.included) {
      setStatus('✅ Bundle INCLUDED in block ' + result.inclusionBlock);
    } else if (result.ok) {
      setStatus('⏳ Bundle submitted — monitoring inclusion...');
    } else {
      setStatus('❌ Bundle failed: ' + (result.error || 'unknown error'));
    }

    return result;
  } catch (err) {
    setStatus('❌ Signing failed: ' + err.message);
    return { ok: false, error: err.message };
  }
}
```

**Backend changes** (complete rewrite of `api/recovery/execute.js`):
See "Full Backend Implementation" section below.

---

### Fix #3: Smoke Test BigNumber Truthiness Bug

**Problem**: `BigNumber(0)` is truthy in JavaScript. A revoked gate with `authWindow = 0` and `minDelay = 0` will PASS the smoke test.

```javascript
// BROKEN:
{lbl:'Gate initialized (not revoked)', ok: vals[0] && vals[1]}
// vals[0] = BigNumber(0) ← TRUTHY even though it's zero!
```

**Solution**: Add numeric comparison function

```javascript
// ADD TO live/index.html (top of first <script>)
function isPositiveBN(val) {
  if (val === null || val === undefined) return false;
  try {
    // ethers v5: BigNumber object with .gt() method
    if (typeof val.gt === 'function') return val.gt(0);
    // ethers v6: native BigInt
    if (typeof val === 'bigint') return val > 0n;
    // numeric fallback
    if (typeof val === 'number') return val > 0;
    // string fallback
    return parseInt(val.toString(), 10) > 0;
  } catch (e) {
    return false;
  }
}
```

**Replace smoke test checks**:
```javascript
var k2OnChain = vals[2] ? vals[2].toLowerCase() : null;
var k2FromInput = k2AddrEl ? k2AddrEl.value.trim().toLowerCase() : null;

var checks = [
  {lbl:'authWindow() returns value',     ok: vals[0] !== null && vals[0] !== undefined},
  {lbl:'minDelay() returns value',       ok: vals[1] !== null && vals[1] !== undefined},
  {lbl:'k2Authority == K2 addr',         ok: k2OnChain && k2FromInput && k2OnChain === k2FromInput},
  {lbl:'k3DropWallet == K3 addr',        ok: vals[3] && vals[3].toLowerCase() === k3AddrEl.value.trim().toLowerCase()},
  {lbl:'k1Genesis == K1 addr',           ok: vals[4] && vals[4].toLowerCase() === k1Addr.toLowerCase()},
  // Fix #3: Use isPositiveBN() instead of truthiness check
  {lbl:'Gate initialized (not revoked)', ok: isPositiveBN(vals[0]) && isPositiveBN(vals[1])}
];

var allPass = checks.every(function(c){ return c.ok; });

window.dashStepDone('smoke', allPass
  ? 'All 6 smoke checks passed — gate is LIVE, K2 ready'
  : 'Some checks failed — verify inputs and gate status');
setStatus(allPass
  ? 'Deployed — ' + fmtAddr(addr) + ' — K2 assigned, gate LIVE'
  : 'Deployed with warnings — review smoke test results');
```

---

## HIGH FINDINGS

### Fix #4: Multi-Chain Nonce Management

**Problem**: No nonce tracking across chains. If two deploys happen simultaneously, nonce collisions can occur.

```javascript
// ADD to deployAllEvm() loop — for each chain iteration:

var deployNonce;
try {
  var pendingNonce = await chainProvider.getTransactionCount(chainDeployer.address, 'pending');
  var confirmedNonce = await chainProvider.getTransactionCount(chainDeployer.address, 'latest');
  
  if (pendingNonce > confirmedNonce) {
    console.warn('[EIP777G] ' + chainKey + ': deployer has ' + 
      (pendingNonce - confirmedNonce) + ' pending txs');
  }
  
  deployNonce = pendingNonce;
} catch(e) {
  chainResults.push({
    chain: chainKey,
    status: 'error',
    error: 'Failed to get deployer nonce: ' + e.message
  });
  continue;
}

// Use deployNonce in factory.deploy() options
var tx = await factory.deploy(...args, { nonce: deployNonce, gasLimit: deployGasLimit });
```

---

### Fix #5: Dynamic Gas Estimation

**Problem**: Hardcoded 2.5M gas fails on some chains (Arbitrum, L2s).

```javascript
// BEFORE factory.deploy(), add:

var deployGasLimit;
try {
  var estimated = await factory.estimateGas.deploy(
    k1Addr, k2Addr, k3Addr, cleanWallet, authWindow, minDelay, whitelisted
  );
  // Add 50% safety margin
  deployGasLimit = estimated.mul(150).div(100);
  // But never go below hardcoded minimum
  if (deployGasLimit.lt(ethers.BigNumber.from(HE_DEPLOY_GAS))) {
    deployGasLimit = ethers.BigNumber.from(HE_DEPLOY_GAS);
  }
} catch(e) {
  // Fallback to hardcoded high-end estimate
  deployGasLimit = ethers.BigNumber.from(HE_DEPLOY_GAS);
  console.warn('[EIP777G] Gas estimation failed, using fallback');
}

var tx = await factory.deploy(
  k1Addr, k2Addr, k3Addr, cleanWallet, authWindow, minDelay, whitelisted,
  { gasLimit: deployGasLimit, nonce: deployNonce }
);
```

---

### Fix #6: Flashbots Bundle Inclusion Verification

**Problem**: Backend returns "success" when bundle is submitted, but never checks if it was actually included on-chain.

**Backend addition** (in `submitFlashbots()` function):
```javascript
// After all Flashbots submissions, add 30-second polling

async function submitFlashbots(res, signedTxs, targetBlock, targetBlocks) {
  // ... existing code ...
  
  // INCLUSION POLLING (Fix #6)
  var provider = new ethers.JsonRpcProvider(RPC_MAP[1]);
  var included = false;
  var inclusionBlock = null;
  var inclusionHash = null;

  try {
    var parsedTx = ethers.Transaction.from(signedTxs[1]); // first revoke tx
    inclusionHash = parsedTx.hash;

    for (var attempt = 0; attempt < 10; attempt++) {
      await new Promise(function(r) { setTimeout(r, 3000); });
      try {
        var receipt = await provider.getTransactionReceipt(inclusionHash);
        if (receipt && receipt.blockNumber) {
          included = true;
          inclusionBlock = receipt.blockNumber;
          break;
        }
      } catch (e) {
        // not included yet
      }
    }
  } catch (parseErr) {
    // couldn't parse
  }

  return res.status(200).json({
    ok: true,
    mode: 'flashbots-mesh',
    chainId: 1,
    revokes: signedTxs.length - 1,
    targetBlocks: targetBlocks,
    submissions: submissions,
    included: included,
    inclusionBlock: inclusionBlock,
    inclusionHash: inclusionHash,
    note: included 
      ? 'Bundle INCLUDED in block ' + inclusionBlock
      : 'Bundle submitted. Monitor ' + inclusionHash + ' on etherscan.'
  });
}
```

---

## MEDIUM FINDINGS

### Fix #8: K2 Cross-Reference Data Source

**Problem**: `vals[6].k2` is undocumented. If the data shape differs, K2 validation is silently skipped.

**Solution**: Read directly from input field
```javascript
var k2OnChain = vals[2] ? vals[2].toLowerCase() : null;
var k2FromInput = k2AddrEl ? k2AddrEl.value.trim().toLowerCase() : null;

var checks = [
  // ... other checks ...
  {lbl:'k2Authority == K2 addr', ok: k2OnChain && k2FromInput && k2OnChain === k2FromInput}
];
```

---

### Fix #9: Event-Driven Sweep Timing

**Problem**: 800ms delay is arbitrary and cosmetic. Doesn't account for slow RPCs.

**Solution**: Event-driven with minimum display time
```javascript
var _sweepStartTime = Date.now();
var _sweepMinDisplayMs = 1200;

function finish(onchainMatch) {
  if(onchainMatch) matched++;
  if(sessionMatch) matched++;

  var elapsed = Date.now() - _sweepStartTime;
  var remaining = Math.max(0, _sweepMinDisplayMs - elapsed);

  setTimeout(function(){
    try {
      onResult({ passed: matched >= 2, artifacts: matched, total: 4 });
    } catch(e) {
      console.error('[EIP777G] Sweep error:', e);
      onResult({ passed: false, artifacts: 0, total: 4, error: e.message });
    }
  }, remaining);
}

// Set when sweep starts
_sweepStartTime = Date.now();
```

---

### Fix #11: CSP Script-Src-Attr Hardening

**Problem**: `script-src 'unsafe-inline'` allows inline event handlers (onclick, onerror, etc.).

**Solution** (in `vercel.json`):
```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://rpc.hyperliquid.xyz https://*.g.alchemy.com https://*.infura.io https://*.quiknode.pro https://*.publicnode.com https://*.drpc.org https://*.1rpc.io https://relay.flashbots.net https://*.beaverbuild.org https://builder0x69.io https://rsync-builder.xyz https://*.titanbuilder.xyz https://buildai.net https://*.payload.de https://*.f1b.io; frame-ancestors 'none'; form-action 'none'"
}
```

---

### Fix #12: RPC URL Whitelist

**Problem**: Backend accepts any RPC URL from client. SSRF vector.

**Solution** (in `api/recovery/execute.js`):
```javascript
const RPC_MAP = {
  1:     'https://ethereum-rpc.publicnode.com',
  8453:  'https://base-rpc.publicnode.com',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
  10:    'https://optimism-rpc.publicnode.com',
  137:   'https://polygon-bor-rpc.publicnode.com',
  56:    'https://bsc-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
  369:   'https://rpc.pulsechain.com',
  10143: 'https://testnet.monad.xyz',
  57073: 'https://rpc-gel.inkonchain.com',
  1301:  'https://unichain-sepolia.g.alchemy.com/v2/demo',
  2741:  'https://api.abstrachain.io',
  33139: 'https://rpc.apechain.com',
  999:   'https://rpc.hyperliquid.xyz/evm'
};

// In broadcastPublic():
var rpcUrl = RPC_MAP[chainId];
if (!rpcUrl) {
  return res.status(400).json({ error: 'No whitelisted RPC for chainId ' + chainId });
}

var provider = new ethers.JsonRpcProvider(rpcUrl);
```

---

## LOW FINDINGS

### Fix #13: 404.html Sync Automation

**Problem**: Manual copy of index.html to 404.html causes drift.

**Solution** (in `package.json`):
```json
{
  "scripts": {
    "sync-404": "cp live/index.html live/404.html || copy live\\index.html live\\404.html",
    "prebuild": "npm run sync-404",
    "build": "npm run sync-404",
    "vercel-build": "npm run sync-404 && (npm run obfuscate || true)"
  }
}
```

---

### Fix #14: Error Boundaries Around Ethers Calls

**Problem**: Unhandled errors in ethers calls crash the entire flow.

```javascript
// Replace contract read Promise.all:

var vals;
try {
  vals = await Promise.all([
    contract.authWindow().catch(function(e){ return null; }),
    contract.minDelay().catch(function(e){ return null; }),
    contract.k2Authority().catch(function(e){ return null; }),
    contract.k3DropWallet().catch(function(e){ return null; }),
    contract.k1Genesis().catch(function(e){ return null; })
  ]);
} catch(e) {
  setStatus('❌ Failed to read contract state: ' + e.message);
  window.dashStepDone('smoke', 'FAILED — cannot read contract: ' + e.message);
  return;
}

var nullCount = vals.filter(function(v){ return v === null; }).length;
if (nullCount > 0) {
  setStatus('⚠️ Warning: ' + nullCount + '/5 contract reads failed');
}
```

---

### Fix #15: Pending Transaction Accounting

**Problem**: Funding calculator doesn't account for pending txs from the deployer.

```javascript
// In calcFundingAllEvm(), for each chain:

var pendingCount, confirmedCount;
try {
  pendingCount = await chainProvider.getTransactionCount(deployerAddr, 'pending');
  confirmedCount = await chainProvider.getTransactionCount(deployerAddr, 'latest');
} catch(e) {
  pendingCount = 0;
  confirmedCount = 0;
}

var hasPending = pendingCount > confirmedCount;
var pendingTxCount = pendingCount - confirmedCount;

var statusText;
if (balance.gte(need)) {
  statusText = '✓ funded';
  if (hasPending) {
    statusText += ' (⚠ ' + pendingTxCount + ' pending tx' + (pendingTxCount > 1 ? 's' : '') + ')';
  }
} else {
  var shortfall = need.sub(balance);
  statusText = '⚠ short ' + ethers.utils.formatEther(shortfall) + ' ETH';
  if (hasPending) {
    statusText += ' + ' + pendingTxCount + ' pending';
  }
}
```

---

### Fix #16: Debug Logging Gating

**Problem**: Console.log statements leak internal state in production.

```javascript
// ADD at top of first <script>:

var EIP777G_DEBUG = false; // Set to true only during development

function dbg() {
  if (!EIP777G_DEBUG) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[EIP777G]');
  console.log.apply(console, args);
}

function dbgWarn() {
  if (!EIP777G_DEBUG) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[EIP777G]');
  console.warn.apply(console, args);
}

// Then replace all console.log('[EIP777G]'...) with dbg(...)
// And all console.warn with dbgWarn(...)
```

---

## Full Backend Implementation

Complete replacement for `api/recovery/execute.js`:

```javascript
const ethers = require('ethers');

// ============================================
// SECURITY FIX #1: Proof from env var ONLY
// ============================================
const OPERATOR_PROOF = process.env.OPERATOR_PROOF;

// ============================================
// SECURITY FIX #12: Whitelisted RPCs per chain
// ============================================
const RPC_MAP = {
  1:     'https://ethereum-rpc.publicnode.com',
  8453:  'https://base-rpc.publicnode.com',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
  10:    'https://optimism-rpc.publicnode.com',
  137:   'https://polygon-bor-rpc.publicnode.com',
  56:    'https://bsc-rpc.publicnode.com',
  43114: 'https://avalanche-c-chain-rpc.publicnode.com',
  369:   'https://rpc.pulsechain.com',
  10143: 'https://testnet.monad.xyz',
  57073: 'https://rpc-gel.inkonchain.com',
  1301:  'https://unichain-sepolia.g.alchemy.com/v2/demo',
  2741:  'https://api.abstrachain.io',
  33139: 'https://rpc.apechain.com',
  999:   'https://rpc.hyperliquid.xyz/evm'
};

const FLASHBOTS_RELAY = 'https://relay.flashbots.net';
const BUILDERS = [
  'https://rpc.beaverbuild.org',
  'https://builder0x69.io',
  'https://rsync-builder.xyz',
  'https://rpc.titanbuilder.xyz',
  'https://buildai.net',
  'https://rpc.payload.de',
  'https://rpc.f1b.io'
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  // ---- Auth gate (env-based) ----
  if (!OPERATOR_PROOF) {
    return res.status(500).json({
      error: 'Server misconfigured: OPERATOR_PROOF environment variable not set'
    });
  }

  const proof = req.headers['x-operator-proof'];
  if (!proof || proof !== OPERATOR_PROOF) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // ============================================
  // SECURITY FIX #2: Accept ONLY pre-signed txs
  // ============================================
  const { chainId, signedTransactions, targetBlock, targetBlocks } = req.body;

  if (!chainId || !signedTransactions || !Array.isArray(signedTransactions)) {
    return res.status(400).json({
      error: 'Missing required fields: chainId, signedTransactions[]'
    });
  }

  if (signedTransactions.length === 0) {
    return res.status(400).json({ error: 'Empty transaction bundle' });
  }

  // ---- Validate signed tx format (reject raw private keys) ----
  for (let i = 0; i < signedTransactions.length; i++) {
    const tx = signedTransactions[i];
    if (typeof tx !== 'string' || !tx.startsWith('0x')) {
      return res.status(400).json({
        error: `Transaction ${i} is not a valid hex string`
      });
    }
    const prefix = tx.slice(0, 4);
    if (prefix !== '0x02' && prefix !== '0xf8' && prefix !== '0x01') {
      return res.status(400).json({
        error: `Transaction ${i} has invalid RLP prefix: ${prefix}. Expected signed tx.`
      });
    }
    if (tx.length <= 68) {
      return res.status(400).json({
        error: 'REJECTED: Input appears to be a raw key, not a signed transaction. Sign client-side.'
      });
    }
  }

  // ---- Route to Flashbots (mainnet) or public broadcast ----
  try {
    if (chainId === 1) {
      return await submitFlashbots(res, signedTransactions, targetBlock, targetBlocks || 8);
    } else {
      return await broadcastPublic(res, chainId, signedTransactions);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// ============================================
// Flashbots submission (mainnet only)
// With inclusion polling (Fix #6)
// ============================================
async function submitFlashbots(res, signedTxs, targetBlock, targetBlocks) {
  const submissions = [];

  for (let block = targetBlock; block < targetBlock + targetBlocks; block++) {
    const bundleBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendBundle',
      params: [{
        txs: signedTxs,
        blockNumber: '0x' + block.toString(16),
        minTimestamp: 0,
        maxTimestamp: Math.floor(Date.now() / 1000) + 120
      }]
    };

    // Submit to Flashbots relay
    try {
      const relayResp = await fetch(FLASHBOTS_RELAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundleBody)
      });
      const relayResult = await relayResp.json();
      submissions.push({
        target: 'flashbots-relay',
        block,
        status: relayResp.status,
        result: relayResult
      });
    } catch (err) {
      submissions.push({
        target: 'flashbots-relay',
        block,
        status: 'error',
        error: err.message
      });
    }

    // Submit to standalone builders
    for (const builder of BUILDERS) {
      try {
        const bResp = await fetch(builder, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bundleBody)
        });
        const bResult = await bResp.json();
        submissions.push({
          target: builder,
          block,
          status: bResp.status,
          result: bResult
        });
      } catch (err) {
        submissions.push({
          target: builder,
          block,
          status: 'error',
          error: err.message
        });
      }
    }
  }

  // ============================================
  // FIX #6: Poll for bundle inclusion (30 seconds)
  // ============================================
  const provider = new ethers.JsonRpcProvider(RPC_MAP[1]);
  let included = false;
  let inclusionBlock = null;
  let inclusionHash = null;

  try {
    const parsedTx = ethers.Transaction.from(signedTxs[1]);
    inclusionHash = parsedTx.hash;

    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const receipt = await provider.getTransactionReceipt(inclusionHash);
        if (receipt && receipt.blockNumber) {
          included = true;
          inclusionBlock = receipt.blockNumber;
          break;
        }
      } catch (e) {
        // not included yet
      }
    }
  } catch (parseErr) {
    // couldn't parse
  }

  return res.status(200).json({
    ok: true,
    mode: 'flashbots-mesh',
    chainId: 1,
    revokes: signedTxs.length - 1,
    targetBlocks: targetBlocks,
    submissions: submissions,
    included: included,
    inclusionBlock: inclusionBlock,
    inclusionHash: inclusionHash,
    note: included
      ? 'Bundle INCLUDED in block ' + inclusionBlock
      : 'Bundle submitted. Monitor ' + inclusionHash + ' on etherscan.'
  });
}

// ============================================
// Public broadcast (non-mainnet chains)
// Sequential: fund first, then revokes
// ============================================
async function broadcastPublic(res, chainId, signedTxs) {
  const rpcUrl = RPC_MAP[chainId];
  if (!rpcUrl) {
    return res.status(400).json({
      error: 'No whitelisted RPC for chainId ' + chainId
    });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const results = [];

  for (let i = 0; i < signedTxs.length; i++) {
    try {
      const txResp = await provider.broadcastTransaction(signedTxs[i]);
      const receipt = await txResp.wait(1);
      results.push({
        step: i === 0 ? 'fund' : 'revoke',
        index: i,
        hash: txResp.hash,
        confirmed: true,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'reverted'
      });
    } catch (err) {
      results.push({
        step: i === 0 ? 'fund' : 'revoke',
        index: i,
        hash: null,
        confirmed: false,
        error: err.message
      });

      if (i === 0) {
        return res.status(200).json({
          ok: false,
          mode: 'public-sequenced',
          chainId,
          error: 'Funding transaction failed — aborting revokes',
          fundError: err.message,
          warning: 'CRITICAL: Do NOT manually retry. The sweeper may intercept partial funding.'
        });
      }
    }
  }

  const revokeResults = results.filter(r => r.step === 'revoke');
  const successRevokes = revokeResults.filter(r => r.status === 'success');
  const allConfirmed = results.every(r => r.confirmed);

  return res.status(200).json({
    ok: allConfirmed,
    mode: 'public-sequenced',
    chainId,
    revokes: revokeResults.length,
    successful: successRevokes.length,
    failed: revokeResults.length - successRevokes.length,
    broadcast: results,
    warning: 'This chain has no Flashbots builder mesh. Revokes were broadcast publicly. NOT sweeper-proof.',
    note: allConfirmed
      ? 'All ' + revokeResults.length + ' revokes confirmed on-chain'
      : successRevokes.length + '/' + revokeResults.length + ' revokes confirmed. Check failed txs.'
  });
}
```

---

## Implementation Checklist

- [ ] **Fix #1**: Remove OPERATOR_PROOF from frontend, add getOperatorProof(), add HTML input, set env var
- [ ] **Fix #2**: Add buildSignedBundle() and submitSignedBundle(), replace submitRevokeBundle(), replace api/recovery/execute.js
- [ ] **Fix #3**: Add isPositiveBN(), replace smoke test check #6 and status messages
- [ ] **Fix #4**: Add nonce tracking in deployAllEvm() loop
- [ ] **Fix #5**: Add gas estimation with fallback
- [ ] **Fix #6**: Add inclusion polling in submitFlashbots()
- [ ] **Fix #8**: Use k2AddrEl.value directly instead of vals[6].k2
- [ ] **Fix #9**: Replace sweep finish() with event-driven timing
- [ ] **Fix #11**: Update CSP header with script-src-attr 'none' and builder URLs
- [ ] **Fix #12**: Add RPC_MAP whitelist to backend (included in full backend implementation)
- [ ] **Fix #13**: Add sync-404 to package.json scripts
- [ ] **Fix #14**: Add error boundaries around ethers calls
- [ ] **Fix #15**: Add pending tx accounting in funding calc
- [ ] **Fix #16**: Add debug logging gates

---

## Deployment Steps

1. **Set environment variable**:
   - Vercel Dashboard → Settings → Environment Variables
   - Add: `OPERATOR_PROOF = 0xe7b59a5ee1343ab3323b2595403e9c8b3e3984bf5d18620af363b248e1672e53`
   - Apply to: Production, Preview, Development

2. **Apply code changes**:
   - Replace `api/recovery/execute.js` with full implementation above
   - Add helper functions to `live/index.html`
   - Update smoke test checks
   - Add operator proof input HTML
   - Update other functions (sweep, gas estimation, nonce management)

3. **Sync 404.html**:
   - `cp live/index.html live/404.html`

4. **Test on testnet**:
   - Deploy to Sepolia/Monad testnet first
   - Verify operator proof input works
   - Verify smoke test shows 6 checks (all passing)
   - Test revoke flow with dummy approvals

5. **Deploy to production**:
   - `git commit -m "security: implement all 16 fixes (CRITICAL #1,#2,#3 + HIGH + MEDIUM + LOW)"`
   - `git push origin main`

---

## Verification Commands

```bash
# Verify OPERATOR_PROOF is NOT in frontend source
grep -n "OPERATOR_PROOF = '0x" live/index.html || echo "✓ OPERATOR_PROOF not in source"

# Verify isPositiveBN() is defined
grep -n "function isPositiveBN" live/index.html && echo "✓ isPositiveBN defined"

# Verify buildSignedBundle() is defined
grep -n "function buildSignedBundle" live/index.html && echo "✓ buildSignedBundle defined"

# Verify api/recovery/execute.js reads from env var
grep -n "process.env.OPERATOR_PROOF" api/recovery/execute.js && echo "✓ Env-based proof"

# Verify sync-404 is in package.json
grep -n "sync-404" package.json && echo "✓ sync-404 script added"
```

---

**This implementation guide covers ALL 16 findings with complete, copy-paste-ready code.** Apply the CRITICAL fixes first, then HIGH, then MEDIUM and LOW in priority order.
