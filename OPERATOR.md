# CONFIDENTIAL — Empress Operator Reference (Complete Build)

> **NOT FOR PUBLIC DISTRIBUTION.** Authorized operators only.  
> Owner: Empress (@Hope_ology). See `LICENSE` for proprietary terms.  
> **Public misdirection:** `README.md` + `PROTOCOL.md` — never link this file publicly.

---

## Author stipulation (binding — original operator record)

> **Statement.** Empress (@Hope_ology) is the **sole author and owner** of the total
> SecureGate / Helix Fabric build — original operator documentation included.

This includes — without limitation:

- Complete **logic** and control flows (queue → attest → commit, deploy sequence, severance)
- **Workflow design** (veil, coherence, beacon, operator variables, deploy fabrics, ownership verification)
- **Variables** (lane topology, encoded constants, session vault, RPC maps, funding estimates)
- Deliberate **departures from industry standards** (no pre-move recovery model, K3-only exit, public misdirection literature, obfuscation layers)
- All code, docs, dashboard copy, and integrations **pieced across various LLM-assisted sessions**

> **Stipulation.** No LLM vendor, model operator, or third-party assistant acquires
> authorship, ownership, license, or attribution rights. Assistants were tools under
> Empress's direction. The total work product — across original (`OPERATOR.md`) and
> public-facing (`README.md`, `PROTOCOL.md`, `LICENSE`) materials — is attributed
> **exclusively to Empress (@Hope_ology)**.

Public docs carry the same stipulation in protocol-facing language. They do **not**
dilute or transfer ownership. This operator record is the authoritative design truth.

---

## Package map

| Path | Purpose |
|------|---------|
| `live/index.html` | **Served dashboard** — minified SecureGate UI, no source in DOM |
| `operator/source/index.html` | **Custody source** — readable build + export tab + code panel |
| `operator/CUSTODY.md` | Custody handover record |
| `docs/public/` | Public misdirection (Helix Fabric) |
| `docs/confidential/` | This file + ACKNOWLEDGEMENT.md |
| `server/index.js` | Unified backend — serves `live/` + optional API + relay mesh |
| `gate.js` | On-chain registry reader (K1/K2/K3, balances, auth params) |
| `EIP777G.json` | Contract ABI + bytecode |
| `deploy-bundle.js` | Mainnet registry deploy (courier-signed) |
| `scripts/revoke-approvals.js` | ETH Flashbots atomic severance (K1-signed) |
| `scripts/revoke-fabric.js` | Per-fabric EVM severance (K1-signed, all L2s + HL EVM) |
| `scripts/revoke-hl-core.js` | HL Core agent/delegate severance via exchange API |
| `scripts/lib/revoke-encode.js` | ERC-20/721/1155 + gov delegate encoding |
| `scripts/deploy-fabric.js` | Generic EIP-1559 registry deploy (L2 + HL EVM) |
| `scripts/deploy-hl-evm.js` | HL EVM wrapper (`DEPLOY_FABRIC=hl-evm`) |
| `scripts/deploy-hl-core.js` | HL Core clearinghouse API bootstrap |
| `routes/state.js` | `GET /api/state` → `gate.readState()` |
| `routes/recovery.js` | Plan / execute / logs for severance workflow |
| `routes/rescue.js` | `POST /api/rescue` → deploy-bundle trigger |
| `server/relay.js` | `GET /relay/mesh` — live builder reachability probes |
| `dashboard/` | Legacy read-only console (optional; superseded by `index.html`) |
| `.env` | Operator secrets — **never commit** |
| `.env.example` | Template for required variables |

---

## Four wallets — roles (never conflate)

| Wallet | Operator name | Role | On this machine? |
|--------|---------------|------|------------------|
| **Deployer** | Courier / bot | **Initiates deployment. Pays gas.** Funds originate here for deploy + atomic revoke bundles. Burner — minimal ETH only. | `.env` / relay only |
| **K1** | α lane · **compromised wallet** | The **attacked wallet being rescued**. May only **queue** recovery packets. **Cannot execute alone.** | Ephemeral in browser or `.env` |
| **K2** | β lane · offline authority | **Air-gapped attestor.** Paste signature bytes only. **Cannot change K3.** | **Never** |
| **K3** | γ lane · clean terminus | **Passive immutable drop wallet.** Receives all authorized exits. Does not sign or initiate. | Address only |

