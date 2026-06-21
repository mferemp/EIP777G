// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MockERC721 {
    mapping(uint256 => address) public ownerOf;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "not owner");
        ownerOf[tokenId] = to;
    }
}
