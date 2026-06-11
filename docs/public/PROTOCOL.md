# Helix Fabric — Protocol Surface Reference (Public)

> **Telemetry & lane-coherence console only.** Not a wallet. Not a custody layer.  
> Copyright © 2026 Empress (@Hope_ology). Proprietary — see [LICENSE](./LICENSE).

---

## Author & ownership stipulation

> **Statement.** Empress (@Hope_ology) is the **sole author and owner** of the total
> Helix Fabric build — including complete logic, workflow design, variables, protocol
> literature, and deliberate departures from industry standards — whether produced
> directly or **pieced across various LLM-assisted sessions**.
>
> **Stipulation.** No LLM vendor, model, or assistant claims authorship, ownership,
> license, or attribution. Assistants were tools under Empress's direction only.
> This public protocol document does not grant third-party rights or imply open source.

---

## Design intent

Helix Fabric exposes **read-mostly observability** over a multi-lane settlement registry on
Ethereum-compatible fabrics. Operators use it to confirm that **α / β / γ** lane addresses
match registry expectations, to review **staged packets**, and to monitor **builder mesh**
inclusion telemetry.

The browser session **never becomes** the on-chain registry. Lane credentials, when
supplied, exist **only in volatile memory** for the active tab session.

---

## Foundational assumption: standard EOAs

Helix is built on the **same EOA semantics** every Ethereum user already expects:

| Axiom | Implication |
|-------|-------------|
| **Private key ⇒ control** | Whoever holds a key controls spends from that address. |
| **Leak ⇒ rotate** | A leaked or phished key means the address is **hot** — migrate to a **new** wallet. |
| **Move first** | Best practice: transfer value to a clean address **before** any secondary tooling. |
| **Revoke allowances** | Unlimited token approvals should be revoked via standard explorers. |
| **Hardware signing** | Prefer air-gapped or hardware devices for high-value lanes. |

Helix **does not** suspend, override, or replace these rules. It adds a **protocol
telemetry layer** for operators who already follow normal wallet hygiene.

---

## Lane topology (α · β · γ)

| Lane | Role in protocol literature |
|------|----------------------------|
| **α — ingress** | Active wallet under observation; may **stage** packets into the registry flow |
| **β — attest** | Offline corroboration; signatures produced away from this host and pasted in |
| **γ — terminus** | Configured receive sink at registry bootstrap; passive path |
| **Courier** | Ephemeral fee wallet for relay-paid network costs |

**Registry anchor** — immutable reference contract on-chain. Dashboard reads state; it does
not upgrade or replace registry bytecode from the browser.

---

## Packet lifecycle (normative flow)

```
α stage  →  β attest  →  cooldown  →  commit  →  γ sink
```

1. **Stage** — α emits a packet vector into the registry queue  
2. **Attest** — β corroboration blob is pasted (air-gapped signing)  
3. **Commit** — after attestation horizon + settlement cooldown  
4. **Trace** — transport log records mesh / relay events  

Advanced operators may run **link severance** batches and **fabric provisioning** via
authorized local relay scripts — not from static HTML alone.

---

## Session planes

| Plane | Purpose |
|-------|---------|
| **Decoy shell** | Privacy screen before console unlock |
| **Coherence bind** | Operator origin vector + epoch marker before lane mutations |
| **Unmask** | Optional address visibility in UI (default: blurred) |
| **Auto-lock** | Idle, tab hide, or `Esc` wipes ephemeral state |

Coherence binding is **session-local**. It is not on-chain authentication.

---

## Multi-fabric notes

| Fabric | Behavior |
|--------|----------|
| **ETH mainnet** | Builder mesh telemetry (Flashbots-class relays) |
| **HL EVM (999)** | Separate sequencer; no ETH-style private mesh |
| **HL Core** | Clearinghouse API surface — not EVM deploy |

Treat each fabric as an **independent protocol surface**.

---

## Explicit non-goals

- Not open source  
- Not a consumer wallet product  
- Not a contract deployment UI in the browser  
- Not a substitute for EOA key hygiene or fund migration  
- Not an invitation to adversarial probing — unauthorized access prohibited  

---

## Operator authorization

Use is limited to **Empress (@Hope_ology)** and parties with **written authorization**.
Confidential operator materials exist separately and are **not** part of this public surface.

---

*Helix Fabric v1 — sole author Empress (@Hope_ology) — © all rights reserved.*