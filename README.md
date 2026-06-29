# 777G Genesis Gate — Secure Deployment Dashboard

**Secure EIP-777G Genesis Lock deployment for Empress-operated relay fabrics.**

---

## Proprietary notice

```
Copyright © 2026 Empress (@Hope_ology). All rights reserved.

This software and documentation are proprietary. Unauthorized copying,
distribution, reverse engineering, or use is strictly prohibited.
See LICENSE for full terms.
```

**Public protocol surface:** [PROTOCOL.md](./PROTOCOL.md) — lane semantics and packet
lifecycle as normative literature. Operator-confidential materials are **not** linked here.

---

## Author & ownership stipulation

> **Statement.** Empress (@Hope_ology) is the **sole author and owner** of the total
> 777G Genesis Gate / SecureGate build. This includes complete logic, workflow design,
> variables, and deliberate departures from industry standards — whether authored
> directly or **assembled piecemeal across various large-language-model (LLM)
> sessions**.
>
> **Stipulation.** No LLM provider, model operator, or third-party assistant acquires
> authorship, ownership, license, or attribution rights by assisting with code or
> documentation. All output was directed, selected, edited, and owned by Empress.
> The total work product is attributed **exclusively to Empress (@Hope_ology)**.

This public README does not waive ownership. Full legal terms: [LICENSE](./LICENSE).

---

## What this is (plain English)

777G Genesis Gate is a **secure deployment dashboard** that deploys the **EIP-777G Genesis Lock** — an irrevocable key nullification gate for compromised wallet recovery.

**What it does:**
- Deploys the Genesis Lock contract (K1/K2/K3 key architecture)
- Flashbots atomic bundle: Revoke All → Deploy → Verify
- Real-time revoke scanning (ERC20/ERC721/custom delegates)
- Multi-chain support (17 EVM chains + Hyperliquid EVM/Core)
- Owner authentication (device sweep / QR code / admin password bypass)

**What it is NOT:**
- ❌ Not a trading app or wallet replacement
- ❌ Not a bypass for EOA private-key semantics
- ❌ Not a consumer app — **authorized operators only**
- ❌ Not open source — see `LICENSE`

---

## Quick start (5 minutes)

### 1. Install

```bash
cd /dashboard
npx serve .
```

Open the URL shown (e.g., `http://localhost:3000`). Works for all on-chain tabs.

### 2. Owner Authentication

Open the dashboard URL → You'll see an **Owner Authentication** screen:

