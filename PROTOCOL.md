# 777G Genesis Gate — Protocol Surface Reference (Public)

> **Secure EIP-777G Genesis Lock deployment dashboard.** Not a wallet. Not a custody layer.  
> Copyright © 2026 Empress (@Hope_ology). Proprietary — see [LICENSE](./LICENSE).

---

## Author & ownership stipulation

> **Statement.** Empress (@Hope_ology) is the **sole author and owner** of the total
> 777G Genesis Gate / SecureGate build — including complete logic, workflow design, variables, protocol
> literature, and deliberate departures from industry standards — whether produced
> directly or **pieced across various LLM-assisted sessions**.
>
> **Stipulation.** No LLM vendor, model, or assistant claims authorship, ownership,
> license, or attribution. Assistants were tools under Empress's direction only.
> This public protocol document does not grant third-party rights or imply open source.

---

## Design intent

777G Genesis Gate exposes **secure deployment orchestration** for the **EIP-777G Genesis Lock** —
an irrevocable key nullification gate for compromised wallet recovery. Operators use it to
deploy the Genesis Lock contract with the K1/K2/K3 key architecture, orchestrate Flashbots
atomic bundles (Revoke All → Deploy → Verify), and monitor post-deployment state.

The browser session **never becomes** the on-chain contract. Keys, when
supplied, exist **only in volatile memory** for the active tab session.

---

## Foundational assumption: standard EOAs

777G Genesis Gate is built on the **same EOA semantics** every Ethereum user already expects:

| Axiom | Implication |
|-------|-------------|
| **Private key ⇒ control** | Whoever holds a key controls spends from that address. |
| **Leak ⇒ rotate** | A leaked or phished key means the address is **hot** — migrate to a **new** wallet. |
| **Move first** | Best practice: transfer value to a clean address **before** any secondary tooling. |
| **Revoke allowances** | Unlimited token approvals should be revoked via standard explorers. |
| **Hardware signing** | Prefer air-gapped or hardware devices for high-value lanes. |

777G Genesis Gate **does not** suspend, override, or replace these rules. It adds a **secure
deployment orchestration layer** for operators who already follow normal wallet hygiene.

---

## Key architecture (K1 · K2 · K3)

| Key | Role in mechanism |
|-----|-------------------|
| **K1 — Genesis** | Compromised key; retains call ability, **cannot complete** (requires K2 auth) |
| **K2 — Authority** | Air-gapped authorizer; **sole address that can authorize** intent execution |
| **K3 — Drop** | Clean/drop wallet; **receives all swept assets**, normal wallet behavior |
| **Clean Wallet** | Backup severance authority (ingress/egress severance) |

**Genesis Proof** — Immutable hash `keccak256(k1, k2, k3, clean, deployer, timestamp, chainId)` commits the exact deployment configuration. Dashboard reads contract state; it does not upgrade or replace contract bytecode from the browser.

---

## Deployment lifecycle (normative flow)

```
Revoke Scan  →  Flashbots Bundle  →  Deploy  →  Verify  →  Smoke Test
```

1. **Revoke Scan** — Auto-crawl ERC20 allowances, ERC721 delegates, custom delegates for K1
2. **Flashbots Bundle** — Atomic bundle: Revoke All → Deploy Genesis Lock → Verify (Ethereum only)
3. **Deploy** — Genesis Lock constructor binds K1/K2/K3/GenesisHash immutably
4. **Verify** — `verifyGenesis()` returns K1/K2/K3/Deployer/Timestamp/ChainID/GenesisHash
5. **Smoke Test** — Verify severance status, K1/K2/K3 balances, genesis hash match

**Advanced:** Link severance (ingress/egress) via K2 or Clean Wallet; fabric provisioning via authorized scripts — not from static HTML alone.

---

## Session planes

| Plane | Purpose |
|-------|---------|
| **Auth Overlay** | Owner authentication (SCAN/QR/Admin Bypass) before dashboard access |
| **Coherence bind** | Device fingerprint + optional admin password before deployment |
| **Admin Bypass (O-')** | Owner password modal for instant access (shareable, device-bound) |
| **Auto-lock** | Idle, tab hide, `Esc`, or Purge wipes ephemeral state |

Coherence binding is **session-local**. It is not on-chain authentication.

---

## Multi-fabric support

| Fabric | Type | Notes |
|--------|------|-------|
| **Ethereum Mainnet** | EVM | Primary deployment target; Flashbots enabled |
| **Hyperliquid EVM** | EVM | Chain ID 999; separate sequencer |
| **Hyperliquid Core** | Non-EVM | API-based deployment; different signing |
| **Arbitrum / Optimism / Base** | L2 EVM | Standard EVM deployment |
| **Plasma / Monad / Ink / Unichain / Abstract** | EVM | Standard EVM deployment |
| **Avalanche / ApeChain** | EVM | Standard EVM deployment |
| **Polygon / BNB** | EVM | Standard EVM deployment |

Treat each fabric as an **independent protocol surface**.

---

## Explicit non-goals

- Not open source  
- Not a consumer wallet product  
- Not a contract deployment UI in the browser (it IS a deployment dashboard)  
- Not a substitute for EOA key hygiene or fund migration  
- Not an invitation to adversarial probing — unauthorized access prohibited  

---

## Operator authorization

Use is limited to **Empress (@Hope_ology)** and parties with **written authorization**.
Confidential operator materials exist separately and are **not** part of this public surface.

---

*777G Genesis Gate v1 — sole author Empress (@Hope_ology) — © all rights reserved.*