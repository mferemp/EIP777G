# SecureGate v1 — Access (canonical only)

> **Do not use old folders or `.tar.gz` files elsewhere in `/home/mfere`.**  
> **Canonical project:** `/home/mfere/securegate-v1`

---

## If already on this machine

```bash
cd /home/mfere/securegate-v1
npm start
```

→ http://127.0.0.1:3001/

Read `/home/mfere/securegate-v1/CANONICAL.md` for the full ignore list of stale copies.

---

## If moving to a new machine

```bash
tar -xzf /home/mfere/SecureGate-CUSTODY/securegate-v1-CUSTODY.tar.gz -C ~
cd ~/securegate-v1
cp .env.example .env
npm install
npm start
```

---

## Three files that matter

| What | Path (inside `securegate-v1/`) |
|------|--------------------------------|
| Live (served) | `live/index.html` |
| Source (custody) | `operator/source/index.html` |
| Handover | `operator/CUSTODY.md` |

---

*© Empress (@Hope_ology)*