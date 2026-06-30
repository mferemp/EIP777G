# SECUREGATE SYSTEM AUDIT & COMPONENT MAPPING

**Comprehensive inventory of all dashboard components, functions, and security layers.**

---

## DASHBOARD HTML STRUCTURE (index.html)

### Locked State (Pre-Auth-Gate)
- **Topbar**: Brand, SCRUB button, power button (logout)
- **Sidebar - Locked**: 
  - Scan ring (100px animated circle with dual borders)
  - "Dashboard Locked" label
  - K1 address input field + SCAN / LINK DEVICE buttons
  - Verification status display
  - "Authentication Mechanism" sidebar block (spec text)
  - "Session Termination" sidebar block (spec text)
  - Version badge ("777G v1.0 · SECURE")
  - Admin button (`⚫-'` hidden, id="auth-bypass-trigger")

### Unlocked State (Post-Auth-Gate)
- **Main Panel**: Forms for:
  - Deployer key input
  - K1/K2/K3/Clean Wallet address inputs
  - RPC URL selection
  - Fund inputs per chain
  - Scan revoke targets button
  - Revoke all button
  - Deploy button

### CSS Design System
- Color palette (CSS vars): black, bg, surface, teal, magenta, gold, grey, text, muted
- Topbar: 38px fixed height, dark background, brand gradient (teal→magenta)
- Sidebar: 220px width, locked above unlock threshold, scrollable below
- Scan ring: dual animated borders with conic gradient, pulse animation on inner ring
- Buttons: clipped trapezoid corners, transition effects (scale, color)
- Grid layout: sidebar (220px) + main panel (1fr)

---

## JAVASCRIPT FILES & FUNCTIONS

### Loaded by Live/index.html
1. **live/js/ethers.min.js** - ethers.js library (ERC20, ERC721, contract interaction)
2. **live/js/gate.js** - Auth-Gate verification logic (obfuscated, unauditable)
3. **live/js/app.[hash].js** - Main app logic (most recent version, obfuscated)
4. **live/js/envelope-fix.js** - ???
5. **live/js/admin-fix.js** - ???

### Key Functions (from HTML onclick handlers)
- `startScan()` - Initiates Auth-Gate marker sweep
- `wipeSession()` - SCRUB button → purges all memory
- `scanRevokes()` - Scans for revoke targets (ERC20/ERC721)
- `deployGate()` - Executes deployment (Flashbots bundle)

### Local Storage & Session State
- **Session-only** (RAM, never persisted): K1 address, K2, K3, auth timestamp
- **No localStorage**: All data purged on session end

---

## OBFUSCATION STATUS

### Obfuscated Files
- `live/js/app.*.js` - Terser minified + JavaScript Obfuscator (RC4 string encoding)
- `live/js/gate.js` - Same obfuscation
- **Result**: Cannot reverse-engineer by inspection; logic protected

### Unobfuscated Audit Trail
- `live/js/ethers.min.js` - Library (external, verified source)
- `index.html` - Structure visible, spec text visible
- `contracts/EIP777G.sol` - Contract source (full transparency)

---

## BACKEND API ENDPOINTS

### Deployed to: https://eip777g.vercel.app/

1. `/api/relay` - Flashbots relay + RPC broadcast
   - Input: { deployerKey, k1, k2, k3, rpc, ... }
   - Output: { txHash, bundleHash, chainId, ... }
   - Security: No server-side K1 storage; relay only

2. `/api/bypass-verify` (NEW) - Master passkey token validation
   - Input: { k1Addr, token }
   - Token format: base64url(JSON.stringify({ k1, nonce, exp, hmac }))
   - Validation: HMAC check, expiration, one-time use via Redis KV
   - Output: { ok: true } or error

3. `/api/generate-user-key` (NEW) - Admin-only token generation
   - Input: { masterPasskeyHash, k1Addr, ttl }
   - Validation: Master passkey hash check
   - Output: { token, expiration, k1 }
   - Security: Requires ADMIN_TOKEN_SECRET + MASTER_PASSKEY_HASH

---

## SECURITY CHECKS & ENFORCEMENT

### Dashboard Lock (Pre-Auth)
- **CSP Policy**: `default-src 'self'` — no external code loads
- **Isolated Context**: Main panel (id="main-panel") hidden until `authGate === true`
- **No API Calls**: All locked-state APIs require Auth-Gate bypass token
- **Local Verification**: All 4-artifact checks run locally in browser

### After Auth-Gate Unlock
- **K1 Session-Bound**: Stores in-memory only; cleared on wipeSession()
- **No Persistence**: sessionStorage/localStorage empty (zero long-term data)
- **Relay-Only**: Backend never receives K1 private key; only deployment intent

### On SCRUB / Session End
- **Memory Purge**: All variables cleared (K1, K2, K3, addresses, nonces)
- **Event Listeners**: Removed to prevent replay
- **Tab Close**: `onbeforeunload` hook purges state

---

## SIGNED COMMITMENTS & IMMUTABLE RECORDS

### Contract Genesis Hash
```solidity
genesisHash = keccak256(abi.encode(
  k1Genesis,
  k2Authority,
  k3DropWallet,
  cleanWallet,
  deployer,
  block.timestamp,
  block.chainid
));
```
- Immutable at deployment
- Acts as tamper-proof proof of intent
- Prevents K1/K2/K3 substitution post-deployment

### Dashboard Build Metadata
- HTML: `<meta name="securegate-build" content="6231ae838467-20260621193929">`
- Git commit + ISO timestamp
- Verifiable via GitHub: https://github.com/mferemp/EIP777G/commits/main

---

## KNOWN CRUFT TO REMOVE

### Old App.js Versions (50+ files)
- `live/js/app.*.js` (all timestamped versions)
- Keep only: latest hash-versioned file + generic `app.js` symlink
- Remove: all others (build artifacts, testing files)

### Old Envelope/Admin Fixes
- `live/js/envelope-fix.js` - Purpose unknown, likely obsolete
- `live/js/admin-fix.js` - Purpose unknown, likely obsolete
- Action: Audit for functionality before removal

### Stale Documentation (Root)
- Multiple *.txt and *.md files in root (ADMIN.txt, BACKEND.txt, etc.)
- All superseded by SPEC-DEFINITIVE.md
- Action: Archive into /old-docs/ or remove

---

## COMPLIANCE CHECKLIST

- [x] Auth-Gate enforces dashboard lock (no server access until bypass)
- [x] No credentials stored (K1/K2 never persisted)
- [x] SCRUB purges memory immediately
- [x] Backend relay has no K1 access
- [x] Obfuscation active (gate.js, app.js)
- [x] CSP hardened (`default-src 'self'`)
- [x] Contract genesis immutable + tamper-proof
- [x] Severance irreversible (K1/K2/Clean only)
- [ ] TODO: Remove old app.js versions
- [ ] TODO: Audit envelope-fix.js + admin-fix.js
- [ ] TODO: Archive stale documentation

