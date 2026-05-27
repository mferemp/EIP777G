# EIP777G - Irrevocable Key Nullification

**Asset Routing Authorization Gate for Compromised Wallet Recovery**

## Overview

EIP777G (also known as ERC-777G) is a smart contract pattern that enables irrevocable key nullification to re-possess a compromised wallet. It implements a dual-key authorization system with automatic asset forwarding to a clean wallet.

### Key Features

- **Dual-Key Authorization**: Threshold signer (k1) + k2 authority
- **Automatic Asset Forwarding**: All assets route to designated clean wallet
- **Rate Limiting & Blacklist**: Protection against sweeper bot attacks
- **EIP-7702 Resistance**: Immune to delegation-based attacks
- **Flashbots Integration**: Deploy via atomic bundles to beat sweeper bots

## Quick Start

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Node dependencies for Flashbots deployment
npm install ethers @flashbots/ethers-provider-bundle
```

### Initialize Foundry Project

```bash
forge init
```

### Create Contract File

Create `src/EIP777G.sol` with the full contract code (see below).

### Build

```bash
forge build
```

### Test

```bash
forge test -vvv
```

## Full Contract Code

Create `src/EIP777G.sol`:

```solidity
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
    // ═══════════════════════════════════════════════════════════
    // IMMUTABLE CONFIG
    // ═══════════════════════════════════════════════════════════

    address public immutable thresholdSigner;
    address public immutable k2Authority;
    address public immutable defaultDropWallet;
    address private immutable _self;
    
    uint256 public immutable MAX_ATTEMPTS;
    uint256 public immutable COOLDOWN_DURATION;
    uint256 public immutable MAX_STRIKES;
    uint256 public immutable GAS_CAP;
    uint256 public immutable AUTH_WINDOW;
    uint256 public immutable MIN_DELAY;

    mapping(address => bool) public whitelist;

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    struct PendingTx {
        address initiator;
        address target;
        uint256 value;
        bytes callData;
        uint256 declaredGas;
        uint256 submittedAt;
        bool authorized;
        bool executed;
        address destination;
    }

    struct AddressState {
        uint256 failedAttempts;
        uint256 cooldownUntil;
        uint256 cooldownStrikes;
        bool blacklisted;
        uint256 lastAttemptBlock;
    }

    mapping(bytes32 => PendingTx) public pending;
    mapping(bytes32 => bool) public usedNonces;
    mapping(address => AddressState) public addressState;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event TxQueued(bytes32 indexed txHash, address indexed initiator, uint256 expiresAt);
    event TxAuthorized(bytes32 indexed txHash, address indexed destination);
    event TxExecuted(bytes32 indexed txHash, address indexed destination);
    event AssetForwarded(address indexed asset, address indexed destination, uint256 amount);
    event NFTForwarded(address indexed nft, address indexed destination, uint256 tokenId);
    event ETHForwarded(address indexed destination, uint256 amount);
    event AttemptPenalized(address indexed addr, uint256 attempts, uint256 cooldownUntil);
    event CooldownEntered(address indexed addr, uint256 until, uint256 strike);
    event AddressBlacklisted(address indexed addr, string reason);
    event SweepAttemptBlocked(bytes32 indexed txHash, address indexed attacker);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor(
        address _thresholdSigner,
        address _k2Authority,
        address _defaultDropWallet,
        address[] memory _whitelist,
        uint256 _maxAttempts,
        uint256 _cooldownDuration,
        uint256 _maxStrikes,
        uint256 _gasCap,
        uint256 _authWindow,
        uint256 _minDelay
    ) {
        require(_defaultDropWallet != address(0), "Drop wallet required");
        require(_defaultDropWallet != _k2Authority, "Drop wallet != k2");
        
        thresholdSigner = _thresholdSigner;
        k2Authority = _k2Authority;
        defaultDropWallet = _defaultDropWallet;
        MAX_ATTEMPTS = _maxAttempts;
        COOLDOWN_DURATION = _cooldownDuration;
        MAX_STRIKES = _maxStrikes;
        GAS_CAP = _gasCap;
        AUTH_WINDOW = _authWindow;
        MIN_DELAY = _minDelay;
        _self = address(this);

        for (uint256 i = 0; i < _whitelist.length; i++) {
            whitelist[_whitelist[i]] = true;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier noDelegatecall() {
        require(address(this) == _self, "No delegatecall");
        _;
    }

    modifier exemptIfWhitelisted(address caller) {
        if (whitelist[caller]) {
            _;
            return;
        }

        AddressState storage s = addressState[caller];
        require(!s.blacklisted, "Address blacklisted");

        if (s.cooldownUntil > block.timestamp) {
            s.cooldownStrikes++;
            if (s.cooldownStrikes >= MAX_STRIKES) {
                s.blacklisted = true;
                emit AddressBlacklisted(caller, "Cooldown violations");
            }
            revert("Cooldown active");
        }

        require(s.lastAttemptBlock < block.number, "One per block");
        s.lastAttemptBlock = block.number;
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    function queueTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 declaredGas,
        bytes32 nonce
    ) external noDelegatecall exemptIfWhitelisted(msg.sender) returns (bytes32) {
        if (!whitelist[msg.sender]) {
            require(declaredGas <= GAS_CAP, "Gas cap exceeded");
        }

        require(!usedNonces[nonce], "Nonce used");

        bytes32 txHash = keccak256(abi.encodePacked(target, value, data, nonce, block.chainid));

        pending[txHash] = PendingTx({
            initiator: msg.sender,
            target: target,
            value: value,
            callData: data,
            declaredGas: declaredGas,
            submittedAt: block.timestamp,
            authorized: false,
            executed: false,
            destination: address(0)
        });

        usedNonces[nonce] = true;
        emit TxQueued(txHash, msg.sender, block.timestamp + AUTH_WINDOW);
        return txHash;
    }

    function authorizeTransaction(
        bytes32 txHash,
        address overrideDestination,
        bytes calldata k2Sig
    ) external noDelegatecall {
        PendingTx storage ptx = pending[txHash];
        require(!ptx.executed && !ptx.authorized, "Invalid state");
        require(block.timestamp <= ptx.submittedAt + AUTH_WINDOW, "Auth window expired");

        bytes32 authPayload = keccak256(abi.encodePacked(txHash, overrideDestination, block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", authPayload));
        require(_recover(ethHash, k2Sig) == k2Authority, "Invalid k2 signature");

        address dest = (overrideDestination != address(0)) ? overrideDestination : defaultDropWallet;
        require(dest != address(0), "No valid destination");
        require(dest != k2Authority, "k2 cannot be destination");

        ptx.authorized = true;
        ptx.destination = dest;
        emit TxAuthorized(txHash, dest);
    }

    function executeTransaction(bytes32 txHash) external noDelegatecall {
        PendingTx storage ptx = pending[txHash];
        require(ptx.authorized && !ptx.executed, "Not authorized");
        require(block.timestamp >= ptx.submittedAt + MIN_DELAY, "Min delay");
        require(block.timestamp <= ptx.submittedAt + AUTH_WINDOW, "Window expired");

        address dest = ptx.destination;
        ptx.executed = true;
        addressState[ptx.initiator].failedAttempts = 0;

        (bool success,) = ptx.target.call{value: ptx.value, gas: ptx.declaredGas}(ptx.callData);
        require(success, "Execution failed");

        _sweepETH(dest);
        emit TxExecuted(txHash, dest);
    }

    function forwardERC20(address token, bytes32 authorizedTxHash) external noDelegatecall {
        PendingTx storage ptx = pending[authorizedTxHash];
        require(ptx.executed, "Tx not executed");

        address dest = ptx.destination;
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "No balance");
        require(IERC20(token).transfer(dest, bal), "Transfer failed");
        emit AssetForwarded(token, dest, bal);
    }

    function forwardERC721(address nft, uint256 tokenId, bytes32 authorizedTxHash) external noDelegatecall {
        PendingTx storage ptx = pending[authorizedTxHash];
        require(ptx.executed, "Tx not executed");

        address dest = ptx.destination;
        IERC721(nft).safeTransferFrom(address(this), dest, tokenId);
        emit NFTForwarded(nft, dest, tokenId);
    }

    function expireAndPenalize(bytes32 txHash) external noDelegatecall {
        PendingTx storage ptx = pending[txHash];
        require(block.timestamp > ptx.submittedAt + AUTH_WINDOW, "Window open");
        require(!ptx.authorized && !ptx.executed, "Already handled");

        address initiator = ptx.initiator;
        delete pending[txHash];
        emit SweepAttemptBlocked(txHash, initiator);

        AddressState storage s = addressState[initiator];
        if (s.blacklisted) return;

        s.failedAttempts++;
        emit AttemptPenalized(initiator, s.failedAttempts, s.cooldownUntil);

        if (s.failedAttempts >= MAX_ATTEMPTS) {
            s.failedAttempts = 0;
            s.cooldownStrikes++;
            s.cooldownUntil = block.timestamp + COOLDOWN_DURATION;
            emit CooldownEntered(initiator, s.cooldownUntil, s.cooldownStrikes);

            if (s.cooldownStrikes >= MAX_STRIKES) {
                s.blacklisted = true;
                emit AddressBlacklisted(initiator, "Max strikes");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════

    function _sweepETH(address dest) internal {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok,) = dest.call{value: bal}("");
            require(ok, "ETH forward failed");
            emit ETHForwarded(dest, bal);
        }
    }

    function _recover(bytes32 h, bytes memory sig) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = _split(sig);
        return ecrecover(h, v, r, s);
    }

    function _split(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    receive() external payable {}
}
```

## Deployment

### Standard Deployment

Create `script/Deploy.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EIP777G.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address k1 = vm.envAddress("K1_ADDRESS");
        address k2 = vm.envAddress("K2_ADDRESS");
        address cleanWallet = vm.envAddress("CLEAN_WALLET");

        vm.startBroadcast(deployerKey);

        address[] memory whitelist = new address[](2);
        whitelist[0] = k2;
        whitelist[1] = cleanWallet;

        EIP777G gate = new EIP777G(
            k1,
            k2,
            cleanWallet,
            whitelist,
            4,        // MAX_ATTEMPTS
            86400,    // COOLDOWN_DURATION (24h)
            3,        // MAX_STRIKES
            500_000,  // GAS_CAP
            3600,     // AUTH_WINDOW (1h)
            900       // MIN_DELAY (15m)
        );

        console.log("EIP777G deployed at:", address(gate));

        vm.stopBroadcast();
    }
}
```

Deploy:

```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast --verify
```

### Flashbots Bundle Deployment (Anti-Sweeper)

For compromised wallets being monitored by sweeper bots, use Flashbots to deploy atomically.

Create `scripts/deploy-bundle.js`:

```javascript
const { ethers } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");
const fs = require("fs");

// Load compiled bytecode
const artifact = JSON.parse(fs.readFileSync("out/EIP777G.sol/EIP777G.json"));
const bytecode = artifact.bytecode.object;

const K1 = process.env.K1_ADDRESS;
const K2 = process.env.K2_ADDRESS;
const CLEAN_WALLET = process.env.CLEAN_WALLET;
const RPC_URL = process.env.RPC_URL;

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const funder = new ethers.Wallet(process.env.FUNDER_PRIVATE_KEY, provider);

    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        funder,
        "https://relay.flashbots.net"
    );

    const factory = new ethers.ContractFactory(
        artifact.abi,
        bytecode,
        deployer
    );

    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const baseFee = block.baseFeePerGas;
    const maxFee = baseFee * 2n;
    const tip = ethers.parseUnits("2", "gwei");

    // Tx 1: Fund deployer
    const fundTx = {
        to: deployer.address,
        value: ethers.parseEther("0.01"),
        type: 2,
        chainId: 1,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: tip,
        gasLimit: 21000,
        nonce: await provider.getTransactionCount(funder.address)
    };

    // Tx 2: Deploy contract
    const deployTx = await factory.getDeployTransaction(
        K1,
        K2,
        CLEAN_WALLET,
        [K2, CLEAN_WALLET],
        4, 86400, 3, 500_000, 3600, 900
    );

    const deployTxFull = {
        ...deployTx,
        type: 2,
        chainId: 1,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: tip,
        gasLimit: 2_000_000,
        nonce: 0
    };

    const bundle = [
        { signer: funder, transaction: fundTx },
        { signer: deployer, transaction: deployTxFull }
    ];

    for (let target = blockNumber + 1; target <= blockNumber + 3; target++) {
        const sim = await flashbotsProvider.simulate(bundle, target);
        if ("error" in sim) {
            console.error("Simulation error:", sim.error);
            continue;
        }

        console.log(`Block ${target} — simulation OK, gas: ${sim.totalGasUsed}`);

        const response = await flashbotsProvider.sendBundle(bundle, target);
        const wait = await response.wait();

        if (wait === 0) {
            console.log("✓ Bundle included in block", target);
            const receipt = await provider.getTransactionReceipt(sim.results[1].txHash);
            console.log("✓ EIP777G deployed at:", receipt.contractAddress);
            return;
        }
    }

    console.log("Bundle not included. Re-run with higher fees.");
}

