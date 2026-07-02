# EIP777G SecureGate – Project Handoff

**Project**: SecureGate 777G Genesis Gate Dashboard  
**Spec**: EIP-777G (Composable Token Approval Authority)  
**Live**: https://eip777g.vercel.app  
**Repository**: mferemp/EIP777G (Vercel Team: team_Aa2CeBhLJkl925OvQEw8btvT)

---

## Executive Summary

EIP777G is a **three-key composable token authority system** deployed across 15+ EVM chains and Hyperliquid Core/EVM. It implements a decentralized approval gate enforced by the contract itself — no external oracles or trusted parties — using a three-key signing ceremony (K1 compromised recovery, K2 instant veto, K3 gate authority).

The SecureGate dashboard is the **operator interface** for:
1. **Verification**: operator unlocks the gate via an ephemeral veil passphrase + Veil Proof (operator-specific signature).
2. **Multi-chain revoke**: K1's compromised token approvals are revoked atomically via Flashbots builder mesh (mainnet) or best-effort broadcast (other chains), preventing sweeper bot interception.
3. **Multi-chain deploy**: EIP777G contract deployed to all EVM chains with verified K1/K2/K3 authority.
4. **2FA deployment**: K1/K2/K3 addresses supplied separately; contract locks in once K1 is fully revoked.

**Problem solved**: The old client-side `approve(0)` broadcast directly from K1 never landed because K1 is compromised — a sweeper bot instantly drains any gas sent to it. The **Flashbots atomic bundle** (K1 only signs, deployer funds) solves this: the sweeper never sees the funding tx arrive, so it cannot front-run or drain the revoke.

---

## Architecture Overview

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Verification Gate (ephemeral, operator-only)       │
│ - Veil Passphrase + Operator Proof (EIP-191 signature)      │
│ - Locked landing page; unlocks to dashboard on success      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Dashboard (multi-chain orchestration)              │
│ - SCAN APPROVALS across 13 EVM + HL-EVM + HL-Core chains   │
│ - REVOKE ALL atomically per chain (Flashbots or public)     │
│ - CALCULATE FUNDING per-chain (high-end estimates, safety)  │
│ - AUTHORIZE & DEPLOY EIP777G contract per chain             │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Contract Authority (immutable on-chain)            │
│ - EIP777G contract enforces K1/K2/K3 multi-key gate         │
│ - All approvals routed through contract; K1 can't revoke    │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

**K1** (Compromised Wallet)
- The user's original wallet, assumed fully compromised (private key leaked, sweeper bot active).
- **Cannot** be used to broadcast txs directly — the sweeper drains any gas.
- Can **only sign** data; the deployer funds and broadcasts txs atomically.

**K2** (Instant Veto)
- Holds token veto power; if K2 signs a revoke, the contract immediately **blocks all K1 approvals** for that token.
- Stored offline or in a hardware wallet; used only for emergency response.

**K3** (Gate Authority)
- Holds the authority to lock/unlock the EIP777G gate and enforce rotation.
- Can be the same as K2 or a separate key depending on the operator's security model.

**Flashbots Atomic Bundle** (Mainnet only)
- One atomic transaction sequence: `[deployer funds K1] + [K1 approves(0) / setApprovalForAll(false)]`.
- Submitted **privately** to the builder mesh, so the sweeper bot cannot insert a drain tx between funding and revoke.
- Re-submitted for multiple consecutive blocks to maximize inclusion odds.

**Operator Veil Phrase**
- Session-specific passphrase (e.g., `"Hope_ology"`) used to compute an operator proof.
- Operator proof = `keccak256(phrase + ":sg:v1")`, signed by the operator's wallet.
- Sent as `X-Operator-Proof` header; gated backend verifies it matches before processing revoke bundles.

**EVM Bundle** (Dashboard)
- Deploy action that targets all 13 EVM chains in one UI flow: Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche, Plasma, Monad, Ink, Unichain, Abstract, ApeChain.
- Shows per-chain funding requirements and deployment status.
- HL EVM and HL Core remain standalone (non-EVM deployment method).

---

## File Structure

