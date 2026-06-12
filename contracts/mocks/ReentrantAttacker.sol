// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC777.sol";
import "@openzeppelin/contracts/interfaces/IERC777Sender.sol";
import "@openzeppelin/contracts/interfaces/IERC777Recipient.sol";

/// @title ReentrantAttacker
/// @dev Contract that attempts reentrancy attack on ERC777 send
contract ReentrantAttacker is IERC777Sender, IERC777Recipient {
    IERC777 public immutable targetToken;
    address public attacker;
    uint256 public attackCount;

    constructor(address _targetToken) {
        targetToken = IERC777(_targetToken);
        attacker = msg.sender;
    }

    function authorizeOperator(address operator) external {
        targetToken.authorizeOperator(operator);
    }

    function attack() external {
        attackCount++;
        // Reentrant call - should be blocked by nonReentrant modifier
        targetToken.send(attacker, 100, "0x");
    }

    function tokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external override {
        // This is called during the send - attempt reentrancy
        if (attackCount == 1) {
            targetToken.send(attacker, 50, "0x");
        }
    }

    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external override {
        // Required for IERC777Recipient interface - do nothing for testing
    }
}