// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EIP777G - Asset Routing Authorization Gate
 * @notice Irrevocable key nullification to re-possess a compromised wallet
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

contract EIP777G {
    // ... (contract code from earlier extract)
}