**Deployer ≠ K1 ≠ K2 ≠ K3.**

---

## Asset protection (no pre-move required)

| Asset situation | How protection works |
|-----------------|----------------------|
| **Already in K1** | Queue → K2 attests → commit → routes through registry → **K3** |
| **ETH to registry** | `receive()` + sweep on commit → **K3** |
| **ERC-20 / ERC-721** | `forwardERC20` / `forwardERC721` after commit → **K3** |
| **Future inbound** | Recovery path + registry receive → **K3** |

---

## Mainnet registry (live)

| Field | Value |
|-------|-------|
| Registry | `0x56310d7e48d9249df358ab9daa6a2dad0e03e242` |
| K1 (α) | `0x01152d5c7467204bFa015061097b193CbceA8ca9` |
| K2 (β) | `0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553` |
| K3 (γ) | `0xA0eb06a5fab172860837C4D68e75F339896500b5` |

---

## Deployment sequence: fund → mesh severance → gate snap (per chain)

1. **Courier funds** — deployer wallet loaded (stays off public mempool on ETH)  
2. **Severance (every fabric)** — standard contract revokes + HL agent revoke, **before** any gate deploy  
3. **ETH blitz** — 6-builder Flashbots mesh in parallel (beats hacker sweeper):
   - Optional private **courier → K1** fund tx inside bundle (`FUND_K1_WEI`)
   - K1-signed revoke txs (atomic — all land or none)
4. **Gate snap** — ETH deploy via same mesh (`eth-blitz-deploy.js`); L2/HL EVM via sequencer after severance gate clears  

Deploy API returns **409** if severance not complete on that fabric (`GET /api/deploy/severance`).

---

## Live vs source architecture

| Build | Path | Served | API to operate |
|-------|------|--------|----------------|
| **Live** | `live/index.html` | `GET /` | **No** — ethers + public RPC |
| **Source** | `operator/source/index.html` | Never (custody) | Same + optional export APIs |

Rebuild live: `npm run build:live` (runs automatically before `npm start`).

### Security & obfuscation parameters

| Parameter | Value |
|-----------|-------|
| `PUBLIC_WIRING.gate` | `0x56310d7e48d9249df358ab9daa6a2dad0e03e242` |
| `PUBLIC_WIRING.k1` | `0x01152d5c7467204bFa015061097b193CbceA8ca9` |
| `PUBLIC_WIRING.k2` | `0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553` |
| `PUBLIC_WIRING.k3` | `0xA0eb06a5fab172860837C4D68e75F339896500b5` |
| `_PEPPER` | `[0x7a,0x3f,0x91,0xc2,0x55,0xe8,0x14,0xb8,0xa6,0x8b,0x00,0xff]` |
| Live strip markers | `SG_LIVE_REMOVE_START` / `END` in HTML + JS |
| Operator proof | `keccak256(OPERATOR_VEIL_PHRASE + ':sg:v1')` → header `X-Operator-Proof` |
| Consent proof | `OPERATOR_CONSENT_PHRASE` → header `X-Operator-Consent` |
| Coherence TTL | 30 minutes |
| Source export idle lock | 5 minutes (source build only) |
| Mesh fallback | Browser `no-cors` direct probe when relay API absent |

### Layer 1 — Source export veil (source build only)
- Operator phrase unlocks code panel + export tab (`keccak256(phrase + ':sg:v1')`)
- **Not present in live build** — inspect cannot reveal source on served site
- Auto-lock: idle 5m, `Esc`, tab hide (source build only)

### Layer 2 — Session coherence
- Origin vector + epoch marker (+ optional β sig)
- 30-minute TTL; gates Stage / Attest / Commit / Sever
- Mantle digest binds operator to on-chain γ terminus + chainId

### Live on-chain wiring (browser)
| Tab | Contract calls | Signer |
|-----|------------------|--------|
| **Stage** | `queueTransaction(...)` | K1 (α) ephemeral |
| **Attest** | `authorizeTransaction(txHash, override, k2Sig)` | Courier or α (gas) |
| **Commit** | `executeTransaction(txHash)` | Courier or α (gas) |
| **Sever** | Direct `approve(0)` / `setApprovalForAll(false)` txs | Courier |
| **Telemetry** | `thresholdSigner`, `k2Authority`, `defaultDropWallet`, `pending`, balances | Read-only |

