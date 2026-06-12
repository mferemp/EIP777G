// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC777Recipient.sol";

/// @title MockERC777Recipient
/// @dev Mock contract implementing ERC777TokensRecipient for testing
contract MockERC777Recipient is IERC777Recipient {
    address public lastTokensReceivedOperator;
    address public lastTokensReceivedFrom;
    address public lastTokensReceivedTo;
    uint256 public lastTokensReceivedAmount;
    bytes public lastTokensReceivedData;
    bytes public lastTokensReceivedOperatorData;
    bool public tokensReceivedCalled;

    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external {
        lastTokensReceivedOperator = operator;
        lastTokensReceivedFrom = from;
        lastTokensReceivedTo = to;
        lastTokensReceivedAmount = amount;
        lastTokensReceivedData = data;
        lastTokensReceivedOperatorData = operatorData;
        tokensReceivedCalled = true;
    }
}