```
project/
├── live/
│   ├── index.html (2,894 lines – main dashboard + JS)
│   ├── 404.html (mirrors index.html for fallback)
│   ├── artifacts/
│   │   └── EIP777G.json (contract ABI + bytecode)
│   ├── vendor/
│   │   ├── ethers.min.js (bundled ethers.js v6)
│   │   ├── qrcode.min.js (QR code gen)
│   │   └── tailwindcss.min.js (bundled CSS)
│   └── js/
│       └── [obfuscated app versions via npm run obfuscate]
│
├── api/
│   ├── recovery/
│   │   └── execute.js (Flashbots atomic revoke bundle handler)
│   ├── relay.js (legacy chain relay, optional)
│   ├── bypass-verify.js (dev gate bypass, optional)
│   └── generate-user-key.js (random wallet generator, optional)
│
├── scripts/
│   ├── deploy-*.js (chain-specific deploy scripts)
│   ├── revoke-*.js (chain-specific revoke scripts)
│   ├── verify-*.js (contract verification / gate testing)
│   └── lib/
│       ├── builder-mesh.js (Flashbots builder list)
│       ├── revoke-encode.js (calldata encoder)
│       └── severance-gate.js (contract deployment helper)
│
├── server.js (Express server, static + API routing)
├── vercel.json (Vercel config: headers, redirects, function maxDuration)
├── package.json (dependencies: ethers, express, cors, etc.)
└── HANDOFF.md (this file)
```

---

## Core Specification

### Dashboard Sections (live/index.html)

#### 1. Verification Gate (Landing Page)
- **User inputs**: veil passphrase (e.g., "Hope_ology"), wallet address, signature.
- **Backend check**: `POST /api/bypass-verify` or client-side sig verification.
- **On success**: reveals the dashboard main sections.
- **On failure**: stays locked.

```html
<section id="verification-section">
  <input id="veil-input" placeholder="Veil passphrase" />
  <input id="wallet-addr" placeholder="Wallet address" />
  <button onclick="verifyGate()">UNLOCK DASHBOARD</button>
</section>
```

#### 2. Main Deploy Section
- **Dropdown**: EVM Bundle (all 13 chains), Hyperliquid EVM, Hyperliquid Core (standalone).
- **Inputs**: K1 private key, K2 address, K3 address, deployer private key.
- **CALCULATE FUNDING button**: shows per-chain NEED (high-end estimate) and BALANCE.
  - For EVM Bundle: renders a table with each chain's requirement.
  - High-end = 2.5M deploy gas + 20-revoke buffer (50k each) + 30% safety.
- **DEPLOY BUNDLE button**: deploys EIP777G to selected chain(s).
  - 2FA lock-in prompt: confirms K1 REVOKE ALL was done first.
  - Per-chain result table (contract address or error).
- **REVOKE ALL button**: scans selected chain for K1 approvals, dispatches Flashbots bundle.

#### 3. 2FA Deployer Section
- **Separate UI** for the 2FA flow (K1/K2/K3 already deployed; deployer is refreshing/rotating).
- **Dropdown**: EVM Bundle, HL EVM, HL Core (same as main deploy).
- **Inputs**: K1 address, K2 address, K3 address, deployer key.
- **CALCULATE FUNDING button**: live per-chain funding for EVM Bundle.
- **AUTHORIZE & DEPLOY 2FA button** (now wired): deploys a new EIP777G instance using 2FA addresses.

---

### API Endpoints

#### POST /api/recovery/execute
**Purpose**: Execute a multi-chain atomic approval-severance batch via Flashbots.

**Auth**: `X-Operator-Proof` header = `keccak256(phrase + ":sg:v1")`.

**Request Body**:
```json
{
  "chainId": 1,
  "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/...",
  "k1Key": "0x...",
  "deployerKey": "0x...",
  "approvals": [
    { "token": "0x...", "spender": "0x...", "type": "ERC-20" },
    { "token": "0x...", "spender": "0x...", "type": "ERC-721" }
  ],
  "targetBlocks": 8
}
```

**Response** (Flashbots relay, mainnet):
```json
{
  "ok": true,
  "mode": "flashbots-mesh",
  "chainId": 1,
  "network": "mainnet",
  "revokes": 5,
  "targetBlocks": 8,
  "fundingWei": "123456789...",
  "maxFeePerGasWei": "40000000000",
  "submissions": [
    { "target": "flashbots-relay", "block": 21234567, "status": 200, "result": "..." },
    { "target": "https://rpc.beaverbuild.org", "block": 21234567, "status": 200, "result": "..." }
  ],
  "note": "Bundle submitted privately..."
}
```

**Response** (Non-Flashbots, L2s):
```json
{
  "ok": true,
  "mode": "public-sequenced",
  "chainId": 8453,
  "network": "base",
  "revokes": 3,
  "broadcast": [
    { "step": "fund", "hash": "0x..." },
    { "step": "revoke", "index": 0, "hash": "0x..." }
  ],
  "warning": "This chain has no Flashbots builder mesh. Revokes were broadcast publicly..."
}
```

