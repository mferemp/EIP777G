# Cross-chain Model for EIP777G

## End Goal

- **Irrevocably nullify** a compromised operational key.
- **Sweep assets** from the compromised context into a clean wallet.
- Do this **safely on any EVM chain** without cross-chain replay surprises.

## Chain Awareness

EIP777G binds each recovery operation to:

- `block.chainid`
- `address(this)` (contract deployment address)
- a caller-chosen `nonce`

The **replay key** is computed as:

```solidity
keccak256(abi.encodePacked(chainid, contractAddress, nonce))
```

### Key Properties

1. **Chain Isolation**: A nonce used on one chain cannot be replayed on another.
2. **Address Isolation**: A nonce is scoped to a specific deployment address.
3. **Single Use**: Once a nonce is consumed, it is permanently marked as used.

## Deployment Topology

- **Each chain gets its own EIP777G deployment** (separate address, separate state).
- **Safety does not assume** "same hex address = same logic" across chains.
- **You decide** which chains to deploy on and which assets to sweep.

## Irreversibility Guarantee

Once `keyNullified` is set to `true`:

- There is **no function to restore it**.
- There is **no upgradeability** backdoor.
- There is **no owner-only override**.
- The only privileged actor is `recoveryAuthority`, and its powers are limited to:
  - Nullifying the operational key
  - Sweeping ETH and ERC20 balances to the clean wallet

## Recovery Operation Flow

1. **Prepare**: Recovery authority constructs a `RecoveryOp` struct with:
   - `opId`: Arbitrary unique identifier for this recovery
   - `nonce`: Unique value (e.g., derived from timestamp or counter)
   - `deadline`: Expiration time for the operation

2. **Execute**: Call one of:
   - `nullifyAndSweepEth(op)` — nullify key + sweep all ETH
   - `nullifyAndSweepToken(op, token)` — nullify key + sweep ERC20
   - `sweepEth(op)` — sweep ETH only (if already nullified)
   - `sweepToken(op, token)` — sweep ERC20 only (if already nullified)

3. **Consume Nonce**: Contract checks:
   - `deadline >= block.timestamp`
   - Nonce has not been used on this chain
   - Marks nonce as consumed for future protection

4. **Finalize**: Assets flow to `cleanWallet`, key is permanently nullified.

## Example: Multi-chain Deployment

```
Mainnet
├── Deploy EIP777G(k1_main, k2, clean)
├── Assets locked in EIP777G contract
└── k2 triggers recovery: nullifyAndSweepEth(op_main)

Polygon
├── Deploy EIP777G(k1_poly, k2, clean)
├── Assets locked in EIP777G contract
└── k2 triggers recovery: nullifyAndSweepEth(op_poly)

Each recovery is independent (different nonces, different chainids)
```

## Threat Model

**In scope**:
- Operational key (`k1`) is compromised.
- Recovery authority (`k2`) is trusted and secure.
- Clean wallet is trusted.

**Out of scope**:
- Compromised recovery authority.
- Reentrancy (contract is non-reentrant by design).
- Token bugs (assumes ERC20 compliance).
