# SecureGate v1 — Access (canonical only)

> **One project directory:** `/home/mfere/securegate-v1`  
> Only copy on disk. Extraneous repos swept 2026-06-10.

---

## Run

```bash
cd /home/mfere/securegate-v1
cp .env.example .env
npm install
npm start
```

→ http://127.0.0.1:3001/ (serves `live/index.html`)

---

## Three files that matter

| What | Path |
|------|------|
| Live (served) | `live/index.html` |
| Source (custody) | `operator/source/index.html` |
| Handover | `operator/CUSTODY.md` |

---

## Docs

| Layer | Path |
|-------|------|
| Public (Helix Fabric) | `docs/public/` |
| Confidential (spec) | `docs/confidential/` |

---

## Verify

```bash
npm test   # 71 passed

Full custody: `/home/mfere/securegate-v1-FULL-CUSTODY-TURNOVER`
```

---

*© Empress (@Hope_ology)*