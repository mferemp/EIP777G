# Carryover Prompt — Next Session

## Current State (as of last session)
- Canonical live URL: `https://gate777.vercel.app`
- Last successful build ID: `323d3f4d584b-20260623033522`
- Live deployment pre-alias URL: `eip777g-4yr4sg2gv-mferemp-6005s-projects.vercel.app`
- Alias target for production: `gate777.vercel.app`
- Footer: finalized and verified; do not touch bottom-right or branding

## Completed Work
1. Fixed broken CSS brace balance that prevented the bottom-right footer override from applying.
2. Applied full bottom-right footer override (teal envelope, thank-you popover, @hope_ology).
3. Reordered left-column sidebar to explicit spec.
4. Added center-notice CSS and inserted center `.center-notice-box` HTML for STANDALONE OPERATION + SecureGate acknowledgement.
5. Swapped `verify-directions` and `session-termination` inside the K1 panel so the order is now correct.
6. Deployed Vercel build and alias confirmed exit 0.
7. Browser visual confirmed sidebar order as intended after reorder.

## Outstanding Work (do not skip)
- The `.center-notice-box.standalone-operation-box` and `.center-notice-box.securegate-ack-box` injected into `.main-panel` are **not visible** in the live render because the lock overlay is likely covering them.
- The sidebar still contains a `standalone-operation-box` inside `scan-wrap` (confirmed via `document.querySelector('.standalone-operation-box').parentElement.className === 'scan-wrap'`).
- User's hard rules:
  - Bottom-right is frozen. Do not touch.
  - STANDALONE OPERATION must be in `.main-panel`, not inside `.sidebar`, not inside `scan-wrap`.
  - The gold SecureGate acknowledgement box must appear in `.main-panel` directly below the STANDALONE OPERATION notice.
  - The left column must contain only auth/sidebar material, ending with the caution/admin block.
  - Items 5 and 6 in the left column must remain in the corrected order (verify-directions BEFORE session-termination).

## Exact Next Steps (execute in order)
1. Inspect `index.html` around `.main-panel` and confirm whether `.center-notice-box` elements exist above the lock overlay.
2. If `.center-notice-box` markup is already present but hidden, fix visibility/layout so it appears above the auth overlay.
3. Ensure `.standalone-operation-box` is fully removed from `.sidebar` and `scan-wrap`.
4. Ensure `.center-notice-box.standalone-operation-box` is placed inside `.main-panel`, before the lock overlay/gold acknowledgement pair.
5. Run restore-last-known-good check if any patch fails (see prior `vercel`/alias commands).
6. Rebuild and redeploy: `node scripts/build-live.cjs && npm run obfuscate && vercel build --target production --yes && vercel deploy --prebuilt --prod --yes && vercel alias set eip777g-4yr4sg2gv-mferemp-6005s-projects.vercel.app gate777.vercel.app`
7. Verify with `curl` cachebust and browser visual/inspect:
   - `.sidebar` does NOT contain `standalone-operation-box`
   - `.main-panel` contains `.center-notice-box.standalone-operation-box`
   - `.main-panel` contains `.center-notice-box.securegate-ack-box`
   - Left column ends with caution/admin block
   - Bottom-right footer unchanged

## File Paths to Touch
- `C:\\Users\\mfere\\EIP777G\\index.html` only for HTML/CSS layout moves.
- Do not edit footer files, footer CSS, thank-you envelope HTML, contracts, relay, routes, build pipeline.

## Important Constraints
- Keep `id="auth-bypass-trigger"` on the admin button.
- Preserve all existing CSS styling/classes where possible; use `.center-notice-box` styles already defined in the `<style>` block (CENTER NOTICE BOXES section).
- Preserve left-column order classes (`.auth-mechanism-block`, `.genesis-k1-verify-panel`, `.caution-block`).
- Footer override block (`FINAL BOTTOM-RIGHT FOOTER OVERRIDE`) is frozen.