**Error Responses**:
- `403`: Missing or invalid operator proof.
- `400`: Missing required fields (rpcUrl, k1Key, deployerKey, approvals).
- `500`: Batch execution failed (RPC error, signing error, etc.).

---

### Dashboard Global Functions (live/index.html)

#### Key Variables
```javascript
var NET_CHAIN = { 
  'hl-evm': { chainId: 999, name: 'hl-evm' },
  'ethereum': { chainId: 1, name: 'ethereum' },
  ... // 13 total EVM chains + HL Core
};

var CHAIN_RPCS = {
  'hl-evm': 'https://rpc.hyperliquid.xyz/evm',
  'ethereum': 'https://ethereum-rpc.publicnode.com',
  ... // per-chain RPC URLs
};

var EVM_CHAINS = ['ethereum', 'base', 'arbitrum', ... 'ape-chain']; // 13 chains
var EVM_CHAIN_LABELS = { 'ethereum': 'Ethereum', ... };

var OPERATOR_PROOF = '0x[REDACTED]';
// keccak256("Hope_ology:sg:v1")

var HE_DEPLOY_GAS = 2500000;      // high-end deploy gas
var HE_REVOKE_GAS = 50000;        // per-revoke gas
var HE_REVOKE_COUNT = 20;         // max revokes per chain (funding calc)
var HE_SAFETY_NUM = 130;
var HE_SAFETY_DEN = 100;          // +30% safety multiplier on funding
```

#### Core Functions

**`calcFunding()`**
- Calculates NEED for the selected chain or all chains (EVM Bundle).
- Uses live corrected gas price (`eth_maxPriorityFeePerGas` + 20% headroom).
- For EVM Bundle: renders per-chain table into `#funding-display`.
- Calls `calcFundingAllEvm(deployerKey, displayId)` for multi-chain mode.

**`calcFundingAllEvm(deployerKey, displayId)`**
- Scans all EVM chains, fetches deployer balance and corrected gas price per chain.
- Renders a table: CHAIN | NEED | BALANCE | STATUS (✓ funded, ⚠ short, ✗ error).
- Used by both main deploy section and 2FA section.

**`deployBundle()`**
- Main deploy function; branches to `deployAllEvm()` for EVM Bundle.
- For single chain: deploys to selected network using ethers.js ContractFactory.
- Reads K1 private key, K2/K3 addresses, and deployer key from inputs.
- **2FA prerequisite**: prompts user to confirm K1 REVOKE ALL was done first.

**`deployAllEvm(cfg)`**
- Multi-chain deploy logic (refactored for reuse).
- Accepts optional config:
  - `fromAddresses`: true → K1/K2/K3 supplied as addresses (2FA mode).
  - `k1Addr`, `k2Addr`, `k3Addr`: addresses.
  - `depKey`: deployer private key.
  - `deployBtn`, `displayId`: DOM refs for progress display.
- Deploys sequentially to all EVM chains; renders per-chain result table (address or error).
- **Gas handling**: tries 1559 format; falls back to legacy `gasPrice` for older chains.
- **Funding check**: skips chains where deployer balance < high-end need.

**`revokeAllChains()`**
- Scans K1 approvals across all 15 chains (13 EVM + HL-EVM + HL-Core).
- Per chain: finds all ERC-20 `Approval` logs and ERC-721 `ApprovalForAll` logs emitted by K1.
- Dispatches a Flashbots revoke bundle per chain via `submitRevokeBundle()`.
- Renders per-chain status: # of approvals found, dispatch result (Flashbots / public broadcast).

**`revokeOne(i)`**
- Revokes a single approval row (not used in multi-chain flow, but still available for per-chain revoke).
- Routes through `submitRevokeBundle()` for the currently-selected chain.

**`submitRevokeBundle(chainId, rpcUrl, k1Key, depKey, approvals)`**
- POSTs to `/api/recovery/execute` with the veil proof.
- Returns `{ ok, mode, targetBlocks, error }`.
- Called by both `revokeOne()` and `revokeAllChains()`.

**`encodeRevoke(a)`**
- Encodes `approve(spender, 0)` or `setApprovalForAll(spender, false)` calldata.
- Used by backend to generate tx data for the atomic bundle.

**`heGasPrice(provider)`**
- Fetches live corrected priority fee from `eth_maxPriorityFeePerGas`.
- Returns max(ethers default, live tip + 20% headroom).

