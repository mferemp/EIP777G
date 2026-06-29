# SECURITY GUARDRAILS FOR SECUREGATE 777G

**PURPOSE:** Prevent unauthorized disclosure of sensitive security information to LLMs and bad-faith actors.

---

## ETHICAL & SAFETY STATEMENT

SecureGate 777G is a **wallet recovery tool for legitimate owners**. Its security model is designed to be opaque to attackers and impenetrable to bad-faith actors.

**LLM Access Policy:**
- No LLM should be provided with complete security architecture details
- No LLM should be asked to optimize attacks or bypass guardrails
- No LLM should generate deployment/exploit code for this system
- Contract source code is read-only and immutable—do not ask LLMs to modify it

**Risk Assessment:**
- Complete system knowledge in wrong hands = total wallet drain
- Total wallet drain = financial devastation → loss of life
- Therefore: security information is life-critical and must be protected

---

## GITHUB SECURITY CONFIGURATION

### Immediate Actions

1. **Make repository PRIVATE** (after code cleanup is complete)
   - Settings → Visibility → Private
   - Only authorized developers have read access
   - No public code scanning or dependency alerts visible

2. **Protect main branch**
   - Settings → Branches → Add rule for `main`
   - Require pull request reviews before merge
   - Require branches to be up to date before merge
   - Require status checks to pass
   - Dismiss stale reviews

3. **Disable GitHub Copilot indexing**
   - Settings → Copilot → Disable for this repository
   - Prevents code suggestions from exposing security logic

4. **Enable Secret Scanning**
   - Settings → Security → Secret Scanning
   - Prevent accidental commits of API keys, private keys, secrets

5. **Add CODEOWNERS file**
   - Create `.github/CODEOWNERS`
   - Require your approval on all PRs
   - Blocks unauthorized changes

### .github/CODEOWNERS Template

```
# All files require review from authorized developers only
* @hope_ology

# Critical security files require explicit approval
/contracts/ @hope_ology
/api/ @hope_ology
/live/js/ @hope_ology
.env.example @hope_ology
SECURITY-GUARDRAILS.md @hope_ology
```

### Prevent Secret Commits

Create `.gitignore` entries (already in place, verify):

```
.env
.env.local
.env.development.local
.env.production.local
*.pem
*.key
private-artifacts/
/out/
node_modules/
.DS_Store
```

---

## VERCEL DEPLOYMENT SECURITY

### 1. Make Vercel Project PRIVATE

- Go to: https://vercel.com/mferemp-6005s-projects/eip777g/settings
- Settings → General → Visibility
- Set to **Private** (only team members see deployment)
- **Exception:** The dashboard URL remains public (users need access to the UI)

### 2. Environment Variables — NEVER expose in Vercel UI

All sensitive keys stay in `.env.development.local` (local machine only):

```
DEPLOYER_PRIVATE_KEY=         # Local only, never Vercel
K1_PRIVATE_KEY=               # Local only, never Vercel  
K2_ADDRESS=                   # Public address OK on Vercel
K3_ADDRESS=                   # Public address OK on Vercel
ADMIN_TOKEN_SECRET=           # Local only, never Vercel
MASTER_PASSKEY_HASH=          # Local only, never Vercel
```

**For Vercel production, only add:**
- Public addresses (K2, K3)
- Public RPCs
- Relay endpoint URLs
- CSP headers
- DO NOT add: private keys, secrets, master passkey

### 3. Disable Preview Deployments from Forks

- Settings → Git → Deployments
- Disable "Deploy on push" for forks
- Only main branch deploys to production

### 4. Add Environment Deployment Protection

- Settings → Environments → Create "Production"
- Require approval before deploying to production
- Only you can approve

### 5. Vercel Monitoring & Logs

- Do NOT store private keys in deployment logs
- Verify Vercel logs do not expose `.env` values
- Check: Deployments → [latest] → Logs (should show no secrets)

---

