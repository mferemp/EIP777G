# EIP777G Alternate Chain Integrations

EIP777G's core invariant is chain-agnostic: **k1 must never regain autonomous value-moving authority; all economically meaningful actions must remain gated by k2**. On standard EVM chains, that invariant is enforced by the Solidity gate contract. On multi-surface systems such as Hyperliquid, the same invariant must be enforced across both EVM and non-EVM execution domains.

## Scope

This addendum extends the repository's security model to alternate integrations, with special attention to:
- Hyperliquid **HyperEVM**
- Hyperliquid **HyperCore**
- Other dual-surface or non-EVM execution environments

## Canonical security invariant
After integration:
- **k1 may propose or initiate intent**, but cannot unilaterally move value.
- **k2 is the only root of trust for value-moving authorization**.
- Any new execution path, adapter, delegate, or chain-specific integration is valid **only if it preserves the requirement that value movement depends on k2 authorization**.

This means the build is not limited to “gate only, no alternate integrations.” Instead, it supports alternate integrations **provided they preserve k2-only authority**.

## Standard EVM chains
On Ethereum and EVM-compatible chains, the Solidity contract is the enforcement layer:
- `queueTransaction` allows proposal/intention only.
- `authorizeTransaction` requires a valid k2 signature.
- `executeTransaction` and asset forwarding require prior k2 authorization.

Therefore, k1 autonomy is revoked at the contract layer.

## Hyperliquid integration model
Hyperliquid operates across two integrated surfaces:
1. **HyperEVM** — the EVM execution environment, where Solidity contracts can run.
2. **HyperCore** — the native Hyperliquid execution domain for spot/native operations and linked asset flows.

A complete EIP777G integration on Hyperliquid must therefore cover **both** surfaces.

### HyperEVM
On HyperEVM, EIP777G can be deployed as a Solidity gate using normal EVM tooling. The same v1/v2 contract invariant applies:
- k1 can express intent only through the gate.
- k2 must authorize any execution that can move value.
- Airdrops or assets that arrive in the protected flow remain non-spendable without k2 authorization.

### HyperCore
HyperCore introduces a second authorization surface. If value can move through HyperCore-native actions, then the EIP777G guarantee remains intact **only if those actions are also wrapped in a k2-gated policy**.

For HyperCore-specific flows:
- Spot transfers between HyperCore and HyperEVM
- Asset linking / deployer-controlled linking actions
- Any native transfer, claim, routing, or settlement action

...the integration must ensure that k1 alone cannot trigger the action. In practice, this means using a chain-specific adapter, signing policy, or relayer rule so that HyperCore value-moving operations require current k2 authorization.

## Integration rule for alternate chains
For any non-standard chain or dual-surface environment, use this rule:

> If the platform exposes any value-moving path outside the Solidity gate, that path must be wrapped in an equivalent k2-gated authorization layer or it is out of model.

This is the correct boundary. The system does **not** forbid alternate chain integrations, EIP-7702 usage, delegates, or native platform features. It forbids only those additions that reintroduce unilateral k1 value-moving authority.

## Repository wording recommendation
Use wording like this in the README or deployment guide:

> EIP777G defines a k2-gated control plane for EVM execution environments, including HyperEVM. Where an ecosystem also exposes non-EVM or native value-moving operations, including HyperCore, equivalent k2-gated authorization must be enforced at that layer for the autonomy-revocation guarantee to remain intact.

And for the threat model:

> Alternate integrations are supported. They are in-model only when they preserve the invariant that k1 cannot move value unilaterally and any economically meaningful action depends on current k2 authorization.

## Failure condition
The guarantee fails only if an integration introduces a path where:
- k1 alone can move value, or
- a delegate / adapter / relayer controlled by k1 can move value without current k2 authorization.

That is the actual out-of-model condition — **not** the mere presence of alternate chain integrations.