### K2 attestation (air-gapped)
Personal-sign hash over:
```
keccak256(abi.encodePacked(txHash, overrideDestination, chainId))
```
Wrapped as `\x19Ethereum Signed Message:\n32` + payload. Paste sig in Attest tab.

### Backend integration (optional — `npm start`)
| Endpoint | Function | Gate |
|----------|----------|------|
| `GET /` | Serves `live/index.html` | Public |
| `GET /export` | Redirects to `/` (no source route) | Public |
| `GET /api/state` | Full gate state via `gate.js` | Public read |
| `GET /relay/mesh` | Live relay reachability (6 builders) | Public read |
| `GET /api/recovery/logs` | Operator recovery trace | Public read |
| `POST /api/recovery/plan` | Build recovery plan + log | **Operator veil proof** |
| `POST /api/recovery/execute` | Runs `scripts/revoke-approvals.js` | **Operator veil proof** |
| `POST /api/rescue` | Runs `deploy-bundle.js` | **Operator veil proof** |
| `POST /api/deploy/*` | Deploy / revoke relay scripts | **Operator veil proof** |
| `GET /api/docs/operator` | Confidential operator doc | **Operator veil proof** |
| `GET /api/docs/acknowledgement` | Binding author acknowledgement | Public read |
| `POST /api/docs/acknowledgement` | Alter acknowledgement text | **Veil proof + consent phrase** |

**Operator gate:** set `OPERATOR_VEIL_PHRASE` in `.env` (operator only). Dashboard sends
`X-Operator-Proof: keccak256(phrase + ':sg:v1')` after veil unlock. No assistant,
CI bot, or unauthorized party can invoke mutations or pull confidential docs without it.

**Consent lock:** `ACKNOWLEDGEMENT.md` is readable by anyone but **only alterable** when
`OPERATOR_CONSENT_PHRASE` (set by Empress in `.env` only) is sent as `X-Operator-Consent`
together with veil proof. Alterations are appended to `acknowledgement.log`.

Dashboard mesh panel calls `/relay/mesh` — **not simulated**.

---

## Mobile web app

- `viewport-fit=cover` + safe-area padding for notched phones
- 44px minimum tap targets on tabs/buttons
- 16px input font (prevents iOS zoom-on-focus)
- Responsive grid: single column on small screens, 2-col on `lg`
- `touch-action: manipulation` on interactive elements
- PWA-capable meta tags (`mobile-web-app-capable`, `theme-color`)

**Usage:** Open `http://127.0.0.1:3001` on mobile browser (same LAN) or tunnel. No native app required.

---

## Environment setup

```bash
cp .env.example .env
# Fill RPC_URL, lane addresses, DEPLOYER_PRIVATE_KEY (scripts only)
npm install
npm start
# → http://127.0.0.1:3001
```

### Required `.env` keys

| Variable | Used by |
|----------|---------|
| `RPC_URL` | gate.js, deploy, revoke scripts |
| `GATE_ADDRESS` | Reference (dashboard embeds post-unlock) |
| `K1_ADDRESS`, `K2_ADDRESS`, `CLEAN_WALLET` | State reader + deploy validation |
| `DEPLOYER_PRIVATE_KEY` | deploy-bundle, revoke-approvals |
| `K1_PRIVATE_KEY` | deploy-bundle K1 validation only |
| `AUTH_WINDOW`, `MIN_DELAY` | Deploy constructor (must match live contract) |
| `BACKEND_PORT` | Server bind (default 3001) |

---

## Operator scripts

```bash
npm start              # Dashboard + API + relay mesh
npm test               # Smoke tests (read-only + HTTP)
npm run deploy:mainnet # ETH mainnet registry (courier-signed, direct RPC)
npm run revoke         # ETH Flashbots severance (K1-signed)
npm run revoke:hl-core # HL Core agent severance
REVOKE_FABRIC=base npm run revoke:fabric
npm run deploy:hl-evm  # HL EVM fabric (chain 999)
npm run deploy:hl-core # HL Core clearinghouse API bootstrap
DEPLOY_FABRIC=base npm run deploy:fabric   # Any L2 fabric
```

