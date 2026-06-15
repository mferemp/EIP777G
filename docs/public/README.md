# SecureGate v1 — Public Recovery Console

**Session-only telemetry dashboard. No data stored. No mechanism documented.**

---

## Purpose

A browser-based console for checking on-chain gate state and executing recovery transactions. You provide all wiring per session — nothing is preconfigured or saved.

---

## What you can do

- **Telemetry** — View balances & gate state across chains
- **Beacon** — Verify lane coherence via origin pulse
- **Deploy** — Bootstrap fabric (requires deployer key)
- **Trace** — Local session activity log

---

## What you need per visit

1. RPC endpoints (or use built-in defaults)
2. Credentials (paste each session):
   - Courier / Deployer private key
   - K1 private key
   - K1, K2, K3 addresses
   - Registry anchor address

---

## Safety

- All credentials: browser memory only, wiped on `Esc`, idle, or tab close
- No server, no persistence, no analytics
- Addresses blurred by default

---

## Ownership

**Sole author: Empress (@Hope_ology)** — total build attributed exclusively.  
Proprietary. All rights reserved. Authorized operators only.  
See [LICENSE](./LICENSE).

---

## Protocol Surface

This console interfaces with the **Helix Fabric** protocol surface for lane health telemetry, mesh status aggregation, and staged packet dispatch. The Helix Fabric layer is not the primary recovery mechanism — it is the public-facing observability surface only.

> Helix Fabric telemetry is read-only and does not expose operator credentials or recovery lanes.

---

*SecureGate v1 — proprietary operator console*