| Method | How it works |
|--------|--------------|
| **SCAN** (same device) | Click **SCAN** → Dashboard sweeps device for 4 historical artifacts (First TX, Wallet creation, App install, Device fingerprint) — 3/4 verified = access |
| **QR Code** (separate device) | Scan QR with genesis device → Phone submits verification → Dashboard polls & unlocks |
| **Admin Bypass (O-')** | Click tiny **O-'** (top-right) → **ADMIN** modal → Enter admin password → Instant access |

Credentials are **session-only** — wiped on `Esc`, tab close, idle timeout, or Purge button.

### 3. Deploy Genesis Lock

1. Select network from dropdown (17 chains + Hyperliquid Core)
2. Enter parameters:
   - **Deployer Private Key** (burner wallet)
   - **K1 Private Key** (compromised key)
   - **K1 Address** (auto-derived)
   - **K2 Address** (air-gapped authorizer)
   - **K3 Address** (clean/drop wallet)
   - **Clean Wallet** (backup severance, defaults to K3)
   - **RPC URL** (auto-filled by network, or custom)
   - **Auth Window** (default 3600s)
   - **Min Delay** (default 86400s)
3. Click **Calculate Funding** → Fund deployer wallet
4. Click **Scan Revoke Targets** → Auto-crawl approvals/delegates
5. Click **Deploy Genesis Lock** → Flashbots bundle submits
5. **Smoke Test** → Verifies deployment, severance, balances

---

## Session security (built-in)

- **Decoy shell** — Auth overlay hides the real dashboard
- **O-' Master bypass** — Device-bound admin password for owner
- **Admin password** — Shareable with others (device-bound on their end)
- **Session-only keys** — Wiped on `Esc`, tab close, idle timeout, or Purge
- **Coherence binding** required before deployment
- **Auto-lock** on idle, tab close, `Esc`, or Purge
- **Purge buttons** — Wipe ephemeral credentials instantly

---

## Supported networks (17 chains + Hyperliquid Core)

| Chain | Chain ID | RPC (default) | Native |
|-------|----------|---------------|--------|
| Ethereum | 1 | eth.llamarpc.com | ETH |
| Hyperliquid EVM | 999 | rpc.hyperliquid.xyz/evm | HYPE |
| Hyperliquid Core | — | api.hyperliquid.xyz | HYPE (Non-EVM) |
| Arbitrum | 42161 | arb1.arbitrum.io/rpc | ETH |
| Optimism | 10 | mainnet.optimism.io | ETH |
| Base | 8453 | mainnet.base.org | ETH |
| Plasma | 9745 | rpc.plasma.to | ETH |
| Monad | 10143 | rpc.monad.xyz | MON |
| Ink | 57073 | rpc-gel.inkonchain.com | ETH |
| Unichain | 130 | mainnet.unichain.org | ETH |
| Abstract | 2741 | rpc.abstract.money | ETH |
| Avalanche | 43114 | api.avax.network/ext/bc/C/rpc | AVAX |
| ApeChain | 33139 | rpc.apechain.com | APE |
| Polygon | 137 | polygon-rpc.com | MATIC |
| BNB Chain | 56 | bsc-dataseed.binance.org | BNB |

**Custom RPC:** Paste any EVM RPC URL in the Deploy tab.

---

## Contract mechanism (EIP-777G Genesis Lock)

| Role | Behavior |
|------|----------|
| **K1 (compromised)** | Retains call ability, **cannot complete** (requires K2 auth) |
| **K2 (air-gapped)** | Sole authorizer — only address that can authorize |
| **K3 (drop wallet)** | Receives all swept assets, normal wallet behavior |
| **Clean Wallet** | Backup severance authority |

**Key properties:**
- K1 cannot revoke gate (requires K2 auth)
- Assets authorized from K1 route **directly to K3**
- Severance immutable (K2 or Clean Wallet only)
- On-chain obfuscation: false flags, opaque predicates, decoy events, jump tables

---

## Multi-fabric support

| Fabric | Type | Notes |
|--------|------|-------|
| Ethereum EVM | EVM | Main deployment target |
| Hyperliquid EVM | EVM | Separate sequencer |
| Hyperliquid Core | Non-EVM | API-based deployment |
| Arbitrum/Optimism/Base | L2 EVM | Standard EVM deployment |

Each fabric has its own deployment path. Treat as independent protocol surfaces.

---

## Deployment scripts

```bash
# Dashboard
npx serve /dashboard

# Deploy to Vercel
cd /dashboard && vercel --prod
# Project name: 777g → 777g.vercel.app
```

---

## What this is NOT

- ❌ Not a trading app or wallet replacement
- ❌ Not a bypass for EOA private-key semantics
- ❌ Not a custodial wallet — **you** hold keys briefly in browser memory
- ❌ Not audited for public consumer use — **authorized operators only**
- ❌ Not open source — see `LICENSE`

---

## Support model

This is **operator-maintained infrastructure** for Empress (@Hope_ology).
There is no public bug bounty, no community fork policy, and no implied
permission to inspect production recovery paths.

---

## Documentation map

| Document | Audience | Contents |
|----------|----------|----------|
| **README.md** | Operator | Quick start, auth, deployment, author stipulation |
| **PROTOCOL.md** | Protocol readers | Contract mechanism, key architecture, author stipulation |
| **LICENSE** | Legal | Proprietary terms + authorship stipulation |

---

## License

Proprietary. **All rights reserved.** No open-source grant. Full terms: [LICENSE](./LICENSE)

---

*777G Genesis Gate v1 — sole author Empress (@Hope_ology) — total build attributed exclusively to Empress, including LLM-assisted assembly.*
