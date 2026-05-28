// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EIP777GBase — Irrevocable key nullification and controlled wallet recovery
/// @notice Non-upgradeable, chain-aware recovery primitive for compromised EOAs.
/// @dev No external deps, no proxy, no owner-only backdoor.
abstract contract EIP777GBase {
    /// @notice Operational key (k1) that is considered potentially compromisable.
    address public immutable operationalKey;

    /// @notice Recovery authority (k2) that can irreversibly nullify k1 and trigger recovery.
    address public immutable recoveryAuthority;

    /// @notice Clean wallet that receives swept assets on successful recovery.
    address public immutable cleanWallet;

    /// @notice Once set to true, operationalKey is considered permanently nullified.
    bool public keyNullified;

    /// @notice Per-chain, per-operation nonce to prevent replay.
    mapping(bytes32 => bool) public usedNonces;

    /// @notice Emitted when the operational key is nullified.
    event KeyNullified(address indexed by, uint256 chainId, bytes32 opId);

    /// @notice Emitted when assets are swept to the clean wallet.
    event AssetsSwept(address indexed token, uint256 amount, uint256 chainId, bytes32 opId);

    /// @notice Emitted when native ETH is swept.
    event EthSwept(uint256 amount, uint256 chainId, bytes32 opId);

    error NotRecoveryAuthority();
    error AlreadyNullified();
    error NonceAlreadyUsed();
    error InvalidCleanWallet();
    error InvalidOperationalKey();
    error InvalidRecoveryAuthority();

    constructor(
        address _operationalKey,
        address _recoveryAuthority,
        address _cleanWallet
    ) {
        if (_operationalKey == address(0)) revert InvalidOperationalKey();
        if (_recoveryAuthority == address(0)) revert InvalidRecoveryAuthority();
        if (_cleanWallet == address(0)) revert InvalidCleanWallet();
        if (
            _operationalKey == _recoveryAuthority ||
            _operationalKey == _cleanWallet ||
            _recoveryAuthority == _cleanWallet
        ) {
            // Force role separation.
            revert InvalidCleanWallet();
        }

        operationalKey = _operationalKey;
        recoveryAuthority = _recoveryAuthority;
        cleanWallet = _cleanWallet;
    }

    /// @notice Struct describing a recovery operation.
    /// @dev opId is a caller-chosen identifier to bind sweeps to a single logical recovery.
    struct RecoveryOp {
        bytes32 opId;        // Arbitrary unique ID chosen by k2.
        bytes32 nonce;       // Unique per-chain nonce.
        uint256 deadline;    // Timestamp after which this op is invalid.
    }

    /// @notice Nullify the operational key and optionally sweep ETH in a single call.
    /// @dev Only callable by recoveryAuthority. Uses chainid + nonce for replay protection.
    function nullifyAndSweepEth(RecoveryOp calldata op) external {
        _onlyRecoveryAuthority();
        _consumeNonce(op);
        _nullifyKey(op.opId);
        _sweepEth(op.opId);
    }

    /// @notice Nullify the operational key and sweep an ERC20 token.
    /// @dev Token must implement a standard transfer; no return value assumptions.
    function nullifyAndSweepToken(RecoveryOp calldata op, address token) external {
        _onlyRecoveryAuthority();
        _consumeNonce(op);
        _nullifyKey(op.opId);
        _sweepToken(token, op.opId);
    }

    /// @notice Sweep ETH only (for follow-up operations after nullification).
    function sweepEth(RecoveryOp calldata op) external {
        _onlyRecoveryAuthority();
        _consumeNonce(op);
        if (!keyNullified) revert AlreadyNullified(); // require nullification first
        _sweepEth(op.opId);
    }

    /// @notice Sweep an ERC20 token only (for follow-up operations after nullification).
    function sweepToken(RecoveryOp calldata op, address token) external {
        _onlyRecoveryAuthority();
        _consumeNonce(op);
        if (!keyNullified) revert AlreadyNullified();
        _sweepToken(token, op.opId);
    }

    /// @notice View helper to compute the replay key for a given op.
    function replayKey(RecoveryOp calldata op) public view returns (bytes32) {
        return keccak256(abi.encodePacked(block.chainid, address(this), op.nonce));
    }

    /// @dev Internal: enforce recoveryAuthority.
    function _onlyRecoveryAuthority() internal view {
        if (msg.sender != recoveryAuthority) revert NotRecoveryAuthority();
    }

    /// @dev Internal: consume a nonce with chainid binding and deadline check.
    function _consumeNonce(RecoveryOp calldata op) internal {
        if (op.deadline < block.timestamp) revert("EIP777G: expired");
        bytes32 key = replayKey(op);
        if (usedNonces[key]) revert NonceAlreadyUsed();
        usedNonces[key] = true;
    }

    /// @dev Internal: set keyNullified and emit event (idempotent guard).
    function _nullifyKey(bytes32 opId) internal {
        if (keyNullified) revert AlreadyNullified();
        keyNullified = true;
        emit KeyNullified(msg.sender, block.chainid, opId);
    }

    /// @dev Internal: sweep ETH to cleanWallet.
    function _sweepEth(bytes32 opId) internal {
        uint256 bal = address(this).balance;
        if (bal == 0) return;
        (bool ok, ) = cleanWallet.call{value: bal}("");
        require(ok, "EIP777G: ETH sweep failed");
        emit EthSwept(bal, block.chainid, opId);
    }

    /// @dev Internal: sweep ERC20 tokens to cleanWallet.
    function _sweepToken(address token, bytes32 opId) internal {
        uint256 bal = _tokenBalance(token);
        if (bal == 0) return;
        _safeTokenTransfer(token, cleanWallet, bal);
        emit AssetsSwept(token, bal, block.chainid, opId);
    }

    /// @dev Minimal ERC20 balanceOf interface.
    function _tokenBalance(address token) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(ok && data.length >= 32, "EIP777G: balanceOf failed");
        return abi.decode(data, (uint256));
    }

    /// @dev Minimal ERC20 transfer interface.
    function _safeTokenTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "EIP777G: transfer failed");
    }

    /// @notice Allow the contract to receive ETH.
    receive() external payable {}
}
