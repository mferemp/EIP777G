# AuroraGate Facade — Internal Draft Strategy Record

## Strategy Direction: APPROVED
- Simple pseudonymous facade only
- Genesis as fixed settlement, behavior verifiable
- No public ABI/source/artifacts
- No invisibility claims
- No quilt/bounce layer at this stage

## Code Status: CANDIDATE DRAFT — not approved for deployment
Current evidence:
- Static source-posture checks passed (10/10)
- Compile: not proven
- Genesis ABI/selector compatibility: preliminary mapping only
- K2 auth conflict: not resolved
- Local fork execution: not run
- No-custody revert paths: not tested
- Dashboard integration: not validated

## Deployment Status: NOT AUTHORIZED
- No deployment on any chain
- No verification on any explorer
- No public ABI/source/bytecode/artifacts
- No wallet actions
- No secrets used

## Cross-Chain Status: PRELIMINARY SOURCE-LEVEL ONLY
- Ethereum mainnet: Genesis confirmed, source checks passed
- Optimism/Arbitrum/Base/Polygon/BNB/Avalanche/Hyperliquid: Genesis address TBD, deployment not confirmed
- Plasma/Ink: Solidity 0.8.24 unverified
- Abstract/Monad/ApeChain/Degen/Lens/Unichain: not workshoppable

## Public Sharing: NOT SAFE AS-IS
- Remove Genesis address before any public version
- Remove presigned S3 upload URLs
- Remove repo path hints and chain config operational mapping

---

## Real Deployment Gates (Required Before Any Chain)

| Gate | What proves it |
|---|---|
| Compile | `forge build` succeeds with hardened metadata settings |
| ABI match | Every AuroraGate call maps to actual Genesis selectors — written mapping produced |
| K2 auth | Confirm whether Genesis already handles K2; justify or remove AuroraGate's EIP-712 layer |
| Local fork | Full queue/auth/run flow against live Genesis behavior on a local fork |
| Destination safety | K3 cannot be substituted by wrapper or operator — proven in test |
| No custody | ETH/ERC20/ERC721 balances do not remain across normal and revert paths |
| Trace honesty | Docs explicitly state Genesis may still be recoverable from traces |
| Dashboard integration | UI calls facade without leaking Genesis in bundle/source maps/artifacts |
| Artifact hygiene | No ABI/source/bytecode/source maps publicly exposed |
| Operational freeze | No deploy, verify, alias, or wallet action without explicit per-chain authorization |

---

## Five Open Questions (Real Gates)

1. Does Genesis already verify K2?
2. Do AuroraGate selectors match real Genesis selectors?
3. Does the contract compile with hardened metadata settings?
4. Does constructor fragmentation correctly reconstruct the Genesis address?
5. Do no-custody invariants hold across revert paths?