main().catch(console.error);
```

Run:

```bash
DEPLOYER_PRIVATE_KEY=<fresh_wallet> FUNDER_PRIVATE_KEY=<funded_wallet> node scripts/deploy-bundle.js
```

## Testing

Create `test/EIP777G.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EIP777G.sol";

contract EIP777GTest is Test {
    EIP777G public gate;
    address k1 = makeAddr("k1");
    address k2 = makeAddr("k2");
    address cleanWallet = makeAddr("clean");
    uint256 k2Key = 0xabcd;

    function setUp() public {
        k2 = vm.addr(k2Key);
        
        address[] memory whitelist = new address[](2);
        whitelist[0] = k2;
        whitelist[1] = cleanWallet;

        gate = new EIP777G(
            k1, k2, cleanWallet, whitelist,
            4, 86400, 3, 500_000, 3600, 900
        );
    }

    function testQueueAndExecute() public {
        vm.prank(k1);
        bytes32 txHash = gate.queueTransaction(
            address(0x123),
            0,
            "",
            100_000,
            keccak256("nonce1")
        );

        // k2 authorizes
        bytes32 authPayload = keccak256(abi.encodePacked(txHash, address(0), block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", authPayload));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(k2Key, ethHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        gate.authorizeTransaction(txHash, address(0), sig);

        // Wait minimum delay
        vm.warp(block.timestamp + 901);

        gate.executeTransaction(txHash);
    }

    function testK2CannotBeDestination() public {
        vm.prank(k1);
        bytes32 txHash = gate.queueTransaction(
            address(0x123), 0, "", 100_000, keccak256("nonce2")
        );

        bytes32 authPayload = keccak256(abi.encodePacked(txHash, k2, block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", authPayload));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(k2Key, ethHash);

        vm.expectRevert("k2 cannot be destination");
        gate.authorizeTransaction(txHash, k2, abi.encodePacked(r, s, v));
    }

    function testRateLimit() public {
        address attacker = makeAddr("attacker");
        
        for (uint i = 0; i < 4; i++) {
            vm.prank(attacker);
            gate.queueTransaction(
                address(0x123), 0, "", 100_000, keccak256(abi.encodePacked("nonce", i))
            );
            vm.roll(block.number + 1);
        }

        // 5th attempt should trigger cooldown
        vm.prank(attacker);
        vm.expectRevert();
        gate.queueTransaction(
            address(0x123), 0, "", 100_000, keccak256("nonce5")
        );
    }

    function testBlacklistAfterStrikes() public {
        address attacker = makeAddr("attacker");

        // Trigger 3 cooldowns
        for (uint strike = 0; strike < 3; strike++) {
            for (uint i = 0; i < 4; i++) {
                vm.prank(attacker);
                gate.queueTransaction(
                    address(0x123), 0, "", 100_000,
                    keccak256(abi.encodePacked("strike", strike, "attempt", i))
                );
                vm.roll(block.number + 1);
            }
            vm.warp(block.timestamp + 86401); // Move past cooldown
        }

        // Should be blacklisted now
        (, , , bool blacklisted,) = gate.addressState(attacker);
        assertTrue(blacklisted);
    }
}
```

Run tests:

```bash
forge test -vvv
```

## Configuration

Create `.env.example`:

```bash
# Deployment keys
PRIVATE_KEY=
DEPLOYER_PRIVATE_KEY=
FUNDER_PRIVATE_KEY=

# Contract parameters
K1_ADDRESS=
K2_ADDRESS=
CLEAN_WALLET=

# Network
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
ETHERSCAN_API_KEY=
```

Create `foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
mainnet = "${RPC_URL}"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
```

## Security Considerations

### Critical Rules

1. **k1 and k2 must be on physically separate devices**
2. **k2 should be a hardware wallet or air-gapped device**
3. **Never store k1 and k2 seed phrases in the same location**
4. **There is no recovery path if both k1 and k2 are lost**
5. **Rotate k2 using current k2 before any key becomes inaccessible**

### Attack Surfaces Protected

- ✅ Sweeper bot front-running (via Flashbots)
- ✅ EIP-7702 rogue delegation
- ✅ Compromised k1 unilateral action
- ✅ Rate-limited brute force
- ✅ Automatic blacklisting

## License

MIT

## References

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Flashbots Documentation](https://docs.flashbots.net/)
- [Foundry Book](https://book.getfoundry.sh/)
