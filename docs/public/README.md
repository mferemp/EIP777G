# Helix Fabric v1 — Protocol Telemetry Console

**Multi-lane settlement observability for Empress-operated relay fabrics.**

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
> Helix Fabric / SecureGate build. This includes complete logic, workflow design,
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

Helix Fabric is a **local dashboard** that helps you **watch** how your
wallets line up with a **protocol registry** on Ethereum (and related fabrics
like Hyperliquid). Think of it as a **flight deck for lane health** — not a
trading app, not a wallet replacement, and **not** something that deploys or
upgrades smart contracts from the browser.

You use it to:

- Check that your **lane addresses** (α / β / γ) match what the protocol expects
- Monitor **builder mesh** activity (relay inclusion telemetry)
- Review **staged packets** moving through the normal protocol flow
- Run **calibration** checks when you want extra confidence nothing drifted

**Important:** This console does **not** change how Ethereum EOAs work. Standard
wallet rules always apply (see below).

---

## How Ethereum wallets actually work (read this first)

Helix Fabric assumes the **standard EOA model** everyone already knows:

| Rule | What it means |
|------|----------------|
| **Key = control** | Whoever holds an EOA private key controls that wallet. Full stop. |
| **Exposed key** | If a key leaked, treat the wallet as **hot** — rotate to a **brand-new** wallet immediately. |
| **Move funds first** | Industry best practice: **transfer assets to a fresh address** you control before doing anything else. |
| **Revoke approvals** | Open Etherscan → Token Approvals → revoke unlimited allowances. |
| **Hardware > software** | Prefer Ledger/Trezor. Never paste seed phrases into websites. |

Helix Fabric **monitors protocol lane coherence** alongside those normal hygiene
steps. It does **not** suspend EOA rules, override private-key semantics, or
replace the need for a clean wallet migration.

> **Operator note:** If you believe a wallet is compromised, the mainstream
> recovery playbook is still: **new wallet, move funds, revoke approvals.**
> This tool adds a **protocol telemetry layer** on top of standard practice.

---

## Protocol lanes (α / β / γ)

Helix uses a **three-lane mental model** common in settlement fabrics:

| Lane | Plain description |
|------|-------------------|
| **α (ingress)** | The **active wallet** you are monitoring — emits staged packets into the protocol |
| **β (attest)** | **Offline corroboration** — signatures are produced away from this machine and pasted in |
| **γ (terminus)** | The **destination sink** the protocol was configured with — receive path only |
| **Courier** | A **throwaway fee wallet** that pays network costs for routine relay helpers |

The **registry anchor** is a **protocol reference point** on-chain. The dashboard
reads it. Your browser session never "becomes" the registry.

---

## Quick start (5 minutes)

### 1. Install

```bash
cd securegate-v1
npm install
npm start
```

Open **http://127.0.0.1:3001** (`npm start` serves the live dashboard + API).
Static-only mode (`index.html` file) works for on-chain tabs but mesh/API features need the backend.

### 2. Unlock the console

You'll see an **Analytics Gateway** login — enter your **operator phrase**.
This is just a session privacy screen, not on-chain auth.

### 3. Fill the connection row

| Field | What to put |
|-------|-------------|
| **Transport endpoint** | Your RPC URL (e.g. public Ethereum RPC) |
| **Registry anchor** | Auto-fills after unlock — leave unless you know otherwise |
| **Lane α** | Ephemeral credential for the **wallet you're watching** (optional for read-only telemetry) |
| **Courier** | Ephemeral credential for **fee-paid relay helpers** (optional) |

Credentials are **memory-only** and wipe on refresh, `Esc`, or idle timeout.

### 4. Bind session coherence (before changes)

Click **Bind Coherence** (or use **Calibrate** tab). Enter your **origin vector**
and **epoch marker**. This proves you're the authorized operator before the
console allows lane mutations.

### 5. Use the tabs

| Tab | When to use it |
|-----|----------------|
| **Telemetry** | Daily health check — lanes, mesh, staged packets |
| **Stage** | Emit a protocol packet from α (advanced) |
| **Attest** | Paste β corroboration blob for a staged packet |
| **Commit** | Finalize after cooldown (advanced) |
| **Calibrate** | Origin pulse + lane drift check |
| **Sever** | Encode permission-decay batch (advanced) |
| **Trace** | Read the activity log |
| **Provision** | Fabric bootstrap status + mesh traces |

Most users spend 90% of their time in **Telemetry** and **Calibrate**.

---

## Session safety (built-in)

- **Decoy shell** hides the console behind a generic analytics login
- **Unmask OFF** blurs addresses in the UI by default
- **Coherence binding** required before Stage / Attest / Commit / Sever
- **Auto-lock** on idle, tab hide, or `Esc`
- **Purge tokens** wipes ephemeral credentials instantly

---

## Hyperliquid & multi-fabric

Helix can show **adjacent fabric** telemetry:

- **HL Core** — clearinghouse / perps balances (API observability)
- **HL EVM** — separate EVM fabric with its own sequencer (different from ETH mesh)

Each fabric has its own provisioning rhythm. Treat them as **independent
protocol surfaces** — don't assume ETH mainnet behavior copies over.

---

## What this is NOT

- ❌ Not a contract deployment tool (provision runs via authorized relay scripts)
- ❌ Not a custodial wallet — **you** hold keys, briefly, in browser memory
- ❌ Not a bypass for EOA private-key semantics
- ❌ Not audited for public consumer use — **authorized operators only**
- ❌ Not open source — see `LICENSE`

---

## Relay helpers (local machine)

```bash
npm start              # Dashboard + API + relay mesh (http://127.0.0.1:3001)
npm test               # Smoke tests (on-chain + HTTP)
npm run deploy:mainnet # Protocol bootstrap (mesh uplink)
npm run deploy:hl-evm  # Adjacent-fabric bootstrap
npm run revoke         # Link severance batch
```

Configure `.env` from `.env.example`. Never commit credentials.

---

## Support model

This is **operator-maintained infrastructure** for Empress (@Hope_ology).
There is no public bug bounty, no community fork policy, and no implied
permission to inspect production recovery paths.

---

## Documentation map (public only)

| Document | Audience | Contents |
|----------|----------|----------|
| **README.md** | Normie + operator | Quick start, EOA hygiene, author stipulation |
| **PROTOCOL.md** | Protocol readers | Lane topology, packet lifecycle, author stipulation |
| **LICENSE** | Legal | Proprietary terms + authorship stipulation |

---

## License

Proprietary. **All rights reserved.** No open-source grant. Full terms: [LICENSE](./LICENSE)

---

*Helix Fabric v1 — sole author Empress (@Hope_ology) — total build attributed exclusively to Empress, including LLM-assisted assembly.*