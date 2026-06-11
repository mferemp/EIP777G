# SecureGate v1 — Disk Map (all routes on your machine)

> **Root:** `/home/mfere/securegate-v1`  
> **Owner:** Empress (@Hope_ology)

---

## Dashboard (what runs in browser)

| Disk path | HTTP route | Who sees it |
|-----------|------------|-------------|
| `live/index.html` | `GET /` | **Everyone with link** — minified, no custody source |
| `live/index.html` | `GET /export` | Redirects → `/` |
| `operator/source/index.html` | *(not served)* | **You only** — readable + export tab |
| `index.html` (root) | *(not served)* | Mirror of `operator/source` |

**Serve command:** `npm start` → reads `server/index.js` → sends `live/index.html`

---

## Your keys & secrets (never in tar, never served)

| Disk path | Contents |
|-----------|----------|
| `.env` | **YOUR secrets** — deployer key, K1 key, RPC URLs, operator phrases |
| `.env.example` | Template only — safe reference |

| Variable in `.env` | Purpose | Status |
|--------------------|---------|--------|
| `DEPLOYER_PRIVATE_KEY` | Courier / deploy scripts | You have set |
| `K1_PRIVATE_KEY` | K1 validation scripts | You have set |
| `RPC_URL` + chain RPCs | Backend + scripts | You have set |
| `OPERATOR_VEIL_PHRASE` | API gate + source export | **You must set** |
| `OPERATOR_CONSENT_PHRASE` | ACK alteration only | **You must set** |

Lane addresses in `.env` match on-chain registry (verified).

---

## Crypto gates (on-chain + app)

### Mainnet registry (live)

| Role | Address |
|------|---------|
| Registry | `0x56310d7e48d9249df358ab9daa6a2dad0e03e242` |
| K1 (α compromised) | `0x01152d5c7467204bFa015061097b193CbceA8ca9` |
| K2 (β attest) | `0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553` |
| K3 (γ terminus) | `0xA0eb06a5fab172860837C4D68e75F339896500b5` |
| AUTH_WINDOW | 3600 |
| MIN_DELAY | 900 |

### Disk files for on-chain

| Path | Role |
|------|------|
| `gate.js` | Reads registry state (K1/K2/K3, delays) |
| `EIP777G.json` | Contract ABI + bytecode |
| `deploy-bundle.js` | Mainnet deploy script |
| `scripts/revoke-approvals.js` | Approval severance |
| `scripts/deploy-hl-evm.js` | HL EVM fabric |

### Browser wiring (no API)

Embedded in `live/index.html` as `PUBLIC_WIRING` — same addresses as above.

### Obfuscation (`operator/source` + stripped from `live`)

| Parameter | Value |
|-----------|-------|
| `_PEPPER` | `[0x7a,0x3f,0x91,0xc2,0x55,0xe8,0x14,0xb8,0xa6,0x8b,0x00,0xff]` |
| Build strip | `scripts/build-live.js` + `SG_LIVE_REMOVE` markers |
| Operator proof | `keccak256(OPERATOR_VEIL_PHRASE + ':sg:v1')` |
| Consent | `OPERATOR_CONSENT_PHRASE` |

---

## Two documentation sets

### Public misdirection — `docs/public/`

| File | Branding |
|------|----------|
| `docs/public/README.md` | Helix Fabric |
| `docs/public/PROTOCOL.md` | Helix Fabric |
| `docs/public/LICENSE` | Proprietary |

### Confidential spec — `docs/confidential/`

| File | Branding |
|------|----------|
| `docs/confidential/OPERATOR.md` | SecureGate truth |
| `docs/confidential/ACKNOWLEDGEMENT.md` | Consent-locked |

Root `README.md`, `PROTOCOL.md`, `LICENSE`, `OPERATOR.md`, `ACKNOWLEDGEMENT.md` mirror docs layers.

---

## Backend disk routes → HTTP

| Disk | HTTP | Gate |
|------|------|------|
| `server/index.js` | `GET /`, `GET /health` | Public |
| `routes/state.js` | `GET /api/state` | Public read |
| `server/relay.js` | `GET /relay/mesh` | Public read |
| `routes/deploy.js` | `POST /api/deploy/*` | **Veil proof** |
| `routes/recovery.js` | `POST /api/recovery/*` | **Veil proof** |
| `routes/rescue.js` | `POST /api/rescue` | **Veil proof** |
| `routes/docs.js` | `GET /api/docs/operator`, `dashboard` | **Veil proof** |
| `routes/docs.js` | `POST /api/docs/acknowledgement` | **Veil + consent** |
| `routes/code-bundle.js` | `GET /api/code/full`, `/tar` | **Veil proof** |
| `routes/export-build.js` | `GET /api/export/build` | **Veil proof** |
| `routes/operator-gate.js` | *(middleware)* | Enforces proof |

**Dashboard operation does not call these.** Optional only.

---

## Operator documentation (custody)

| Path | Purpose |
|------|---------|
| `operator/HANDOVER.md` | Final criteria + full spec |
| `operator/DISK-MAP.md` | This file |
| `operator/LOCKDOWN.md` | No-edit-without-command policy |
| `operator/CUSTODY.md` | Handover record |
| `operator/ACCESS.md` | Quick start |

---

## Portable archive

| Path | Purpose |
|------|---------|
| `custody/securegate-v1-CUSTODY.tar.gz` | Full project (excludes `.env`, `node_modules`) |

---

## Verify

```bash
cd /home/mfere/securegate-v1 && npm test
```

*© Empress (@Hope_ology)*