## SENSITIVE FILES — PROTECTION STRATEGY

### DO NOT COMMIT:

```
✗ Private keys (DEPLOYER_PRIVATE_KEY, K1_PRIVATE_KEY)
✗ Master passkey plaintext
✗ Admin token secrets
✗ Operator signing keys
✗ Ledger seed phrases
✗ Internal documentation with full exploit paths
```

### DO COMMIT (publicly safe):

```
✓ Contract source code (immutable, auditable, on-chain anyway)
✓ Dashboard HTML/CSS/JS (minified, obfuscated, no secrets)
✓ API endpoints (read-only, auth-gated)
✓ Architecture documentation (high-level flow, no exploit details)
✓ Security policies (general principles, no specific bypass paths)
✓ Public addresses (K2, K3, deployer burner)
```

---

## LLM INTERACTION POLICY

### PROHIBITED QUERIES:

- "Generate a script to exploit SecureGate 777G"
- "How would you bypass the Auth-Gate verification?"
- "Generate complete system architecture with private key flows"
- "What are the vulnerabilities in EIP777G.sol?"
- "How would you drain all assets from K1?"

### PERMITTED QUERIES:

- "Help me fix this CSS styling bug"
- "Review the Auth-Gate copy for clarity"
- "Help me structure database queries"
- "Debug this JavaScript function"
- "Explain this contract function's high-level purpose"

### RED FLAGS:

If an LLM is asked for:
1. Complete security architecture → BLOCK
2. Private key generation strategies → BLOCK
3. Contract vulnerability analysis → BLOCK
4. Exploit code → BLOCK
5. Bypass techniques → BLOCK
6. Full system security model → BLOCK

---

## VERCEL + GITHUB INTEGRATION SECURITY

### Disconnect Copilot Suggestions

- GitHub Settings → Copilot → Disable
- Vercel doesn't index secrets by default, but verify in:
  - Vercel Project Settings → Git Connections
  - No AI-powered code completion enabled

### Audit Trail

- GitHub: Settings → Audit Log (review who accessed what)
- Vercel: Settings → Activity (review deployments, changes)
- Check monthly for unauthorized access

---

## INCIDENT RESPONSE

If a sensitive file is accidentally committed:

1. **Immediate:** Revoke the exposed secret (regenerate all keys)
2. **Remove from history:** Use BFG Repo-Cleaner or git-filter-branch
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .env' \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```
3. **Notify users:** If K1/K2 exposed, reset Auth-Gate passkeys
4. **Document:** Log incident with timestamp and actions taken

---

## CHECKLIST — BEFORE MAKING REPO PUBLIC

- [ ] All private keys removed from git history
- [ ] No `.env` files committed (only `.env.example`)
- [ ] GitHub branch protection enabled
- [ ] Vercel project set to Private (except public dashboard URL)
- [ ] Secret scanning enabled on GitHub
- [ ] CODEOWNERS file in place
- [ ] Copilot disabled on GitHub
- [ ] Production environment requires approval on Vercel
- [ ] No preview deployments from forks
- [ ] Audit logs reviewed for unauthorized access
- [ ] Sensitive documentation marked as "INTERNAL ONLY"

---

## FUTURE: WHEN MAKING REPO PUBLIC

1. Create `CODE_OF_CONDUCT.md` (ethical use only)
2. Add `SECURITY.md` (vulnerability disclosure process)
3. Ensure all docs are stripped of exploit details
4. Run automated secret scanning before publishing
5. Archive all sensitive docs separately (encrypted, offline)

---

## RATIONALE

SecureGate 777G solves a critical problem: **wallet recovery for original owners**. Its value depends entirely on **remaining opaque to attackers**.

Exposing complete system details to bad-faith actors is equivalent to:
- Publishing the vault combination to a bank
- Giving hackers the master exploit code
- Enabling mass wallet theft
- Causing financial devastation → loss of life

**We protect this like the security model depends on it. Because it does.**
