# SecureGate v1 — Environment Setup & Complete System Architecture

**Owner:** Empress (@hope_ology)  
**Contract:** 0x56310d7e48d9249df358ab9daa6a2dad0e03e242 (Ethereum Mainnet, block 25267738)  
**Status:** Production-ready, all systems integrated

---

## Part 1: ENVIRONMENT VARIABLES & SECRETS

All values stored in `.env.local` (git-ignored). **NEVER commit secrets.**

### 1.1 Cross-Chain RPC URLs (Required for deployment)

```bash
# Ethereum Mainnet (chainId 1)
RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Hyperliquid EVM (chainId 998) — Primary alt-chain
RPC_HYPERLIQUID=https://hl-evm.your-rpc.com

# Other chains (as needed for multi-chain recovery)
RPC_OPTIMISM=https://...
RPC_POLYGON=https://...
RPC_ARBITRUM=https://...
RPC_BASE=https://...
RPC_AVALANCHE=https://...
RPC_BNB=https://...
RPC_PLASMA=https://...
RPC_INK=https://...
RPC_ABSTRACT=https://...
RPC_MONAD=https://...
```

### 1.2 Signer Keys (Never generated online)

```bash
# COMPROMISED KEY (K1) — Queue-only authority
# Safe because K1 can ONLY call queue(), never execute
K1_PRIVATE_KEY=0x...
K1_ADDRESS=0x0115...8ca9

# DEPLOYER KEY — Burner, minimally funded for gas only
# Never holds assets; used only for relay submission and fund-K1 tx
DEPLOYER_PRIVATE_KEY=0x...

# K2 private key — NEVER enter here or online
# K2 authorization: sign EIP-712 offline (Ledger/hardware wallet), paste hex to dashboard
# (No K2_PRIVATE_KEY in .env — this is intentional security design)
```

### 1.3 Master Passkey System

```bash
# Generated locally: node .master-passkey-setup.cjs "YOUR_STRONG_PASSKEY"
MASTER_PASSKEY_HASH=<sha256_hash_of_passkey>

# For HMAC user token generation: openssl rand -base64 32
ADMIN_TOKEN_SECRET=<random_secret>

# Redis KV for one-time token tracking (Vercel Storage)
VERCEL_KV_REST_API_URL=https://...
VERCEL_KV_REST_API_TOKEN=<token>
```

### 1.4 Twitter Burner Account (For DM automation)

```bash
TWITTER_BURNER_USERNAME=@whiskeystr8shot
TWITTER_BURNER_PASSWORD=<process.env.burnerxaccount>

# DM recipient — thank-you notes sent here after key issuance
TWITTER_DM_TARGET=@hope_ology
```

### 1.5 Deployment & Safety Caps

```bash
# Hard cap on gas spend (abort before signing if exceeded)
ETH_CAP_WEI=25000000000000000  # 0.025 ETH

# Optional: fund K1 via courier (deployer) if needed
FUND_K1_WEI=1000000000000000000  # 1 ETH (optional)

# Auto-revoke spenders as JSON array (from /api/recovery)
REVOKE_APPROVALS_JSON=[{"chain":"ethereum","token":"0x...","spender":"0x..."},...]

# Priority fee escalation
PRIORITY_GWEI=15  # BASE, escalates to 25 → 30 if not landing
```

---

## Part 2: GENESIS DEVICE OWNERSHIP VERIFICATION (Auth-Gate)

### 2.1 The 4-Artifact Set (Exact logic hidden in obfuscated gate.js)

Genesis verification runs **locally only** on user's device. No data leaves browser.

| Artifact | Source | Hidden? | Purpose |
|----------|--------|---------|---------|
| Device Fingerprint (1) | Canvas API + WebGL + UA | Yes | Proves same hardware used historically |
| First K1 Transaction Signal (2) | Blockchain query for K1's first tx | Yes | Proves historical K1 ownership |
| Visit Timestamp Pattern (3) | Browser localStorage (first visit) | Yes | Proves continuous possession |
| Return Visit Signal (4) | localStorage + device clock | Yes | Proves return to same location+time |

**Scoring:** 3 of 4 artifacts must match → Auth-Gate unlocks.