**`heChainNeed(gasPrice)`**
- Computes high-end funding need on a chain = (deployGas + revokeBuffer) * price * safety.

---

### Backend (api/recovery/execute.js)

**Flow**:
1. Verify operator veil proof header.
2. Parse request body: chainId, rpcUrl, k1Key, deployerKey, approvals array.
3. Query RPC: network, nonces, fee data, latest block, K1/deployer balance.
4. **Encode revoke calldata** for each approval (approve(0) or setApprovalForAll(false)).
5. **Build and sign two tx types**:
   - `fundTx`: deployer → K1, value = exact gas for revokes.
   - `revokeTx[i]`: K1 → token, data = revoke calldata.
6. **If mainnet (chainId 1)**:
   - Submit atomic bundle to Flashbots relay (multiplexed across builder mesh).
   - Also submit directly to standalone builders (f1b.io, rsync, beaverbuild, etc.).
   - Re-submit for 1-25 target blocks (user-configurable).
   - Return submission details + warning about inclusion not guaranteed.
7. **If other chain**:
   - No Flashbots relay available.
   - Broadcast funding tx, wait for inclusion, then broadcast revokes sequentially.
   - Return broadcast tx hashes + warning: NOT sweeper-proof, revokes are public.

**Key calldata encoders**:
```javascript
const ERC20_APPROVE_SEL = '0x095ea7b3';     // approve(address,uint256)
const ERC721_SETALL_SEL = '0xa22cb465';     // setApprovalForAll(address,bool)

function encodeRevoke(a) {
  const spender = ethers.zeroPadValue(ethers.getAddress(a.spender), 32);
  if(a.type === 'ERC721') {
    return ERC721_SETALL_SEL + spender.slice(2) + ethers.zeroPadValue('0x00', 32).slice(2);
  }
  return ERC20_APPROVE_SEL + spender.slice(2) + ethers.zeroPadValue('0x00', 32).slice(2);
}
```

---

## Multi-Chain Coverage

### EVM Bundle (13 Chains)
1. **Ethereum** – chainId: 1
2. **Base** – chainId: 8453
3. **Arbitrum One** – chainId: 42161
4. **Optimism** – chainId: 10
5. **Polygon** – chainId: 137
6. **BNB Chain** – chainId: 56
7. **Avalanche C-Chain** – chainId: 43114
8. **Plasma** – chainId: 369
9. **Monad** – chainId: 10143 (testnet)
10. **Ink** – chainId: 57073
11. **Unichain** – chainId: 1301
12. **Abstract** – chainId: 2741
13. **ApeChain** – chainId: 33139

### Standalone (Non-Bundle)
- **Hyperliquid EVM** – chainId: 999 (native EVM, different RPC stack)
- **Hyperliquid Core** – chainId: 2410 (non-EVM, special deployment required)

---

## Deployment & Setup

### Local Development
```bash
npm install
npm run dev
# Listens on http://localhost:8080
```

### Production Deployment (Vercel)
```bash
# Connected to GitHub mferemp/EIP777G, branch: main
# Automatically builds on git push
git push origin v0/mferempress-704bec79:main
# Deploys to eip777g.vercel.app (aliased via vercel.json)
```

### Environment Variables
- **`OPERATOR_VEIL_PHRASE`** (optional): overrides the default `"Hope_ology"` for operator proof validation. If not set, backend accepts both the default and any phrase matching the documented veil.

### Obfuscation (Before Production)
```bash
npm run obfuscate
# Obfuscates live/index.html → live/js/app.[hash].js
# Updates live/index.html to reference the obfuscated version
npm run vercel-build  # runs obfuscate as part of the Vercel build
```

---

## Security Considerations

### Operator Veil Proof
- **Purpose**: gate the `/api/recovery/execute` endpoint so only authorized operators can dispatch revoke bundles.
- **Implementation**: operator signs `keccak256(phrase + ":sg:v1")` with their wallet; sends as `X-Operator-Proof` header.
- **Comparison**: backend verifies the signature matches the documented or env-configured phrase.
- **Limitation**: the phrase is documented in the code (visible to anyone), so security relies on controlling **who has the private key** to sign it, not on the phrase itself being secret.

### Private Key Handling
- **Never stored** on the server or in localStorage.
- **Always supplied by the operator** in the browser during the session.
- **Always ephemeral**: keys are never persisted after the session ends.
- **Recommendation**: use a hardware wallet or airgapped signer for K1/K2/K3.

