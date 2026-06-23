# EIP777G Carryover Prompt

Start here. This is the full handoff context for continuing the EIP777G UI containment work.

## Canonical Status as of 2026-06-23

- **Repo**: `C:\Users\mfere\EIP777G` on branch `main`
- **Remote**: https://github.com/mferemp/EIP777G.git
- **Live URL**: https://gate777.vercel.app (alias set, points to current Vercel deploy)
- **Last known good UI commit**: `4d4ab90` ("version badge to sidebar bottom, center notices above lock overlay")
- **Current HEAD**: `4f4c406` ("fix(ui): final sidebar order and envelope click repair") — already pushed
- **Working tree**: clean (no uncommitted changes)

## Verified Deploy Chain

Use this exact sequence. Do not skip steps or run in parallel.

```bash
git add index.html
git commit -m "<message>"
git push

node scripts/build-live.cjs
npm run obfuscate
npm run check

vercel build --target production --yes
vercel deploy --prebuilt --prod --yes
vercel alias set <NEW_DEPLOYMENT_URL> gate777.vercel.app
```

## Completed Work

1. Created `scripts/fix-sidebar-envelope-final.cjs` — injects CSS + inline `<script>` to:
   - Force sidebar order: scan → auth → K1 panel → session termination → caution → version badge (sticky bottom)
   - Hide `.sidebar .standalone-operation-box` (center standalone stays untouched)
   - Bind envelope click handler with popover toggle
2. Ran repair script, verified diff only adds the repair block before `</body>` and inside `</style>`
3. Built live assets: `node scripts/build-live.cjs && npm run obfuscate`
4. Committed as `4f4c406` and pushed to remote
5. Redeployed to Vercel and reset alias: `gate777.vercel.app → eip777g-fdxqjxl4u-mferemp-6005s-projects.vercel.app`
6. Curl verification confirms:
   - Exactly one `.center-notice-box.standalone-operation-box` and one `.center-notice-box.securegate-ack-box`
   - `#lock-overlay` present
   - `#status-text` present
   - `#scan-status` present
   - `sidebar-version-badge` present

## BLOCKER: Envelope Click Handler Stripped in Production

**`build-live.cjs` calls `stripInlineScripts`, which removes inline `<script>` blocks from `live/index.html`.**

The envelope click/popover logic lives in `<script id="sg-final-sidebar-envelope-fix">`, so it does not survive the build. The sidebar order CSS is live and effective, but the envelope is non-clickable in production because the JS toggle is missing.

**curl confirms:** `sg-final-sidebar-envelope-fix` count = 0 in the deployed HTML.

## Two Fix Options (pick one)

**Option A — External JS file (preferred, no build-tool changes):**
1. Move the envelope/popover logic from inline `<script id="sg-final-sidebar-envelope-fix">` into a new file `js/envelope-fix.js`
2. Reference it in `index.html` with `<script src="js/envelope-fix.js"></script>`
3. `build-live.cjs` copies `js/*.js` into `live/js/`; external scripts are not stripped
4. Remove the inline `<script id="sg-final-sidebar-envelope-fix">` from `index.html`
5. Keep the CSS block (`/* === SG FINAL SIDEBAR + ENVELOPE FIX START === */`) in `index.html`

**Option B — Whitelist in build-live.cjs:**
1. Edit `scripts/build-live.cjs` so `stripInlineScripts` skips `<script id="sg-final-sidebar-envelope-fix">`
2. Keep inline script as-is

## Hard Rules (do not violate)

1. Bottom-right footer is frozen: teal envelope, thank-you popover, `@hope_ology`, `BUILT BY EMP`. Do not edit footer files, footer CSS, thank-you envelope HTML, contracts, relay, routes, or build pipeline.
2. `STANDALONE OPERATION` must live inside `.main-panel` within the lock overlay, above the gold acknowledgement box. It must NOT be inside `.sidebar` or `scan-wrap`.
3. The gold SecureGate acknowledgement box must remain in `.main-panel` directly below the STANDALONE OPERATION notice.
4. The left column must contain only auth/sidebar material, ending with the caution/admin block.
5. Items in the left column must remain in the corrected order: SCAN → auth mechanism → K1 panel (LINK DEVICE only) → verify-directions → session-termination → caution/admin.
6. RPC configuration text must read: "Chain reads use the server-supplied RPC configuration. RPC is not part of the auth gate." The old sentence "The RPC endpoint you supply is its sole network contact." must remain at count 0.
7. **Do not modify the bottom-right footer, thank-you envelope, or related branding under any circumstance.**

## File Paths

- `C:\Users\mfere\EIP777G\index.html` — main source
- `C:\Users\mfere\EIP777G\live\index.html` — generated public asset
- `C:\Users\mfere\EIP777G\live\build.json` — build metadata
- `C:\Users\mfere\EIP777G\live\BUILD_HASH.txt` — build hash
- `C:\Users\mfere\EIP777G\scripts\fix-sidebar-envelope-final.cjs` — repair script (keep for reference)
- `C:\Users\mfere\EIP777G\scripts\build-live.cjs` — build pipeline (may need patch for Option B)
- `C:\Users\mfere\EIP777G\CARRYOVER.md` — this file

## If You Need to Make Changes

- Only edit `C:\Users\mfere\EIP777G\index.html` for HTML/CSS layout moves
- After any patch: run `node scripts/build-live.cjs && npm run obfuscate`
- Then rebuild and redeploy:
  ```bash
  vercel build --target production --yes && vercel deploy --prebuilt --prod --yes
  ```
- Update alias if the pre-alias URL changed:
  ```bash
  vercel alias set <new-pre-alias-url> gate777.vercel.app
  ```
- Always verify with curl before declaring success:
  - `.sidebar` must NOT contain `standalone-operation-box`
  - `.main-panel` must contain `.center-notice-box.standalone-operation-box`
  - `.main-panel` must contain `.center-notice-box.securegate-ack-box`
  - `id="scan-status"` must be present under LINK DEVICE
  - Footer branding must be intact
  - **`js/envelope-fix.js` must be referenced in `<script src="...">` and present in `live/` deploy**
