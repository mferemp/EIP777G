# SECUREGATE — EIP-777G DEFINITIVE SPECIFICATION

**Single source of truth for all Auth-Gate, Session Termination, and Contract Completion behavior.**

---

## AUTH-GATE

Genesis scan looks for proof you're the original K1 owner on this device, not whoever is holding the key now. The exact 4‑artifact set is hidden so attackers cannot mimic the expected pattern.

Auth-Gate is an advisory ownership check, not a final ruling. It can miss valid owners, and you may attempt verification on up to three devices per K1.

If you still cannot clear Auth-Gate but can prove you are the original key holder, DM @hope_ology on X/Twitter. DMs are more likely to be seen if you follow first.

Once a K1 passes, it auto-fills where required and is bound to a proof‑of‑ownership passkey to avoid K1 swapping risk. Each K1 requires its own Auth-Gate passkey. After a K1 passkey has been issued, no further scans are required for that K1.

---

## SESSION TERMINATION

SCRUB kills the session and immediately deletes all verification data and input from memory.

On SCRUB, ESC, idle timeout, or tab close, all operator input is purged. No keys, addresses, or credentials are ever stored, logged, or transmitted to any server; the dashboard runs entirely in your browser.

---

## CONTRACT COMPLETION LOGIC

### Genesis Lock (EIP777G) - Immutable State at Deployment

**Core Addresses (immutable, set once):**
- **K1** - Genesis EOA (compromised wallet being gated)
- **K2** - Air-gapped authorization gate (genesis owner's offline key)
- **K3** - Drop destination (clean wallet)
- **Clean Wallet** - Additional verified genesis wallet for severance

### K1 Queue Phase
1. K1 queues intent (target, value, data, gas limit, nonce)
2. Intent hash: `keccak256(target, value, data, gasLimit, nonce, timestamp)`
3. Intent stored immutably on-chain
4. K1 cannot move value; only K2 can authorize
5. Rate guard: max 50 attempts per K1, then auto-blacklist

### K2 Authorize Phase
1. K2 reviews queued intent
2. K2 signs authorization with `k2Authority` private key
3. K2 specifies override destination (can differ from original target)
4. Authorization window: must occur within `authWindow` seconds
5. Signature validated via `ECRECOVER`

### Execute Phase
1. Anyone can execute (permissionless)
2. Validates: K2 signature, authorization window, gas cap (8M wei)
3. Executes call to target with K2-chosen destination override
4. Sweep assets: ERC20 (balanceOf + transfer), ERC721 (ownerOf + safeTransferFrom)
5. Reentrancy guard active
6. Event emitted: `IntentExecuted(intentHash, success)`

### Severance Phase (Irreversible)
1. **Ingress severance**: Blocks new K1 intents (can only be called by K2 or Clean Wallet)
2. **Egress severance**: Blocks all value movement from K1 (can only be called by K2 or Clean Wallet)
3. Once severed, cannot be undone
4. Ensures K1 is permanently nullified to hacker

---

## DASHBOARD SECURITY MODEL

### Before Auth-Gate Unlock
- **Locked state**: Dashboard displays only Auth-Gate verification panel
- **Zero server access**: All verification logic runs locally in browser
- **Isolated context**: No authenticated endpoints accessible
- **CSP hardened**: `default-src 'self'` — no external data loads

### After Auth-Gate Unlock
- **Session-bound K1**: User's verified K1 address bound to session
- **Local storage only**: K1 address stored in session memory (RAM), never persisted
- **Passkey generation**: One-time bypass keys issued by admin for failed Auth-Gate attempts
- **Admin-only key generation**: Generated via master passkey system (not exported, user-only)

### SCRUB / Session End
- All operator input purged from memory
- K1 address cleared
- Session terminated
- Dashboard requires new Auth-Gate verification

---

## OBFUSCATION & SECURITY

**Frontend obfuscation:**
- Terser minification
- JavaScript Obfuscator with RC4 string array encoding
- gate.js excluded from obfuscation (audit trail)

**Backend hardening:**
- One-time bypass token enforcement (Redis KV tracking)
- K1-bound tokens (cannot be passed to other wallets)
- HMAC validation (ADMIN_TOKEN_SECRET)
- TTL enforcement (24-hour expiration)
- Rate limiting (50 attempts per K1)
- Auto-blacklist on threshold breach
- Gas cap enforcement (8M wei, whitelisted bypass)
- Reentrancy guard on all state mutations

**CSP:** `default-src 'self'` — no external code or data loads except via permitted channels

---

## ADMIN MASTER PASSKEY SYSTEM

**Master Passkey (Admin-Only):**
- Generated locally: `SHA256(your_strong_passkey)`
- Hash stored in `MASTER_PASSKEY_HASH` env var
- Input via hidden admin button on dashboard
- Unlocks key generation UI
- Cannot be used as user bypass token

**User Bypass Tokens:**
- Generated via `/api/generate-user-key` (requires master passkey hash validation)
- Format: `base64url(JSON.stringify({ k1, nonce, exp, hmac }))`
- Each token bound to specific K1 address
- One-time use (tracked in Redis via `bypass_used:${nonce}`)
- 24-hour expiration
- HMAC validated with `ADMIN_TOKEN_SECRET`

**Workflow:**
1. User fails Auth-Gate 3 times on multiple devices
2. User proves ownership to admin via @hope_ology Twitter DM
3. Admin generates token: `node scripts/generate-user-key.cjs "0xK1addr" "24h"`
4. Admin sends token to user
5. User pastes token → Auth-Gate bypassed once
6. K1 bound to new passkey issued for future visits

---

## TWITTER BURNER INTEGRATION

**Burner Account:** @whiskeystr8shot (controlled by admin)
**Burner Password:** `process.env.burnerxaccount`
**DM Recipient:** @hope_ology (operator receiving manual override requests)

**Flow:**
- User unable to pass Auth-Gate → DMs @hope_ology on Twitter
- Operator (@hope_ology) receives DM request
- Operator verifies ownership (pre-agreed proof method)
- Operator generates one-time bypass token locally
- Operator sends token to user
- Optional: Burner account (@whiskeystr8shot) auto-sends thank-you DM to @hope_ology

---

## VERSIONING & BUILD

**Build Metadata:**
- `meta[name="securegate-build"]` contains git commit + timestamp
- Last verified build: `6231ae838467-20260621193929`
- Deployed to: https://eip777g.vercel.app/

**Branch:** `auth-gate-tightening` (upstream: `mferemp/EIP777G`)
**Live Deployment:** Vercel (auto-deployed on push to main)

---

*Consolidation date: 2026-06-28*
*Authority: Empress (@Hope_ology)*
*No further iterations — this is the spec.*
