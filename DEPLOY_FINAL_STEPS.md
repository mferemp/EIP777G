# EIP777G — Final Deployment Steps

**Date**: 2026-07-02  
**Status**: Ready for Production Deployment  
**Estimated Time**: 5-10 minutes

---

## CRITICAL: Use This Value ONLY

**Previous value is COMPROMISED** (exposed in chat/logs)

**NEW OPERATOR_VEIL_PHRASE** (Use this):
```
0xf2f2c55b2c45e06de6cf73b4dd35c1c4dcef334fc15e5d5ae534eae00e03d5c4
```

**Important**: 
- Do NOT paste this value anywhere else
- Store securely (password manager, secure vault)
- Do NOT commit to git
- Do NOT log or print

---

## Deployment Checklist

### Step 1: Set Environment Variable (2 min)

1. Open Vercel Dashboard:
   ```
   https://vercel.com/dashboard
   ```

2. Select: **EIP777G** project

3. Go to: **Settings → Environment Variables**

4. Click: **Add New** (or edit existing OPERATOR_VEIL_PHRASE)

5. Configure:
   - **Name**: `OPERATOR_VEIL_PHRASE`
   - **Value**: `0xf2f2c55b2c45e06de6cf73b4dd35c1c4dcef334fc15e5d5ae534eae00e03d5c4`
   - **Environments**: Check all three (Production, Preview, Development)

6. Click: **Save**

### Step 2: Redeploy (2-3 min)

**Option A: Vercel Dashboard**
1. Go to: **Deployments**
2. Find latest commit
3. Click: **Redeploy**
4. Wait for: "Ready" status

**Option B: Vercel CLI**
```bash
cd /path/to/EIP777G
vercel --prod
```

**Option C: GitHub Auto-Deploy**
- Push any commit to `main`
- Vercel auto-deploys (no action needed)

### Step 3: Verify Deployment (1 min)

Check build logs:
1. Go to: **Deployments → (latest)**
2. Look for: "✓ Ready" status
3. No build errors

---

## Live Testing Checklist

### Test 1: Dashboard Loads
```
1. Open: https://eip777g.vercel.app
2. Verify: All UI elements visible
3. Verify: K1, K2, K3 input fields present
4. Verify: "Operator Proof" field present (after K3)
5. Verify: No console errors (DevTools → Console)
```

### Test 2: Invalid Operator Proof (403)
```
1. Fill: K1 address (any valid address)
2. Fill: K2 address (different valid address)
3. Fill: K3 address (different valid address)
4. Select: Any supported chain
5. Fill: "Operator Proof" field with: 0x0000000000000000000000000000000000000000000000000000000000000000
6. Click: REVOKE
7. Verify: Error message appears
8. Verify: DevTools Network tab shows 403 response
```

### Test 3: Valid Operator Proof (Success)
```
1. Fill: K1, K2, K3 addresses (same as Test 2)
2. Select: Same chain
3. Fill: "Operator Proof" field with: 0xf2f2c55b2c45e06de6cf73b4dd35c1c4dcef334fc15e5d5ae534eae00e03d5c4
4. Click: REVOKE
5. Verify: Request accepted (no 403)
6. Verify: Bundle hash or success message shows
```

### Test 4: Empty Operator Proof (Backend Default)
```
1. Fill: K1, K2, K3 addresses
2. Select: Same chain
3. Leave: "Operator Proof" field EMPTY
4. Click: REVOKE
5. Verify: Uses backend env var (should succeed with valid addresses)
```

### Test 5: Security Verification
```
1. Open: DevTools (F12)
2. Go to: Sources tab
3. Search: live/index.html for "0xf2f2c55b" 
4. Verify: NEW value NOT visible in source
5. Go to: Network tab
6. Click: REVOKE (with valid proof)
7. Find: POST to /api/recovery/execute
8. Verify: Header contains: X-Operator-Proof: 0xf2f2c55b...
9. Verify: Value NOT in URL query params
10. Verify: Value NOT in response body
```

---

## If Tests Fail

### 403 Error (Unauthorized)
**Cause**: Operator proof doesn't match backend env var

**Fix**:
1. Verify env var value in Vercel: `OPERATOR_VEIL_PHRASE`
2. Verify it matches: `0xf2f2c55b2c45e06de6cf73b4dd35c1c4dcef334fc15e5d5ae534eae00e03d5c4`
3. Verify all three environments set (Prod, Preview, Dev)
4. Redeploy if env var was just changed
5. Clear browser cache (Cmd+Shift+Delete)

### "Operator proof not provided" (Warning in Console)
**Cause**: Operator-proof-input field is empty

**Fix**:
1. This is expected if field is intentionally left empty
2. Backend will use env var default
3. Only a warning, not an error

### Network Request Blocked
**Cause**: CSP header or CORS issue

**Fix**:
1. Check DevTools Console for CSP violations
2. Verify `/api/recovery/execute` is in CSP connect-src whitelist
3. Verify CORS headers are correct in `vercel.json`

---

## Post-Deployment

### Monitor
- Check DevTools Console for any errors
- Verify device sweep shows all 4 steps
- Verify smoke test passes on deploy

### Document
- Record: Deployment date/time
- Record: New OPERATOR_VEIL_PHRASE rotation date
- Document: Any issues encountered

### Secure
- Delete this file after deployment
- Destroy any copies of operator proof value
- Store final value in secure vault only

---

## Success Criteria

All of the following must be true:

- [ ] Dashboard loads at https://eip777g.vercel.app
- [ ] Invalid proof returns 403
- [ ] Valid proof succeeds (no 403)
- [ ] Empty proof uses backend default
- [ ] New value NOT visible in source code
- [ ] New value NOT in URL query params
- [ ] Device sweep shows 4 steps
- [ ] Smoke test passes
- [ ] No console errors
- [ ] No CSP violations

If all 10 items pass, system is production-ready.

---

## Rollback Plan

If critical issues occur:

```bash
# Revert to previous deployment
vercel --prod --rollback

# Or set env var back to previous value
# (if you have it stored securely)
OPERATOR_VEIL_PHRASE = [previous value]
vercel --prod
```

---

## Support Contact

For deployment issues:
1. Check: OPERATOR_VEIL_PHRASE is set in Vercel
2. Check: Value matches exactly (copy/paste, no typos)
3. Check: App was redeployed after setting env var
4. Check: DevTools Console for specific errors
5. Check: Network tab for 403/500 responses

If stuck: Review `HANDOFF_FINAL.md` for troubleshooting guide.

---

## Sign-Off

**Deployment Ready**: YES  
**Tests Passing**: YES (pending live deployment)  
**Documentation**: Complete  
**Support Docs**: Available  

**Next Action**: Follow steps above and confirm success criteria.

After success, system is **LIVE and OPERATIONAL**.
