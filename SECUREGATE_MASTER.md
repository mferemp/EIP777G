# SecureGate EIP-777G — Master Handoff
**Branch:** `auth-gate-tightening` | **Last commit:** `2f501ed` | **Date:** 2026-06-29

---

## Why Previous Builds Kept Failing

Every prior session patched HTML on top of JS rewrites. Two files made patches impossible:

- `js/envelope-fix.js` — rewrote sidebar DOM and footer at `DOMContentLoaded`, undoing every HTML fix
- `js/dashboard-wiring.js` — moved elements in DOM at runtime, overriding HTML structure
- `build-live.cjs` — stripped inline `<script>` blocks on every build

**Resolution:** `live/index.html` is now a single self-contained file. Those three files are dead and must never be loaded again. Only `gate.js` and `app.js` are loaded as `<script src>` tags.

---

## File Map

```
live/
  index.html                  ← THE ONLY FILE THAT MATTERS. Self-contained.
  js/
    gate.js                   ← On-chain genesis sweep engine (obfuscated, sealed)
    app.83cf614621ff-*.js     ← Deploy + contract wiring (obfuscated, sealed)
    envelope-fix.js           ← DEAD — do not load
    dashboard-wiring.js       ← DEAD — do not load
    api-client.js             ← DEAD — do not load
  vendor/                     ← External libs (ethers, etc.) — loaded by app.js
```

---

## Design Tokens

```css
:root {
  --bg:     #080b10;    /* page background */
  --sur:    #0d1018;    /* surface (topbar, sidebar) */
  --bdr:    #1e2438;    /* border */
  --bdr2:   #131826;    /* faint divider */
  --teal:   #00e8dd;    /* AUTH-GATE heading, input focus, STANDALONE title */
  --gold:   #f5c23a;    /* K1 label, EIP-777G subtitle, ACK box, funding totals */
  --mag:    #ff4fd8;    /* SCRUB btn, scan ring, LINK DEVICE, AUTH-GATE points, envelope text */
  --orange: #ff9a1a;    /* DASHBOARD LOCKED, CAUTION */
  --red:    #e53e3e;    /* errors, bad-actor text */
  --text:   #dde3ee;    /* body copy */
  --muted:  #7a8499;    /* secondary / placeholder */
  --faint:  #2e3650;    /* very faint / inactive */
  --sw:     264px;      /* sidebar width */
}
```

### Color Rules
- **Left sidebar accents** — pink (`--mag`). Scan ring, LINK DEVICE, K1 input focus, instruction highlights.
- **AUTH-GATE heading** — teal (`--teal`). The deliberate swap from the pattern above.
- **SCRUB button** — solid pink bg, `#000` text.
- **Power button** — gold ring.
- **SECUREGATE wordmark** — teal→pink `linear-gradient(90deg)`.
- **Admin glyph** — CSS circle with teal top-glow, NOT a Unicode emoji.

### Fonts
- **Body/UI:** `Inter`, `system-ui`, `-apple-system`, `sans-serif` — loaded via Google Fonts
- **Addresses / inputs / code:** `'Courier New', Courier, monospace` — scoped, not global

---

## Structural Layout

```
#topbar (fixed, 42px)
  #identity         → SECUREGATE (gradient) / EIP-777G (gold)
  #topbar-right     → SCRUB (pink) | Power (gold ring)

#shell (fixed, top:42px, flex-row)
  #sidebar (264px, scrollable)
    .scan-wrap        → 3-ring SCAN button + label
    .locked-block     → Dashboard Locked / Genesis Owner Required
    .k1-panel         → K1 label → address input → LINK DEVICE → status
    .instructions     → Same device / Different device hints
    .authgate-block   → AUTH-GATE heading + 7 points + fallback msg
    .caution-block    → CAUTION + admin glyph (⚫-') + bypass panel

  #center (flex:1, relative)
    #dash-bg          → faint grid overlay (always visible)
    #main-dash        → POST-AUTH DASHBOARD (hidden until auth passes)
      .db-section     → DEPLOYMENT BUNDLE (6-field grid)
      .revoke-section → REVOKE TARGETS table
      .db-bottom-row  → DEPLOYMENT PROGRESS + SMOKE TEST (2-col grid)
    #lock-overlay     → PRE-AUTH SCREEN (fades out on success)
      .standalone-box → STANDALONE OPERATION notice (teal border)
      .ack-box        → NFA acknowledgement (gold border)

#footer-cluster (fixed, bottom-right)
  #env-wrap           → envelope + popup
  #built-by           → BUILT BY EMP ❖ @hope_ology

#version-badge (fixed, bottom-LEFT, single instance)
  .sdot + status text → pink dot at rest → gold on auth
```

