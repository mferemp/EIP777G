# SecureGate v1 — Verification Report

> Updated: 2026-06-10 (full sweep)  
> **Only location:** `/home/mfere/securegate-v1`

---

## Sweep complete

All extraneous copies removed. Nothing else under `/home/mfere` except this project.

| Deleted | Type |
|---------|------|
| `securegate/` | Old contract repo |
| `securegate2/` | Old contract repo |
| `eip777g-mainnet/` | Old contract repo |
| `SecureGate-CUSTODY/` (top-level) | Merged into `securegate-v1/custody/` |
| All prior snapshot dirs & archives | Removed earlier |
| `server/gate.js` | Orphan duplicate |
| `scripts/deploy-bundle.DISABLED` | Disabled junk |
| `recovery.log` | Stale runtime log |

---

## What remains

```
/home/mfere/securegate-v1/     ← only copy
├── live/index.html            ← served
├── operator/source/index.html ← custody source
├── docs/public/               ← Helix misdirection
├── docs/confidential/         ← spec truth
├── custody/                   ← portable tar
└── .env                       ← your secrets (not in tar)
```

---

## `.env` status

| Field | Status |
|-------|--------|
| Lane addresses | Match on-chain |
| AUTH_WINDOW | 3600 |
| MIN_DELAY | 900 |
| Keys + RPCs | Preserved |
| OPERATOR_VEIL_PHRASE | **You set** |
| OPERATOR_CONSENT_PHRASE | **You set** |

---

## Tests

```bash
cd /home/mfere/securegate-v1 && npm test
# 55 passed, 0 failed
```

---

*© Empress (@Hope_ology)*