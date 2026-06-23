# Carryover Prompt — EIP777G / SecureGate

## How to use this prompt
Start a new session and paste this entire document verbatim. It contains the full operational context needed to continue work on the EIP777G Vercel deployment without rehashing prior debugging.

---

## Current State (as of last session)
- Canonical live URL: `https://gate777.vercel.app`
- Last successful build ID: `7bca8c9b944e-20260623040725`
- Live deployment pre-alias URL: `eip777g-dndgfts73-mferemp-6005s-projects.vercel.app`
- Alias target for production: `gate777.vercel.app`
- Footer: finalized and verified; do not touch bottom-right or branding

## Completed Work
1. Fixed lock-overlay center stack order: `STANDALONE OPERATION` now appears before the gold `BY USING SECUREGATE...` acknowledgement.
2. Removed duplicate center notice boxes that were rendering outside the lock overlay.
3. Restored `id="scan-status"` to the verify-link-copy element under LINK DEVICE in the K1 panel.
4. Confirmed left column order: SCAN → Authentication Mechanism → Genesis K1 address (LINK DEVICE only) → verify-directions → session-termination → caution/admin.
5. Rebuilt live assets: `node scripts/build-live.cjs && npm run obfuscate`
6. Redeployed to Vercel and reset alias: `vercel build --target production --yes && vercel deploy --prebuilt --prod --yes && vercel alias set eip777g-dndgfts73-mferemp-6005s-projects.vercel.app gate777.vercel.app`
7. Verified with `curl` + Python urllib: exactly one `.center-notice-box.standalone-operation-box` and one `.center-notice-box.securegate-ack-box` inside the lock overlay, `id="scan-status"` present, footer intact.
8. Committed changes locally as `cb12d96` ("Fix center lock overlay order: standalone before ack, restore scan-status").

## Outstanding Work
- GitHub push is blocked in this environment because write credentials are not available. Local commit `cb12d96` has not been pushed to remote.
- If the user later provides GitHub auth, push with: `cd C:\Users\mfere\EIP777G && git push origin main` (or the appropriate branch).

## Hard Rules (do not violate)
1. Bottom-right footer is frozen: teal envelope, thank-you popover, `@hope_ology`, `BUILT BY EMP`. Do not edit footer files, footer CSS, thank-you envelope HTML, contracts, relay, routes, or build pipeline.
2. `STANDALONE OPERATION` must live inside `.main-panel` within the lock overlay, above the gold acknowledgement box. It must NOT be inside `.sidebar` or `scan-wrap`.
3. The gold SecureGate acknowledgement box must remain in `.main-panel` directly below the STANDALONE OPERATION notice.
4. The left column must contain only auth/sidebar material, ending with the caution/admin block.
5. Items in the left column must remain in the corrected order: SCAN → auth mechanism → K1 panel (LINK DEVICE only) → verify-directions → session-termination → caution/admin.
6. RPC configuration text must read: "Chain reads use the server-supplied RPC configuration. RPC is not part of the auth gate." The old sentence "The RPC endpoint you supply is its sole network contact." must remain at count 0.

## If You Need to Make Changes
- Only edit `C:\Users\mfere\EIP777G\index.html` for HTML/CSS layout moves.
- After any patch: run `node scripts/build-live.cjs && npm run obfuscate`
- Then rebuild and redeploy:
  `vercel build --target production --yes && vercel deploy --prebuilt --prod --yes`
- Update alias if the pre-alias URL changed:
  `vercel alias set <new-pre-alias-url> gate777.vercel.app`
- Always verify with curl before declaring success:
  - `.sidebar` must NOT contain `standalone-operation-box`
  - `.main-panel` must contain `.center-notice-box.standalone-operation-box`
  - `.main-panel` must contain `.center-notice-box.securegate-ack-box`
  - `id="scan-status"` must be present under LINK DEVICE
  - Footer branding must be intact

## File Paths
- `C:\Users\mfere\EIP777G\index.html` — main source
- `C:\Users\mfere\EIP777G\live\index.html` — generated public asset
- `C:\Users\mfere\EIP777G\live\build.json` — build metadata
- `C:\Users\mfere\EIP777G\live\BUILD_HASH.txt` — build hash
- `C:\Users\mfere\EIP777G\CARRYOVER.md` — this file

## Key Invariants
- Exactly one `STANDALONE OPERATION` notice in the center panel.
- Exactly one gold SecureGate acknowledgement below it.
- Left column ends with caution/admin block; no standalone box in sidebar.
- Footer remains bottom-right unchanged.
