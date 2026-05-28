# EIP777G: Irrevocable Key Nullification Gate

## Purpose

This repository implements a robust smart contract pattern to recover or secure wallets whose primary key (k1) may be compromised. By using a dual-key system in which k2 is the only root of trust, assets and airdrops arriving at the compromised address (EOA) can only be routed out via explicit k2 authorization, while k1 alone is powerless.

## Security Model: k1 is Sacrificial, k2 is Sacred

> k1 (thresholdSigner) is expendable; k2 (k2Authority) is the only key that can authorize money movement.

Once deployed, k1 can still submit transactions, but only k2 can authorize actual execution. This design means:
- You do not have to abandon the original address: it can keep receiving airdrops and tokens safely.
- An attacker with only k1 cannot move airdrops or drain funds—they can only spam (which triggers rate limiting/blacklisting).
- Changing k2 requires migration (deploying a new gate), and both keys are needed for migration. Losing both is terminal.

### Quick ASCII Diagram

```
(Airdrop or protocol → old EOA) --> [EIP777G Gate] --(k2 signs route)--> [Clean Wallet]
         |                                           ^
        k1 submits (blocked w/o k2)                  |
```

## Key Features
- **Dual-Key Authorization**: thresholdSigner (k1) + k2Authority
- **Automatic Asset Forwarding**: to designated clean wallet
- **Rate Limiting & Blacklist**: against spam and sweeper bots
- **EIP-7702 Resistance**: immune to delegate trap attacks
- **Flashbots Integration**: for atomic anti-sweeper deploys
- **Device-bound, velocity-aware execution (v2)**: optional extra context security

## Full Documentation and Reference
- [`ERC-777G-Safe-Deployment-Guide.md`](./ERC-777G-Safe-Deployment-Guide.md) — sweeper-proof deployment instructions
- [`ERC-777G-v2-Contextual-Auth.md`](./ERC-777G-v2-Contextual-Auth.md) — advanced v2 logic
- [`ERC-777G-Deployment-empressive.md`](./ERC-777G-Deployment-empressive.md) — end-to-end deployment checklist

## Contracts
- [`src/EIP777G.sol`](./src/EIP777G.sol) — core v1 contract
- [`src/ERC777Gv2.sol`](./src/ERC777Gv2.sol) — contextual authorization v2 (draft)

## Security Considerations

### Threat Model

EIP777G assumes:
- `thresholdSigner` (k1) may be compromised.
- `k2Authority` (k2) is the root of trust and must remain uncompromised.
- All asset movement is enforced through this contract (not via k1 alone).

**All spending, forwarding, or migration requires a k2 signature. k1 can only propose transactions. If k2 is lost, assets are stuck.**

#### Key Management Guidelines
- Store **k2** on a hardware wallet or air-gapped device.
- Expect **k1** to be compromised/disposable. The design assumes this.
- If both k1 and k2 are lost, recovery is impossible.
- Rotating k2 = deploy & migrate to a new gate with new k2, current k2 must authorize.

#### Security Links
- [Recovering tokens after exposure: EIP-7702](https://www.bankless.com/read/recovering-tokens-eip-7702)
- [Security-first EIP-7702](https://www.fireblocks.com/blog/security-first-approach-to-eip-7702)
- [OSL EIP-7702 guide](https://www.osl.com/en/bits/article/a-security-guide-to-eip-7702-avoiding-the-batch-transaction-trap)

---

## Usage

See the guides and contract docs for deploy, test, and migration procedures. All major security attack models (sweeper bots, delegation, agent replay) are actively mitigated by this pattern.
