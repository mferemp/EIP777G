// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EIP777GBase.sol";

/// @title EIP777G — Deployable wrapper for EIP777GBase
/// @notice Constructor-only passthrough; no upgradeability, no extra state.
contract EIP777G is EIP777GBase {
    constructor(
        address _operationalKey,
        address _recoveryAuthority,
        address _cleanWallet
    ) EIP777GBase(_operationalKey, _recoveryAuthority, _cleanWallet) {}
}
