// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "./helpers/SigHelper.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockERC721.sol";
import "../../contracts/AuroraGate.sol";

contract AuroraGateTest is Test, SigHelper {
    uint256 constant K2_KEY = 0xDEADB0B;
    uint256 constant K3_KEY = 0xC1EAD;

    address K2;
    address K3;
    address ATTACKER;
    address GENESIS;

    AuroraGate gate;
    MockERC20 token20;
    MockERC721 token721;

    uint256 nextOpId = 1;

    function _buildFragments(address target) internal pure returns (bytes32[8] memory frags) {
        bytes32 base = bytes32(uint256(uint160(target)));
        bytes32 r0 = keccak256(abi.encode("frag0", target));
        bytes32 r1 = keccak256(abi.encode("frag1", target));
        bytes32 r2 = keccak256(abi.encode("frag2", target));
        bytes32 r3 = keccak256(abi.encode("frag3", target));
        bytes32 r4 = keccak256(abi.encode("frag4", target));
        bytes32 r5 = keccak256(abi.encode("frag5", target));
        bytes32 r6 = keccak256(abi.encode("frag6", target));
        bytes32 r7 = base ^ r0 ^ r1 ^ r2 ^ r3 ^ r4 ^ r5 ^ r6;
        frags = [r0, r1, r2, r3, r4, r5, r6, r7];
    }

    function setUp() public {
        K2 = vm.addr(K2_KEY);
        K3 = vm.addr(K3_KEY);
        ATTACKER = makeAddr("attacker");
        GENESIS = makeAddr("genesis");

        token20 = new MockERC20();
        token721 = new MockERC721();

        bytes32[8] memory frags = _buildFragments(GENESIS);

        // cleanWallet = address(0) for tests (no receive/fallback)
        bytes32 verifierCommit = keccak256(abi.encode("test.verifier.v1"));
        gate = new AuroraGate(K2, K3, address(0), frags, 1 hours, 1 minutes, verifierCommit);
    }

    function test_queue_rejectsArbitraryDest() public {
        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY, address(gate), nextOpId, ATTACKER);
        vm.expectRevert(AuroraGate.NoArbitrary.selector);
        gate.queue(ATTACKER, 0, "", 100_000, sig, nextOpId++, block.timestamp + 1 hours);
    }

    function test_queue_rejectsExpiredDeadline() public {
        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY, address(gate), nextOpId, GENESIS);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(AuroraGate.Expired.selector);
        gate.queue(GENESIS, 0, "", 100_000, sig, nextOpId++, block.timestamp - 1);
    }

    function test_queue_rejectsBadSig() public {
        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY + 1, address(gate), nextOpId, GENESIS);
        vm.expectRevert(AuroraGate.Unauthorized.selector);
        gate.queue(GENESIS, 0, "", 100_000, sig, nextOpId++, block.timestamp + 1 hours);
    }

    function test_fwd20_sendsToK3() public {
        token20.mint(address(gate), 1000e18);

        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY, address(gate), nextOpId, address(token20));
        gate.fwd20(address(token20), 1000e18, nextOpId++, sig);

        assertEq(token20.balanceOf(K3), 1000e18, "K3 did not receive ERC20");
    }

    function test_fwd721_sendsToK3() public {
        token721.mint(address(gate), 42);

        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY, address(gate), nextOpId, address(token721));
        gate.fwd721(address(token721), 42, nextOpId++, sig);

        assertEq(token721.ownerOf(42), K3, "NFT did not land at K3");
    }

    function test_noCustody_afterFwd20() public {
        token20.mint(address(gate), 500e18);

        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY, address(gate), nextOpId, address(token20));
        gate.fwd20(address(token20), 500e18, nextOpId++, sig);

        assertEq(token20.balanceOf(address(gate)), 0, "gate retained ERC20");
    }

    function test_noCustody_afterFwd721() public {
        token721.mint(address(gate), 99);

        vm.prank(K2);
        bytes memory sig = signOp(K2_KEY, address(gate), nextOpId, address(token721));
        gate.fwd721(address(token721), 99, nextOpId++, sig);

        assertEq(token721.ownerOf(99), K3, "NFT did not leave gate");
    }
}
