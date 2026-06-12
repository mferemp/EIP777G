// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC777Sender.sol";
import "@openzeppelin/contracts/interfaces/IERC777Recipient.sol";

/// @title MockERC777Sender
/// @dev Mock contract implementing ERC777TokensSender and ERC777TokensRecipient for testing
contract MockERC777Sender is IERC777Sender, IERC777Recipient {
    address public lastTokensToSendOperator;
    address public lastTokensToSendFrom;
    address public lastTokensToSendTo;
    uint256 public lastTokensToSendAmount;
    bytes public lastTokensToSendData;
    bytes public lastTokensToSendOperatorData;
    bool public tokensToSendCalled;

    address public lastTokensReceivedOperator;
    address public lastTokensReceivedFrom;
    address public lastTokensReceivedTo;
    uint256 public lastTokensReceivedAmount;
    bytes public lastTokensReceivedData;
    bytes public lastTokensReceivedOperatorData;
    bool public tokensReceivedCalled;

    function tokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external {
        lastTokensToSendOperator = operator;
        lastTokensToSendFrom = from;
        lastTokensToSendTo = to;
        lastTokensToSendAmount = amount;
        lastTokensToSendData = data;
        lastTokensToSendOperatorData = operatorData;
        tokensToSendCalled = true;
    }

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