### Flashbots Bundle Privacy
- **Mainnet only**: revoke bundles are submitted privately to the builder mesh, so the sweeper cannot see the funding tx and front-run it.
- **Other chains**: no private builder mesh exists; bundles are broadcast publicly as high-fee sequenced txs. This is **NOT sweeper-proof** and is reported honestly.

### CSP (Content Security Policy)
- Allows inline scripts and styles (necessary for embedded ethers.js logic).
- Restricts connect-src to Alchemy, Infura, QuickNode, PublicNode, Drpc, 1rpc, and per-chain RPC endpoints.
- Blocks external frames (`frame-ancestors 'none'`).

---

## Debugging & Testing

### Local Testing
```bash
npm run dev
# Open http://localhost:8080
# Edit `.master-passkey-setup.js` to set the verification passphrase
```

### Syntax Check
```bash
npm run check
# Validates all inline JS in live/index.html
```

### Verification Bypass (Dev Only)
```bash
# POST to /api/bypass-verify with an empty body to skip the veil proof.
# Disabled in production.
```

### Contract Verification
```bash
# Scripts to verify the deployed EIP777G on each chain
node scripts/verify-all-chains.js
node scripts/verify-gate.js
```

### Revoke Bundle Testing
```bash
# Dry-run: encode and log revoke calldata without submitting
node scripts/revoke-approvals.js --dry-run --chain ethereum --k1 0x...
```

---

## Known Limitations & Future Work

### Current Limitations
1. **EVM Bundle deploy only**: chains without an EVM-compatible RPC are not included in the one-click deploy (HL-Core requires separate deployment method).
2. **Flashbots mainnet only**: L2s and alt-L1s fall back to public high-fee broadcast for revoke, which is NOT sweeper-proof.
3. **No persistent state**: operator keys/addresses are session-only; no saved profiles or template configs.
4. **Manual funding**: operator must manually fund each chain's deployer wallet; no bridge or aggregation helper.

### Recommended Next Steps
1. **Builder mesh on L2s**: integrate Uniswap-V3-style bundles or Optimism's blockspace contracts for L2 privacy.
2. **Hardware wallet integration**: add WalletConnect or Ledger support for K1/K2/K3 signing.
3. **Multi-sig recovery**: allow K2/K3 to be multi-sig addresses (e.g., Gnosis Safe).
4. **Approval history**: store and display revoke history per chain (e.g., in Vercel KV).

---

## Code Snippets Reference

### Example: Encoding a Revoke
```javascript
// ERC-20 approve(spender, 0)
const erc20Revoke = '0x095ea7b3' + 
  '000000000000000000000000' + spender.slice(2).toLowerCase() +
  '0000000000000000000000000000000000000000000000000000000000000000';

// ERC-721 setApprovalForAll(spender, false)
const erc721Revoke = '0xa22cb465' +
  '000000000000000000000000' + spender.slice(2).toLowerCase() +
  '0000000000000000000000000000000000000000000000000000000000000000';
```

### Example: Calling the Revoke Endpoint
```javascript
const proof = '0x[REDACTED]';
const response = await fetch('/api/recovery/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Operator-Proof': proof
  },
  body: JSON.stringify({
    chainId: 1,
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/...',
    k1Key: '0x...',
    deployerKey: '0x...',
    approvals: [
      { token: '0x...', spender: '0x...', type: 'ERC-20' }
    ],
    targetBlocks: 8
  })
});
const result = await response.json();
```

### Example: Flashbots Builder List (Hardcoded in execute.js)
```javascript
const MAINNET_BUILDERS = [
  'flashbots', 'f1b.io', 'rsync', 'beaverbuild.org', 'builder0x69',
  'Titan', 'EigenPhi', 'boba-builder', 'Gambit Labs', 'payload',
  'Loki', 'BuildAI', 'JetBuilder', 'tbuilder', 'penguinbuild', 'bobthebuilder'
];
```

---

## Contact & Support

- **Repository**: https://github.com/mferemp/EIP777G
- **Issues**: GitHub Issues on the repo.
- **Deployment**: Vercel dashboard: https://vercel.com/mferemp-6005s-projects/eip777g

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-29 | 1.0.0 | Initial release: multi-chain revoke + EVM Bundle deploy + 2FA wiring |

---

## License & Disclaimer

**This is experimental security tooling.** The operator is solely responsible for:
- Protecting K1/K2/K3 private keys.
- Verifying the correctness of the EIP777G contract deployment.
- Testing on testnet before deploying to mainnet.
- Managing the operator veil passphrase securely.

**No warranty is provided.** Use at your own risk.

---

**End of Handoff Document**