---

## Auth Flow

### Pre-auth state
- `#lock-overlay` covers `#main-dash` (opacity:0, pointer-events:none on `#main-dash`)
- `#main-dash` has class `visible` absent

### Sweep trigger
1. User enters K1 address → clicks SCAN (same-device) or LINK DEVICE (USB)
2. `startSweep(path)` fires:
   - K1 input locked immediately
   - Scan ring goes `active` (fast spin)
   - 4-artifact check sequence runs (2 per step @ 520ms interval)

### 4-Artifact Check (gate.js fallback — gate.js has no exports)
```
Artifact 1: localStorage first-visit timestamp ≥ 7 days old
Artifact 2: Canvas/WebGL fingerprint present (always true in real browser)
Artifact 3: K1 address matches 0x + 40-hex format
Artifact 4: sessionStorage return-visit counter > 1
```
**2 or more matched = PASS.** First scan of a valid address always hits artifacts 2+3 = pass.

If `window.runGenesisSweep` is ever defined by `gate.js`, it takes over entirely.

### Post-auth state (`onSuccess()`)
```js
auth = true
lockOv.classList.add('unlocked')      // overlay fades out
mainDash.classList.add('visible')     // dashboard fades in
sdot.classList.add('auth')            // dot turns gold
statusTxt = '777G v1.0 · AUTHENTICATED'
sessionStorage.setItem('sg_auth_passed','1')  // persists across page refresh
dashWireInputs()                      // wires all dashboard inputs
```

### Purge (`purge()` — called by SCRUB, power, ESC, tab-close, idle)
- Clears all state, inputs, flags
- Removes `visible` from `#main-dash`, removes `unlocked` from `#lock-overlay`
- Removes `sg_auth_passed` from sessionStorage
- Resets scan ring, labels, status text, dot color

---

## Dashboard Sections (post-auth)

### DEPLOYMENT BUNDLE
6-field grid (3 columns):
| Field | Type | Notes |
|---|---|---|
| Deployer Private Key | `<input type=password>` | Eye toggle, derives address below |
| K1 Key (will be nullified) | `<input type=password>` | Eye toggle, derives K1 address |
| K2 Authorization Address | `<input type=text>` | `0x...` |
| K3 Egress Address | `<input type=text>` | `0x...` |
| Network | `<select>` | 15 options, auto-fills RPC URL |
| RPC URL | `<input type=text>` | Pre-filled by network select |

**DEPLOY BUNDLE button** — pink CTA, disabled until all 4 required fields have >10 chars.

Action buttons: `CALCULATE FUNDING` (teal outline) | `SCAN REVOKE TARGETS` (teal outline)

### REVOKE TARGETS TABLE
Columns: TOKEN | SPENDER | TYPE | ACTION
Populated by `SCAN REVOKE TARGETS`. Empty state: "Run SCAN REVOKE TARGETS to populate"

### DEPLOYMENT PROGRESS (left of bottom row)
5 steps with dot indicators:
- `funding` → `revoke` → `deploy` → `store` → `smoke`
- Dot states: idle (dark) → active (teal glow) → done (gold) → error (red)
- Segmented progress bar: teal / pink / purple stripes, matches reference image
- Percentage counter, log text below bar

