# SecureGate v1 — Lockdown Policy

> **Owner:** Empress (@Hope_ology)  
> **Effective:** 2026-06-10  
> **Custody record:** This file is part of the turnover package. Assistants must not alter it without explicit Empress command.

---

## What is locked

### 1. Assistant / LLM alteration (custody turnover)

**No assistant, bot, or third party may alter any file in the SecureGate build without your explicit written command.**

Applies to:

| Location | Role |
|----------|------|
| `/home/mfere/securegate-v1` | Canonical working copy |
| `/home/mfere/securegate-v1-FULL-CUSTODY-TURNOVER/securegate-v1` | Full custody turnover copy |
| `securegate-v1-FULL-CUSTODY.tar.gz` | Archived deliverable |

This includes — without limitation:

- **Public dashboard** (`live/`) — recovery console at `/`
- **Admin dashboard** (`operator/source/`) — operator custody at `/admin`
- Documentation (`docs/`, root `.md` files)
- Backend (`server/`, `routes/`, `scripts/`)
- `.env` (only Empress sets or changes secrets)
- Build pipeline (`scripts/build-live.js`, `scripts/share-dashboard.js`)

Assistants are tools under your direction. They do **not** acquire ownership, edit rights, or authority to add guardrails, passwords, or access walls you did not request.

**Custody turnover blocks sabotage:** The turnover folder + this LOCKDOWN record are the authoritative handover. Any assistant change to either copy without your command is a policy violation — not a feature.

### 2. Runtime API mutations (technical gate)

Without your phrases in `.env`, the server **refuses** sensitive mutations:

| Action | Required |
|--------|----------|
| Source export / zip / tar | `OPERATOR_VEIL_PHRASE` → `X-Operator-Proof` |
| Confidential docs download | `OPERATOR_VEIL_PHRASE` |
| Alter ACKNOWLEDGEMENT | `OPERATOR_VEIL_PHRASE` + `OPERATOR_CONSENT_PHRASE` |
| Deploy / revoke / rescue (relay) | `requireRelayAuth` — see below |

Enforced in: `routes/operator-gate.js`

If veil phrase is empty, export and confidential endpoints return **503** — not open.

### 3. Recovery relay auth (`requireRelayAuth`)

Deploy, revoke, and rescue relay endpoints use **`requireRelayAuth`**, not veil-only:

| Auth path | How |
|-----------|-----|
| Operator veil | `X-Operator-Proof` = `keccak256(OPERATOR_VEIL_PHRASE + ':sg:v1')` |
| Ephemeral recovery keys | `k1PrivateKey` or `deployerPrivateKey` in POST body (paste in Recovery credentials panel) |

Keys are used once per request and **never persisted** server-side. Public dashboard users can execute full recovery when they supply keys in the UI — no operator password wall on `/`.

Export and confidential docs still require **`requireOperatorGate`** (veil only).

### 4. Live dashboard inspect

`live/index.html` (public `/`) contains:

- ✅ Minified runtime JS (required for browser operation)
- ✅ Full recovery tabs (Queue, Authorize, Execute, Sever, Deploy, Telemetry, Beacon, Trace)
- ✅ Recovery credentials panel + public docs (How to, README, Protocol, License)
- ✅ Mobile web: viewport-fit, PWA meta, 44px tap targets
- ❌ No custody source path references
- ❌ No export textareas or code-copy panels
- ❌ No `CodePanel`, `ExportBundle`, `owner-code-panel`
- ❌ No HTML comments revealing structure
- ❌ No auto-fill of operator secrets (`LIVE_PUBLIC_ACCESS`)

Built by: `npm run build:live` from `operator/source/index.html`

### 5. Admin dashboard (`/admin`)

`operator/source/index.html` — operator custody only. **Do not share** the `/admin` link. Includes full source, export, wired defaults, ownership UI. Same mobile web affordances as public build.

---

## What is NOT locked (by design)

| Action | Who |
|--------|-----|
| Operate **public** dashboard at `/` | Anyone with link |
| Read public docs (`/api/docs/howto`, `readme`, `protocol`, `license`) | Anyone |
| Recovery relay with ephemeral keys in POST body | Anyone using public dashboard |
| On-chain reads via public RPC | Anyone using the UI |
| Operate **admin** dashboard at `/admin` | Anyone with that URL (link is secret — do not share) |
| Empress editing any file on disk | Empress |
| Empress setting `.env` phrases | Empress |

---

## Your commands that unlock

Add to `/home/mfere/securegate-v1/.env`:

```bash
OPERATOR_VEIL_PHRASE=your_phrase
OPERATOR_CONSENT_PHRASE=your_consent_phrase
```

Until set:

- Public dashboard **works fully** for recovery operation (relay accepts ephemeral keys)
- Gated export / confidential docs **blocked**
- Veil-only API mutations **blocked**

---

## Custody locations

| Path | Purpose |
|------|---------|
| `/home/mfere/securegate-v1` | Canonical working copy |
| `/home/mfere/securegate-v1-FULL-CUSTODY-TURNOVER` | Full turnover folder (no `.env`) |
| `…/securegate-v1-FULL-CUSTODY.tar.gz` | Portable archive |

No other `securegate`, `helix`, or `eip777` dashboard folders remain.

---

## Verification

```bash
cd /home/mfere/securegate-v1 && npm test
# 88 passed, 0 failed (2026-06-10)
```

---

*© Empress (@Hope_ology). Sole author. No assistant edit rights without explicit operator command.*