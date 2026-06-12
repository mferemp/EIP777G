// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockNoHook
/// @dev Contract that does NOT implement ERC777TokensRecipient
/// @dev Used to test that tokens cannot be sent to contracts without hooks
contract MockNoHook {
    // Intentionally does not implement IERC777Recipient
    // Receiving tokens should revert via ERC1820
}