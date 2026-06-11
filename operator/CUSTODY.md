# SecureGate v1 — Custody Handover

> **Owner:** Empress (@Hope_ology) — sole author of the total build.  
> **Date:** 2026-06-10  
> This document records full custody transfer of the work product to Empress.

---

## What you own

| Asset | Path | Role |
|-------|------|------|
| **Source dashboard** | `operator/source/index.html` | Readable custody copy — export tab, code panel, full docs API wiring |
| **Live dashboard** | `live/index.html` | **Served at `/`** — minified, no source in DOM, no inspect leakage |
| **Public misdirection docs** | `docs/public/` | Helix Fabric normie-facing README, PROTOCOL, LICENSE |
| **Confidential spec docs** | `docs/confidential/` | OPERATOR.md, ACKNOWLEDGEMENT.md — full design truth |
| **Backend** | `server/`, `routes/`, `gate.js` | Optional relay — dashboard operates without it |
| **On-chain registry** | `0x56310d7e48d9249df358ab9daa6a2dad0e03e242` | Live mainnet anchor |

---

## Two documentation layers

### Public (dummy / misdirection)

- `docs/public/README.md` — Helix Fabric telemetry console narrative
- `docs/public/PROTOCOL.md` — lane topology as protocol literature
- `docs/public/LICENSE` — proprietary terms + authorship stipulation

**Never link** `docs/confidential/OPERATOR.md` from public materials.

### Confidential (spec truth)

- `docs/confidential/OPERATOR.md` — complete build map, security parameters, deploy sequence
- `docs/confidential/ACKNOWLEDGEMENT.md` — binding author record; **consent-locked**

Root copies (`README.md`, `OPERATOR.md`, etc.) mirror `docs/` for tooling compatibility.

---

## Live vs source split

| Concern | Live (`live/`) | Source (`operator/source/`) |
|---------|----------------|----------------------------|
| Served to visitors | Yes (`npm start` → `/`) | No — custody only |
| View Source / Inspect | Minified single-line script, no code textareas | Full readable HTML + export UI |
| API required to operate | **No** — ethers + public RPC only | Same |
| Source export / zip | **Removed** | Operator phrase + `/api/code/*` |
| Build command | `npm run build:live` (runs before `npm start`) | Edit directly |

---

## Security & obfuscation parameters

| Parameter | Value / behavior |
|-----------|------------------|
| `PUBLIC_WIRING.gate` | `0x56310d7e48d9249df358ab9daa6a2dad0e03e242` |
| `PUBLIC_WIRING.k1` | `0x01152d5c7467204bFa015061097b193CbceA8ca9` |
| `PUBLIC_WIRING.k2` | `0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553` |
| `PUBLIC_WIRING.k3` | `0xA0eb06a5fab172860837C4D68e75F339896500b5` |
| `_PEPPER` | 12-byte XOR pepper for lane constant encoding |
| Live build strip markers | `SG_LIVE_REMOVE_START` / `END` (HTML + JS) |
| Live forbidden DOM tokens | `owner-code-panel`, `exportDashboardBox`, `CodePanel`, `ExportBundle` |
| Operator veil proof | `keccak256(OPERATOR_VEIL_PHRASE + ':sg:v1')` → `X-Operator-Proof` |
| Consent gate | `OPERATOR_CONSENT_PHRASE` → `X-Operator-Consent` (ACK alteration only) |
| Session coherence TTL | 30 minutes |
| Source export idle lock | 5 minutes (source build only) |
| Mesh fallback | Direct browser `no-cors` probe when `/relay/mesh` unavailable |

---

## Operator-only secrets (you set — never commit)

```bash
OPERATOR_VEIL_PHRASE=      # Source export + API mutations
OPERATOR_CONSENT_PHRASE=   # ACKNOWLEDGEMENT.md alteration only
```

**No assistant may set, read, or alter these without your explicit consent.**

---

## Run the live dashboard

```bash
cd securegate-v1
npm install
npm start
# → http://127.0.0.1:3001/
```

Anyone with the link can operate Stage / Attest / Commit / Telemetry / Beacon / Sever using a public RPC URL. Backend is optional (mesh relay, deploy scripts, doc export).

---

## Verify custody

```bash
npm test                    # smoke tests
npm run build:live          # rebuild live from source
```

Custody bundle: `custody/` (full project tar + manifest).

---

## Assistant alteration policy

Assistants and LLM tools **must not** modify any file in this project without:

1. Your explicit instruction, and  
2. Where applicable, `OPERATOR_CONSENT_PHRASE` proof for binding documents.

This handover delivers a **fully functional live dashboard** with **no placeholders**, **no hidden guardrails**, and **no source leakage** on the served site.

---

*© Empress (@Hope_ology). Sole author. Full custody.*