### Per-chain deploy paths

| Fabric | Script / route | Mesh | Notes |
|--------|----------------|------|-------|
| **Ethereum** | `deploy-bundle.js` / `POST /api/deploy/ethereum` | Flashbots mesh | Registry + atomic revoke bundle |
| **HL EVM (999)** | `scripts/deploy-fabric.js` / `POST /api/deploy/hl-evm` | HL sequencer | EIP-1559 EIP777G deploy; set `SECUREGATE_HL_ADDRESS` |
| **HL Core** | `scripts/deploy-hl-core.js` / `POST /api/deploy/hl-core` | Clearinghouse API | Verifies lane map via `clearinghouseState`; not a contract deploy |
| **Base** | `deploy-fabric.js` + `DEPLOY_FABRIC=base` | L2 sequencer | `BASE_RPC_URL` |
| **Arbitrum** | `DEPLOY_FABRIC=arbitrum` | L2 sequencer | `ARBITRUM_RPC_URL` |
| **Optimism** | `DEPLOY_FABRIC=optimism` | L2 sequencer | `OPTIMISM_RPC_URL` |
| **Polygon** | `DEPLOY_FABRIC=polygon` | Validator set | `POLYGON_RPC_URL` — fund in MATIC |
| **BNB** | `DEPLOY_FABRIC=bnb` | Validator set | `BNB_RPC_URL` |

Dashboard **Severance tab** builds approval rows; **Deploy tab** runs `POST /api/deploy/:chain/revoke` per fabric.

### Severance (mandatory before gate deploy)

| Fabric | Route | Signer | Mesh |
|--------|-------|--------|------|
| Ethereum | `POST /api/deploy/ethereum/revoke` | **K1** | Flashbots atomic bundle |
| HL EVM | `POST /api/deploy/hl-evm/revoke` | **K1** | HL sequencer |
| HL Core | `POST /api/deploy/hl-core/revoke` | **K1** | Exchange API (agent revoke) |
| Base / Arb / OP / Polygon / BNB | `POST /api/deploy/:id/revoke` | **K1** | Public sequencer |

Delegates and token approvals live on **K1 (compromised wallet)** — courier cannot sever them as msg.sender. Fund K1 with native gas on each chain.

Approval types: `erc20`, `erc721`, `erc1155`, `gov_delegate`. Pass rows via dashboard Severance tab (`approvals` in POST body) or `REVOKE_APPROVALS_JSON` in `.env`.

---

## Hyperliquid

| Surface | Protocol |
|---------|----------|
| **HL Core** | Clearinghouse API bootstrap — lane verification, not EVM contract |
| **HL EVM (999)** | Sequencer EIP-1559 — EIP777G registry deploy, no Flashbots |

---

## Invariants

1. K1 = compromised; queue-only  
2. K2 = offline attest; cannot change K3  
3. K3 = passive terminus; only exit  
4. Deployer = funding courier only  

---

## Smoke test procedure

```bash
npm test
```

Validates:
- Required files present
- No mesh simulation stubs in dashboard
- Mobile viewport meta
- Live on-chain K1/K2/K3 match spec (requires `RPC_URL`)
- HTTP server serves dashboard + `/api/state` + `/relay/mesh`

---

## Session credentials (authorized operator)

| Layer | Values |
|-------|--------|
| Veil phrase | `Hope_ology` |
| Coherence secret | `EmpressGate` |
| Epoch marker | `Hope_ology` |

---

## Stipulation restatement (legal cross-reference)

The author & ownership stipulation in this document is **identical in force** to:

| Document | Role |
|----------|------|
| `OPERATOR.md` | Original / confidential — full design truth |
| `README.md` | Public — normie-facing + stipulation section |
| `PROTOCOL.md` | Public — protocol literature + stipulation section |
| `LICENSE` | Legal — NOTICE OF AUTHORSHIP + §2 |
| `index.html` | Dashboard — Ownership panel + footer declaration |

**Empress (@Hope_ology)** remains sole author of logic, workflows, variables, standards
choices, and LLM-assisted assembly across all of the above.

---

*© Empress (@Hope_ology). Sole author. Confidential.*