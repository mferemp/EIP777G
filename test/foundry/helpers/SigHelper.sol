// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

/// Builds EIP-712-style signatures that match AuroraGate's _verify() logic.
contract SigHelper is Test {

    bytes32 internal constant DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    bytes32 internal constant OP_TYPE_HASH =
        keccak256("Op(uint256 id,address dest,uint256 chainId,address gate)");

    function buildDomainSep(address gate) internal view returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256(bytes("AuroraGate")),
            block.chainid,
            gate
        ));
    }

    function signOp(
        uint256 k2PrivKey,
        address gate,
        uint256 id,
        address dest
    ) internal view returns (bytes memory) {
        bytes32 domainSep = buildDomainSep(gate);
        bytes32 structHash = keccak256(abi.encode(
            OP_TYPE_HASH,
            id,
            dest,
            block.chainid,
            gate
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(k2PrivKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
