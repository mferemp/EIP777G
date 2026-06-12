# SecureGate v1 — Public Console Quick Reference

**This link opens a session-only recovery console. No data is stored.**

---

## In 5 steps

1. **Open the link** — this generic analytics shell loads in your browser.
2. **Paste your RPC endpoint** — or use the built-in public defaults.
3. **Paste credentials** (only if actively recovering):
   - Courier / Deployer private key (ephemeral)
   - K1 private key — ingress wallet (ephemeral)
   - K1 address (optional override)
   - K2 address — attest wallet (address only, never paste key)
   - K3 address — terminus / drop wallet
   - Registry anchor (gate contract address)
4. **Use the tabs**:
   - **Telemetry** — read-only balances & gate state
   - **Beacon** — origin pulse & drift check
   - **Deploy** — fabric bootstrap (requires deployer key)
   - **Trace** — local session activity log
5. **Purge all variables** when done (or press `Esc` / close tab).

---

## What this is NOT

- ❌ Not a wallet — you hold keys briefly in browser memory only
- ❌ Not a contract deployment UI — Deploy tab is bootstrap only
- ❌ Not a substitute for standard EOA hygiene (rotate exposed keys)
- ❌ Not open source — proprietary, authorized operators only

---

## Safety

- Keys never leave your browser — memory only, wipe on `Esc` / idle / close
- Addresses blurred by default (Unmask: OFF)
- No server, no logs, no tracking

---

© Empress (@Hope_ology) — SecureGate v1 • Proprietary