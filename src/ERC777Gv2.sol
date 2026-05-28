// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EIP777GBase.sol";

/// @title ERC777Gv2 — Alternative interface with contextual auth hooks
/// @notice Extension point for chain-specific or context-aware recovery rules.
abstract contract ERC777Gv2 is EIP777GBase {
    /// @notice Hook for subclasses to add contextual authorization checks.
    /// @dev Override to add chain-specific rules, time-locks, or multi-sig gates.
    function _contextualAuth(bytes32 opId) internal virtual {}

    /// @notice Nullify key with contextual auth.
    function nullifyAndSweepEthWithContext(RecoveryOp calldata op) external {
        _onlyRecoveryAuthority();
        _consumeNonce(op);
        _contextualAuth(op.opId);
        _nullifyKey(op.opId);
        _sweepEth(op.opId);
    }

    /// @notice Sweep token with contextual auth.
    function nullifyAndSweepTokenWithContext(RecoveryOp calldata op, address token) external {
        _onlyRecoveryAuthority();
        _consumeNonce(op);
        _contextualAuth(op.opId);
        _nullifyKey(op.opId);
        _sweepToken(token, op.opId);
    }
}
