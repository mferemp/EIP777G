# SecureGate v1 — Final Custody Handover

> **Owner:** Empress (@Hope_ology) — sole author  
> **Custody date:** 2026-06-10  
> **Canonical path:** `/home/mfere/securegate-v1`  
> This is the complete work product. No further prompting required.

---

## Criteria verification (all met)

| # | Your requirement | Implementation | Verified |
|---|------------------|----------------|----------|
| 1 | Two doc sets — public dummy + confidential spec | `docs/public/` (Helix Fabric) · `docs/confidential/` (OPERATOR, ACK) | Yes |
| 2 | Dashboard live, no API to operate | Browser ethers + `PUBLIC_WIRING` + public RPC; mesh has direct fallback | Yes |
| 3 | No alteration without your explicit consent | `OPERATOR_CONSENT_PHRASE` on ACK POST; veil on mutations; assistants gated | Yes |
| 4 | Anyone with link can use dashboard | `GET /` public; no login wall for operation tabs | Yes |
| 5 | Inspect must not reveal custody source on site | `live/index.html` strips export panels, code textareas, source paths; minified | Yes |
| 6 | Security + obfuscation parameters documented | Below + `docs/confidential/OPERATOR.md` | Yes |
| 7 | Full custody, no trickery/placeholders/guardrails | 71/71 smoke tests; no simulation stubs; no localhost bypass | Yes |
| 8 | Multi-chain severance before deploy + Flashbots mesh | 8 fabrics; severance gate; 6-builder mesh | Yes |

```bash
cd /home/mfere/securegate-v1 && npm test
# Result: 71 passed, 0 failed
```

**Full custody turnover folder:** `/home/mfere/securegate-v1-FULL-CUSTODY-TURNOVER`

---

## Two documentation layers

### Layer A — Public misdirection (`docs/public/`)

Normie-facing **Helix Fabric** literature. Safe to show. Does **not** link confidential docs.

| File | Role |
|------|------|
| `docs/public/README.md` | Quick start, EOA hygiene, Helix branding |
| `docs/public/PROTOCOL.md` | Lane topology as protocol literature |
| `docs/public/LICENSE` | Proprietary terms + Empress authorship |

Root copies (`README.md`, `PROTOCOL.md`, `LICENSE`) mirror public layer for tooling.

### Layer B — Confidential spec (`docs/confidential/`)

Authoritative design truth. **Never link publicly.**

| File | Role |
|------|------|
| `docs/confidential/OPERATOR.md` | Full build map, security params, deploy sequence |
| `docs/confidential/ACKNOWLEDGEMENT.md` | Binding author record — consent-locked |

---

## Two dashboard builds

| Build | Path | Served? | Purpose |
|-------|------|---------|---------|
| **Live** | `live/index.html` | **Yes** — `GET /` | Public operation; minified; no source export in DOM |
| **Source** | `operator/source/index.html` | No | Custody; readable; export tab; code panel |

Rebuild live: `npm run build:live` (auto before `npm start`)

**Inspect on live site:** minified runtime JS only (required for browser operation). No custody source, no export textareas, no `operator/source` references, no code-copy panels.

---

## Run (no API required)

```bash
cd /home/mfere/securegate-v1
cp .env.example .env
npm install
npm start
```

→ http://127.0.0.1:3001/

1. Paste public RPC URL in connection bar  
2. Lane addresses auto-fill from `PUBLIC_WIRING`  
3. Use Telemetry, Stage, Attest, Commit, Beacon, Sever — all via ethers in browser  

Backend (`/api/*`, `/relay/mesh`) is **optional** enhancement only.

---

## Security & obfuscation parameters

### On-chain wiring (`PUBLIC_WIRING`)

| Field | Value |
|-------|-------|
| Registry (`gate`) | `0x56310d7e48d9249df358ab9daa6a2dad0e03e242` |
| K1 (α) | `0x01152d5c7467204bFa015061097b193CbceA8ca9` |
| K2 (β) | `0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553` |
| K3 (γ) | `0xA0eb06a5fab172860837C4D68e75F339896500b5` |