**Why hidden:** Attackers cannot reverse-engineer or spoof the exact set. Bad actors may try multiple techniques; only the real owner will have the expected pattern.

### 2.2 Auth-Gate Fallback: Twitter DM

If user fails Auth-Gate but **can prove original K1 ownership** (transaction records, custody docs, etc.):
1. DM `@hope_ology` on X/Twitter (must follow first)
2. Provide proof of K1 ownership
3. Receive one-time bypass token
4. Paste token into dashboard → Access granted

---

## Part 3: SYSTEM ARCHITECTURE (Complete Flow)

### 3.1 Dashboard Entry Point (Pre-Auth-Gate Locked)

```
User opens dashboard (index.html)
        ↓
gate.js loads (2.1M obfuscated, RC4 encoded strings)
        ↓
4-artifact sweep runs locally (Canvas, blockchain, localStorage)
        ↓
Genesis verification result
        ├─ PASS → Unlock dashboard, show 9 panels
        └─ FAIL → Show Auth-Gate failure, offer Twitter DM fallback
```

### 3.2 K1/K2/K3 Model (Immutable at deploy)

**K1 (Compromised queue-only)**
- Address: `0x0115...8ca9`
- Role: Can ONLY call `queue(intentHash)` on contract
- Security: Compromised key acceptable because zero tx authority
- Environment: Safe on recovery machine (no autonomous power)

**K2 (Off-chain EIP-712 signer)**
- Address: `0x55c7...4553`
- Role: Must sign `authorize(intentHash, nonce, deadline, sig)` EIP-712 message
- Security: Private key NEVER online; signs only on air-gapped device or hardware wallet
- Requirement: Fresh single-use nonce + deadline per authorization

**K3 (Clean wallet / passive sink)**
- Address: `0xA0eb...00b5`
- Role: Immutable destination for all asset forwarding
- Security: No authority; just receives swept assets post-authorization

### 3.3 Nine Dashboard Panels (Post-Auth-Gate)

```
Panel 1: Authority Model
  ├─ Contract address (Etherscan link)
  ├─ K1/K2/K3 addresses (public reads via RPC)
  └─ Status badge (OPERATIONAL / DEGRADED)

Panel 2: EIP777G Audit Checklist
  └─ 10/10 security properties (all verified at deploy)

Panel 3: Deploy Status
  ├─ Contract address, deploy tx, block, deployer
  ├─ Wiring verification (K1/K2/K3 match check)
  └─ Etherscan verified status

Panel 4: Flashbots Relay Log
  ├─ 4 parallel relays (Flashbots, Protect, Builder0x69, Rsync)
  └─ Win/loss log per block

Panel 5: Spend Cap Monitor
  ├─ Hard cap: 0.025 ETH
  ├─ Spent this session (tracked live)
  ├─ Worst-case base fee calc (1.125^10 × baseFee)
  └─ Escalation state (15 → 25 → 30 gwei)

Panel 6: Hyperliquid Account
  ├─ Account equity (via api.hyperliquid.xyz/info)
  ├─ Unrealized PnL
  ├─ Margin used
  └─ Open positions

Panel 7: Hyperliquid Sweep Queue
  ├─ Intent hash queue (localStorage-persisted)
  ├─ MIN_DELAY countdown (900s)
  └─ Authorized / Executed flags (from contract)

Panel 8: Auto-Revoke Bundler
  ├─ Live ERC20/ERC721 approvals from /api/recovery
  ├─ Per-chain nonce + base fee (live)
  ├─ Calldata encoding: approve(spender,0) / setApprovalForAll(operator,false)
  └─ JSONL export → RelaySubmitter → 5 private relays

Panel 9: Deploy / Revoke Log
  └─ Persistent session log (localStorage)
```

### 3.4 Backend API Surface (Node.js Express)

**Port:** localhost:3001 (development) / vercel.com (production)

| Endpoint | Method | Input | Signer | Output |
|----------|--------|-------|--------|--------|
| `/api/relay` | POST | { chainId, signedTxs: [0x...] } | None (broadcast only) | { ok, hashes } |
| `/api/revoke-approvals` | POST | { chainId, approvals } | K1 | { bundle } |
| `/api/recovery` | GET | — | — | [{ chain, token, spender, type }] |
| `/api/hl-account` | GET | — | — | { equity, pnl, margin, positions } |
| `/api/generate-user-key` | POST | { masterPasskeyHash, k1Addr, ttl } | Admin check | { token, exp } |
| `/api/bypass-verify` | POST | { k1Addr, token } | HMAC check | { ok } |

