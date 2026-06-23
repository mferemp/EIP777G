# EIP777G Carryover Prompt

Start here. This is the full handoff context for continuing the EIP777G UI containment work.

## Canonical Status as of 2026-06-23

- **Repo**: `C:\Users\mfere\EIP777G` on branch `main`
- **Remote**: https://github.com/mferemp/EIP777G.git
- **Live URL**: https://gate777.vercel.app (alias set, points to current Vercel deploy)
- **Stale domain**: https://securegate-777g.vercel.app → must return 404
- **Last known good UI commit**: `4d4ab90` ("version badge to sidebar bottom, center notices above lock overlay")
- **Current HEAD**: `5aa8ee7` ("fix: remove duplicate dashboard wrapper") — already pushed
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

curl -s https://gate777.vercel.app/build.json
curl -I -s https://gate777.vercel.app | head -n 1
curl -I -s https://securegate-777g.vercel.app | head -n 1
```

## Non-Negotiable Gate: Diff Before Build

Before applying any new patch to `index.html`, you must:

1. Identify the target state (commit or approved diff)
2. Generate the proposed unified diff on a temporary copy (do NOT modify `index.html` yet)
3. Show the diff to the user for approval
4. Only after explicit approval, apply the patch to `index.html`

If the user says "stop" or "revert", do this instead:

```bash
git restore --source=<GOOD_COMMIT> -- index.html
git diff -- index.html
```

Stop. Do not build, deploy, commit, or push until the diff is reviewed.

## Verified Safe Baseline

Commit `4d4ab90` is the approved UI baseline. From it we know:

- `.center-notice-box` blocks are in `.main-panel` above `#dashboard` ✅
- `#lock-overlay` placement may be before `#dashboard` (needs fixing in upcoming patch)
- `.sidebar-version-badge` **absent** in 4d4ab90
- `.dashboard` missing `position: relative;` and `min-height: 0;`
- `checkAuthState()` contains `dashboard.classList.add/remove('hidden')`
- `.sidebar .standalone-operation-box` still has `order: 4 !important;` at multiple locations

## Approved Required Fixes (Not Yet All Applied)

These are the only pending UI changes. Apply them as ONE surgical patch after diff approval:

1. `.dashboard` CSS: add `position: relative;` and `min-height: 0;` (keep `flex: 1`)
2. `#lock-overlay`: move inside `#dashboard` as the first child
3. `checkAuthState()`: remove all `dashboard` references; keep `lock` toggles; add `validateDeployBtn()` call
4. `.sidebar .sidebar-version-badge`: add bottom-pin CSS block (order: 999, margin-top: auto, flex alignment, etc.)
5. Remove `order: 4 !important;` from EVERY `.sidebar .standalone-operation-box` rule in `index.html`
   - If a rule becomes empty after removal, delete the entire rule

## Strict Scope Boundaries

**ONLY touch `index.html` for UI/layout fixes.**

Do NOT modify:
- backend/API files (`api/relay.js`, `api/bypass-verify.js`, etc.)
- contract files
- build scripts (`scripts/build-live.cjs`, `scripts/obfuscate.js`)
- `package.json`
- `vercel.json`
- `.main-panel` structure (except as noted in the 5 fixes)
- `.center-notice-box` placement
- footer, thank-you envelope, branding
- `routes` or domain config
- Any RPC/key material

## Live Verification Checklist

After deploy, run these checks on `gate777.vercel.app`:

```bash
curl -s https://gate777.vercel.app | grep -o 'class="dashboard" id="dashboard"' | wc -l   # expect 1
curl -s https://gate777.vercel.app | grep -o 'class="lock-overlay" id="lock-overlay"' | wc -l   # expect 1
curl -s https://gate777.vercel.app | grep -o 'center-notice-box standalone-operation-box' | wc -l   # expect 1
curl -s https://gate777.vercel.app | grep -o 'center-notice-box securegate-ack-box' | wc -l   # expect 1
curl -s https://gate777.vercel.app | grep -o 'sidebar-version-badge' | wc -l   # expect 2 (1 CSS + 1 HTML)
curl -I -s https://gate777.vercel.app | head -n 1   # expect HTTP/2 200
curl -I -s https://securegate-777g.vercel.app | head -n 1   # expect HTTP/2 404
```

Structural check (run from Python):

```python
import urllib.request, re
html = urllib.request.urlopen('https://gate777.vercel.app').read().decode('utf-8','replace')
body = re.sub(r'<style[\s\S]*?</style>', '', html)
main = body.find('<div class="main-panel"')
standalone = body.find('center-notice-box standalone-operation-box')
ack = body.find('center-notice-box securegate-ack-box')
dash = body.find('<div class="dashboard" id="dashboard"')
lock = body.find('<div class="lock-overlay" id="lock-overlay"')
assert main < standalone < ack < dash
assert dash < lock
assert not (standalone < main)
```

All must pass before declaring the patch complete.

## Known Pitfalls

- The duplicate `#dashboard` wrapper bug existed in `fd91c46` and `5aa8ee7`. If you regenerate the proposed diff, verify it does not re-introduce this duplicate.
- `build-live.cjs` copies root→live and writes `live/build.json`. The built `app.*.js` hash changes each build. Do not hard-code JS filenames.
- `npm run obfuscate` skips already-obfuscated files; it is safe to re-run.
- `vercel build` and `vercel deploy --prebuilt` must be separate steps in that order.
- Always set the alias after deploy; stale aliases serve old code.
- Never claim deployment is complete until the alias points to the new deploy URL AND all verification checks pass.

## Current Blocking State

None. Repo is clean. Approved fixes are queued. Awaiting diff generation and user approval.