### Obfuscation

| Parameter | Value |
|-----------|-------|
| `_PEPPER` | `[0x7a,0x3f,0x91,0xc2,0x55,0xe8,0x14,0xb8,0xa6,0x8b,0x00,0xff]` |
| Live strip markers | `SG_LIVE_REMOVE_START` / `END` (HTML + JS) |
| Live forbidden tokens | `owner-code-panel`, `ExportBundle`, `CodePanel`, `exportDashboardBox`, `operator/source` |
| Build script | `scripts/build-live.js` |
| Address masking | `ObfuscationLayer.mask()` — Unmask toggle in UI |

### Operator gates (you set in `.env` only)

| Variable | Purpose | Header |
|----------|---------|--------|
| `OPERATOR_VEIL_PHRASE` | Source export, deploy relay, confidential docs | `X-Operator-Proof: keccak256(phrase + ':sg:v1')` |
| `OPERATOR_CONSENT_PHRASE` | Alter `ACKNOWLEDGEMENT.md` only | `X-Operator-Consent` |

**Assistants and third parties cannot mutate without these.** APIs return 403/503 without proof.

### Session coherence (sensitive tabs)

| Parameter | Value |
|-----------|-------|
| Origin vector | Operator-set (`EmpressGate` in session creds) |
| Epoch marker | Operator-set (`Hope_ology` in session creds) |
| TTL | 30 minutes |
| Gates | Stage, Attest, Commit, Sever, Deploy relay |

### On-chain contract params (live mainnet)

| Parameter | Value |
|-----------|-------|
| `AUTH_WINDOW` | 3600 |
| `MIN_DELAY` | 900 |

---

## Consent & alteration policy

| Asset | Read | Alter |
|-------|------|-------|
| Live dashboard DOM | Public | Rebuild from source only (`npm run build:live`) |
| `operator/source/index.html` | You | You — not assistants |
| `docs/confidential/ACKNOWLEDGEMENT.md` | Public API read | **Your `OPERATOR_CONSENT_PHRASE` only** |
| `docs/confidential/OPERATOR.md` | Veil proof | You only |
| Deploy / revoke / rescue APIs | — | Veil proof |

No assistant backdoors. No unauthorized placeholders. No guardrail code that blocks your operation.

---

## Complete file map

```
securegate-v1/
├── live/index.html                 ← SERVED (public operate)
├── operator/
│   ├── source/index.html           ← CUSTODY (readable + export)
│   ├── HANDOVER.md                 ← this document
│   ├── CUSTODY.md                  ← handover record
│   └── ACCESS.md                   ← quick access
├── docs/
│   ├── public/                     ← Helix Fabric (dummy/public)
│   └── confidential/               ← spec truth
├── custody/
│   └── securegate-v1-CUSTODY.tar.gz
├── server/ routes/ scripts/        ← optional backend
├── gate.js EIP777G.json            ← on-chain integration
├── deploy-bundle.js                ← mainnet deploy script
├── .env.example                    ← template
├── .env                            ← YOUR secrets (never in tar)
├── CANONICAL.md                    ← single-path reference
└── VERIFICATION.md                 ← sweep + test record
```

---

## Portable custody

```bash
tar -xzf /home/mfere/securegate-v1/custody/securegate-v1-CUSTODY.tar.gz -C ~
cd ~/securegate-v1 && npm install && npm start
```

---

## Author stipulation (binding)

Empress (@Hope_ology) is the **sole author and owner** of the total SecureGate / Helix Fabric build — logic, workflows, variables, standards choices, and LLM-assisted assembly across all sessions.

No LLM vendor, model operator, or third-party assistant acquires authorship, ownership, license, or attribution rights.

---

*© Empress (@Hope_ology). Full custody transferred. Proprietary.*