### 3.5 Deploy Script Hierarchy

```
deploy-fabric.js (master orchestrator)
├─ deploy-hl-evm.js (wrapper → sets DEPLOY_FABRIC=hl-evm)
├─ deploy-hl-core.js (wrapper → sets DEPLOY_FABRIC=hl-core)
└─ multi-relay submission logic
   ├─ Flashbots (relay.flashbots.net)
   ├─ Protect (protect.flashbots.net)
   ├─ Builder0x69 (builder0x69.io/rpc/v1)
   └─ Rsync (rsync-builder.xyz)
```

**Escalation runbook:**
```bash
# Default: 15 gwei priority
PRIORITY_GWEI=15 npm run deploy

# Not landed after 10 blocks:
PRIORITY_GWEI=25 npm run deploy

# Still pending:
PRIORITY_GWEI=30 npm run deploy

# If still out at 30 gwei:
# → Problem is RPC latency or relay receiving bundles too late
# → Reduce TARGET_BLOCKS=5, rerun
```

### 3.6 Revoke Bundler Architecture

```
revoke-approvals.js
├─ Input: REVOKE_APPROVALS_JSON (7 spenders)
├─ Per approval:
│  ├─ Encode: approve(spender, 0) or setApprovalForAll(operator, false)
│  ├─ Sign via K1 (compromised, queue-only safe)
│  └─ Atomic private bundle
├─ Output: JSONL envelope → RelaySubmitter
└─ Result: All revokes land together, no mempool exposure
```

**Key enforcement:**
- Hard cap: 0.025 ETH (enforced before signing)
- Gas buffer: 120% of estimate
- Worst-case base fee: 1.125^10 × currentBaseFee (10-block window)
- Abort if cap exceeded: "Would exceed 0.025 ETH cap — aborting"

---

## Part 4: SECURITY BOUNDARIES

### What runs on recovery machine:
- K1 signing only (queue-only, no autonomous power)
- Deployer signing for gas-only txs (burner, minimal funds)
- Public RPC reads (contract state, balances)
- Relay submission of signed hex strings

### What NEVER runs here:
- K2 private key generation, storage, or usage
- K3 key of any kind
- Any value-moving authorization
- EIP-712 signature generation (done offline only)

### K2 Authorization Flow:
```
1. Dashboard displays EIP-712 typed data for authorize()
2. Admin copies to air-gapped device (Ledger / clean laptop)
3. Admin signs with K2 offline (using cast wallet sign-tx)
4. Admin pastes signed hex back into dashboard K2 authorize field
5. Dashboard submits to chain via relay (deployer pays gas)
```

---

## Part 5: STALE CODE & CLEANUP

Files to eliminate (already identified, not in active use):

- Multiple old *.md files in root (duplicated specs, iterations)
- Old versioned app.js files (kept only latest)
- Empty fix files (envelope-fix.js, admin-fix.js)
- Test/demo files (not in production live/index.html)
- Draft documentations (superseded by SPEC-DEFINITIVE.md)

---

## Part 6: INITIALIZATION CHECKLIST

Before first deployment:

- [ ] Create `.env.local` with all RPC URLs filled
- [ ] Generate `MASTER_PASSKEY_HASH`: `node .master-passkey-setup.cjs "YOUR_KEY"`
- [ ] Generate `ADMIN_TOKEN_SECRET`: `openssl rand -base64 32`
- [ ] Set up Vercel KV (Redis) for token tracking
- [ ] Verify `K1_ADDRESS` and `K1_PRIVATE_KEY` match
- [ ] Verify `DEPLOYER_PRIVATE_KEY` is burner (minimal funds)
- [ ] Confirm K2 private key is NOT in `.env` (offline only)
- [ ] Set `PRIORITY_GWEI=15` (escalate as needed)
- [ ] Test `/api/relay` with signed test tx
- [ ] Verify `/api/recovery` returns expected approvals

---

**System fully documented. All environments isolated. All secrets protected. Deployment ready.**
