# EIP777G - Irrevocable Key Nullification

**Asset Routing Authorization Gate for Compromised Wallet Recovery**

## Overview

EIP777G (also known as ERC-777G) is a smart contract pattern that enables irrevocable key nullification to re-possess a compromised wallet. It implements a dual-key authorization system where k1 (thresholdSigner) can submit actions, but economic power resides solely with k2 (k2Authority). This model lets assets flow into the original address safely—airdrops, refunds, or protocol drops can accumulate—while removal, spending, or routing requires an explicit k2-signed path via the EIP777G gate.

### Key Features
- **Dual-Key Authorization:** k1 can create proposals, k2 must authorize execution
- **Automatic Asset Forwarding**
- **Rate Limiting & Blacklist**
- **EIP-7702 Attack Resistance**: As long as *all* execution paths at the EOA are k2-gated, new inflows remain safe
- **Flashbots Integration**

## Threat Model & Security Invariant

EIP777G is designed to permanently revoke k1’s autonomous control over economic action.

- **k1 is intentionally sacrificial**: Attacker or user may control k1 poses no existential risk.
- **k2 is sacred**: Only k2, signing via the EIP777G gate, can actually transfer value.

**Security invariant:**
- No value can be removed/migrated/forwarded from the address without an explicit k2 signature interpreted by the gate. k1 alone is powerless for economic movement—this is a design guarantee at the contract level.
- Any execution path installed (EIP-7702, delegate, etc.) at the EOA **must itself enforce the same k2-gated authorization**. If 7702 or any other delegated/automated code allows k1 to unilaterally move assets or value, this breaks the model and voids all guarantees. The issue is not using EIP-7702, but restoring k1 autonomy without k2 approval.

**In short:**
- You *may* add code/delegation (e.g., 7702) to your EOA, *as long as* all such logic routes through the k2-only gate for spending, so that k1 (or any delegate) can never invoke value movement without a valid k2 approval.
- This nullifies the traditional “abandon your address” logic; you keep your address, keep receiving assets, and only k2 can unlock value for onward routing.

## Usage

- Never introduce code at your EOA that allows k1 or any path to bypass the requirement for a k2-approved action to move funds, airdrops, or perform authorization-critical operations. This keeps the invariant true, no matter how 7702 (or other future smart account standards) evolve.

---

## Remaining Sections
... (rest of README unchanged for length)