Window-exposed for `app.js`:
```js
window.dashStepActive(step)
window.dashStepDone(step, msg)
window.dashStepError(step, msg)
```

### SMOKE TEST (right of bottom row)
- Results list: `.smoke-check.pass` (gold dot) / `.smoke-check.fail` (red dot)
- Contract address display below results

---

## Envelope (Section 5)

- Fixed bottom-right, above footer, `transform:rotate(-5deg)`
- SVG `viewBox="0 0 120 80"`: teal body (`#ev-body`), darker flap (`#009990`), fold lines
- **THANK YOU** text: `fill:var(--mag)` pink, `font-size:14` SVG units, `y="50"` (body center)
- Click opens `#env-popup` (pink-framed, above envelope)
- Popup: note textarea + full address + click-to-copy + SEND button
- SEND opens `twitter.com/messages/compose?recipient_id=hope_ology`

---

## Footer (Section 6)

```html
<div id="built-by">
  <span>BUILT BY EMP</span>
  <span class="knot">❖</span>   <!-- magenta, --mag -->
  <a href="https://x.com/hope_ology">@hope_ology</a>   <!-- teal -->
</div>
```

---

## Admin Glyph ⚫-'

**Why Unicode `⚫` fails:** U+26AB is a colored emoji — the browser renders it as an emoji tile and ignores CSS `color`. It is invisible on dark backgrounds.

**Current implementation (correct):**
```html
<button id="admin-glyph">
  <span class="ag-circle"></span>   <!-- CSS circle with teal top-glow -->
  <span class="ag-dash">-'</span>   <!-- Courier New text -->
</button>
```

```css
.ag-circle {
  width:11px; height:11px; border-radius:50%;
  background: radial-gradient(circle at 40% 30%, #18181f, #020205);
  border: 1px solid rgba(0,232,221,.7);
  box-shadow: 0 -4px 10px rgba(0,232,221,.65), 0 0 5px rgba(0,232,221,.25),
              inset 0 0 5px rgba(0,0,0,.95);
}
```

Clicking toggles `#admin-bypass` panel. `window.verifyAdminKey(addr, key, cb)` must be defined by `gate.js` for bypass to work. If undefined, panel shows "Bypass verification unavailable."

---

## Security Behaviors

| Trigger | Action |
|---|---|
| SCRUB button | `purge()` — full state wipe |
| Power button | `purge()` |
| ESC key | `purge()` |
| Tab hidden (`visibilitychange`) | `purge()` |
| `beforeunload` | `purge()` |
| 15-min idle | `purge()` |
| Auth pass | Auto-scrub verification data after 800ms |
| Session restore | `sessionStorage.getItem('sg_auth_passed') === '1'` → `onSuccess()` |

Nothing is ever stored, logged, or transmitted. All crypto runs in-browser. RPC URL is the only network contact.

---

## Scripts Loaded (in order)

```html
<!-- 1. Inline JS — all UI, auth, dashboard, purge logic -->
<script>(function(){ ... })();</script>

<!-- 2. gate.js — genesis sweep engine (obfuscated) -->
<script src="js/gate.js"></script>

<!-- 3. app.js — deploy + contract wiring (obfuscated) -->
<script src="js/app.83cf614621ff-20260629080442.js"></script>
```

**app.js version pinning:** The filename includes a content hash. When `app.js` is updated, update the `src=` attribute in `live/index.html` to match the new filename. Never reference the old hash.

---

## What MUST NOT Change

- Module placement (sidebar order, center layout, footer position)
- `#version-badge` — single instance, fixed bottom-left only
- `#footer-cluster` — fixed bottom-right, envelope above `#built-by`
- Inline `<script>` block position — must remain before `gate.js` and `app.js`
- `window.dashStepActive` / `window.dashStepDone` / `window.dashStepError` names — `app.js` calls these

## What Can Change (cosmetic only)

- Token values in `:root` (colors, sizes)
- Font sizes and weights
- Spacing/padding values
- Text copy inside spec constraints
- `app.js` filename when updated (update `src=` only)
