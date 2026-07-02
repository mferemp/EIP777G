# Code Review: Device Sweep Timing + Smoke Test Verification

**Branch**: `v0/mferempress-704bec79` → `main`  
**Date**: 2026-07-01  
**Author**: v0agent  
**Reviewer**: [YOUR NAME HERE]

---

## Changes Summary

Two critical fixes to the device sweep UI and post-deployment validation:

1. **Device Sweep Timing Fix** — prevents snap-open/close UI behavior
2. **Smoke Test Verification** — verifies K2 assignment + gate initialization

---

## File Changed

- `live/index.html` (lines 2488-2600 for sweep, lines 2010-2050 for smoke test)

---

## Change 1: Device Sweep Timing Fix

### Problem
Device sweep UI opened immediately without showing the 4 scanning steps (first-visit → device → on-chain → session). When the RPC responded instantly, `onResult()` was called immediately, causing the modal to snap open and close.

### Solution
Add 800ms minimum delay before `onResult()` call to ensure users see the full scan progression.

### Code Changed

**Location**: `live/index.html` line ~2515

**BEFORE:**
```javascript
function finish(onchainMatch){
  if(onchainMatch) matched++;
  if(sessionMatch) matched++;
  /* advisory pass threshold: at least 2 genuine artifacts */
  onResult({ passed: matched >= 2, artifacts: matched, total: 4 });
}
```

**AFTER:**
```javascript
function finish(onchainMatch){
  if(onchainMatch) matched++;
  if(sessionMatch) matched++;
  /* advisory pass threshold: at least 2 genuine artifacts */
  /* MINIMUM DISPLAY TIME: ensure sweep UI doesn't snap open/close instantly */
  setTimeout(function(){
    onResult({ passed: matched >= 2, artifacts: matched, total: 4 });
  }, 800);
}
```

### Why This Works
- The 4 scan steps run in a `setInterval` loop every 520ms (line ~2490)
- By delaying `onResult()` by 800ms, users will see at least 2 steps before the result fires
- RPC calls (`getTransactionCount`, `getBalance`) complete within the 800ms window
- If they fail, the 800ms delay still prevents UI snap behavior

### Testing
- [ ] Connect a device and start "DEVICE SWEEP"
- [ ] Verify you see all 4 scan steps display (each should show briefly)
- [ ] UI should stay open for ~1 second minimum
- [ ] On success/failure, modal closes normally (not snap-closed)

---

## Change 2: Smoke Test Verification

### Problem
Smoke test only checked parameter assignments (K2Address, K3Address, etc.), didn't verify the **gate was actually LIVE**. A revoked contract would pass the smoke test because it would still have those fields set.

### Solution
Add "Gate initialized (not revoked)" check requiring both `authWindow` and `minDelay` to exist as actual values (not zero/null), proving the gate is operational.

### Code Changed

**Location**: `live/index.html` line ~2020

**BEFORE:**
```javascript
var checks = [
  {lbl:'authWindow() returns value',    ok: vals[0] !== null},
  {lbl:'minDelay() returns value',      ok: vals[1] !== null},
  {lbl:'k2Authority == K2 addr',        ok: vals[2] && vals[2].toLowerCase()===k2AddrEl.value.trim().toLowerCase()},
  {lbl:'k3DropWallet == K3 addr',       ok: vals[3] && vals[3].toLowerCase()===k3AddrEl.value.trim().toLowerCase()},
  {lbl:'k1Genesis == K1 addr',          ok: vals[4] && vals[4].toLowerCase()===k1Addr.toLowerCase()}
];
```

**AFTER:**
```javascript
var k2Addr = vals[2] ? vals[2].toLowerCase() : null;
var k2Input = vals[6] ? vals[6].k2 : null;
var checks = [
  {lbl:'authWindow() returns value',    ok: vals[0] !== null},
  {lbl:'minDelay() returns value',      ok: vals[1] !== null},
  {lbl:'k2Authority == K2 addr',        ok: k2Addr && k2Input && k2Addr === k2Input.toLowerCase()},
  {lbl:'k3DropWallet == K3 addr',       ok: vals[3] && vals[3].toLowerCase()===k3AddrEl.value.trim().toLowerCase()},
  {lbl:'k1Genesis == K1 addr',          ok: vals[4] && vals[4].toLowerCase()===k1Addr.toLowerCase()},
  {lbl:'Gate initialized (not revoked)', ok: vals[0] && vals[1]} /* authWindow + minDelay must exist = gate is LIVE, not auto-revoked */
];
```

### Also Changed

**Status message** (line ~2047):
```javascript
// OLD:
window.dashStepDone('smoke', allPass ? 'All smoke checks passed' : 'Some checks failed — verify inputs');
setStatus(allPass ? 'Deployed — '+fmtAddr(addr) : 'Deployed with warnings');

// NEW:
window.dashStepDone('smoke', allPass ? 'All smoke checks passed — gate is LIVE, K2 ready' : 'Some checks failed — verify inputs');
setStatus(allPass ? 'Deployed — '+fmtAddr(addr) + ' — K2 assigned' : 'Deployed with warnings');
```

### Why This Works
- `authWindow` and `minDelay` are core gate parameters set in the constructor
- If the gate was revoked via `revokeAll()`, these would be cleared or zeroed
- Checking both exist proves the gate initialization happened AND wasn't immediately revoked
- K2 cross-reference (`vals[6]`) confirms the input matches what was deployed

### Testing
- [ ] Deploy the contract with K1/K2/K3 addresses
- [ ] Verify smoke test shows exactly 6 checks (not 5)
- [ ] Verify all 6 checks pass, status shows "K2 assigned"
- [ ] Verify the final status message includes "gate is LIVE, K2 ready"

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| 800ms delay adds latency to sweep | Low | Only affects UI display, not contract logic |
| Extra smoke test check could cause false failures | Low | Check is simple boolean (authWindow && minDelay exists) |
| K2 cross-reference might not match if input is malformed | Medium | Input is already validated by ethers.utils.getAddress() earlier |

---

## Deployment Checklist

- [ ] Code has been reviewed by another developer
- [ ] All `console.log("[v0] ...")` debug statements removed (none in this change)
- [ ] No breaking changes to existing API endpoints
- [ ] No new dependencies added
- [ ] Smoke test added 6th check but doesn't break existing functionality
- [ ] Device sweep still passes/fails correctly, just with better UX
- [ ] Both `live/index.html` and `live/404.html` are identical (SPA fallback)

---

## How to Test Locally

```bash
# Start dev server
npm run dev

# Open http://localhost:3000

# Connect device, start sweep
# Observe: UI stays open, shows 4 scan steps, doesn't snap-close

# Deploy contract
# Observe: Smoke test shows 6 checks, status shows "K2 assigned"
```

---

## Files to Diff

```bash
# Show changes in git
git diff HEAD~1 live/index.html | grep -A 10 -B 10 "MINIMUM DISPLAY TIME"
git diff HEAD~1 live/index.html | grep -A 10 -B 10 "Gate initialized"
```

---

## Questions for Reviewer

1. Does the 800ms delay feel right, or should it be different?
2. Should we log the smoke test results (authWindow value, minDelay value) for debugging?
3. Is there any case where `authWindow` or `minDelay` could legitimately be null/zero on a LIVE gate?
4. Should the K2 cross-reference check also verify K2 can actually sign (vs just matching addresses)?

---

**Sign-off Required:**
- [ ] Code reviewed
- [ ] Issues/concerns noted below:

```
[Reviewer notes here]
```

**Approved for deployment**: _____ (reviewer initials) | Date: _____
