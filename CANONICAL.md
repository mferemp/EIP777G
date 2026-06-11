# SecureGate v1 — Canonical Build (only copy)

> **Project root:** `/home/mfere/securegate-v1`  
> Old snapshots and duplicate archives have been removed (2026-06-10).

---

## Run

```bash
cd /home/mfere/securegate-v1
cp .env.example .env
npm install
npm start
```

→ http://127.0.0.1:3001/ serves `live/index.html`

---

## Key paths

| Purpose | Path |
|---------|------|
| Live (served) | `live/index.html` |
| Source (custody + export) | `operator/source/index.html` |
| Handover | `operator/CUSTODY.md` |
| Access guide | `operator/ACCESS.md` |
| Public docs (Helix Fabric) | `docs/public/` |
| Confidential spec | `docs/confidential/` |

Root `index.html` mirrors `operator/source/index.html` — **not** what the server serves.

---

## Portable backup

`/home/mfere/securegate-v1/custody/securegate-v1-CUSTODY.tar.gz`

---

## Verify

```bash
npm test   # 55 passed, 0 failed
```

---

## Not part of this dashboard app

Solidity contract repos (separate): `securegate/`, `securegate2/`, `eip777g-mainnet/`

---

*© Empress (@Hope_ology) — sole author*