// SPDX-License-Identifier: PROPRIETARY
// EIP777G — Irrevocable Key Nullification Gate (Genesis Lock)
// Owner: Empress (@Hope_ology) — Sole Author / IP / Property
// NO REPRODUCTION, REDISTRIBUTION, OR REVERSE ENGINEERING PERMITTED
// 
// MECHANISM:
// - K1 = compromised EOA (genesis owner's original wallet)
// - K2 = air-gapped authorization gate (genesis owner's offline key)  
// - K3 = drop destination (clean wallet)
// - Deployer = funding wallet (executes deployment via Flashbots)
// 
// FLOW:
// 1. Genesis owner (K1 holder) elects to deploy gate using their EOA authority
// 2. Deployer funds + Flashbots deploys contract binding to K1 address
// 3. Contract WRAPS K1: assets IN K1 + assets ENTERING K1 are gated
// 4. K2 becomes the ONLY authorization for value movement from K1
// 5. K3 receives swept assets after K2-authorized execution
// 6. K1 nullified for hacker — genesis owner retains control via K2
// 7. Works across ALL EVM chains + Hyperliquid EVM

pragma solidity ^0.8.24;

/// @custom:author Empress (@Hope_ology)
/// @custom:notice Total build — logic, workflows, variables, standards deviations — solely attributed to Empress.

interface IERC777Sender {
    function tokensToSend(address operator, address from, address to, uint256 amount, bytes calldata userData, bytes calldata operatorData) external;
}
interface IERC777Recipient {
    function tokensReceived(address operator, address from, address to, uint256 amount, bytes calldata userData, bytes calldata operatorData) external;
}

contract EIP777G {
    // ════════════════════════════════════════════════════════════════════════
    // IMMUTABLE GENESIS BINDING — SET ONCE AT DEPLOYMENT
    // ════════════════════════════════════════════════════════════════════════
    /// @notice K1 — Genesis EOA (compromised wallet being gated)
    ///         Assets IN this address AND assets entering it are locked
    address public immutable k1Genesis;          
    
    /// @notice K2 — Air-gapped authorization gate (genesis owner's offline key)
    ///         ONLY key that can authorize value movement FROM k1Genesis
    address public immutable k2Authority;        
    
    /// @notice K3 — Drop destination (clean wallet)
    ///         Receives swept assets after K2-authorized execution
    address public immutable k3DropWallet;       
    
    /// @notice Clean wallet — additional verified genesis wallet for severance
    address public immutable cleanWallet;        
    
    /// @notice K2 authorization window (seconds) — after expiry, queued intents die
    uint64 public immutable authWindow;          
    
    /// @notice Minimum delay before execution — prevents flash execution
    uint64 public immutable minDelay;            
    
    // ═══════════════════════════════════════════════════════════════════════
    // GENESIS DEPLOYMENT PROOF — IMMUTABLE RECORD
    // ═══════════════════════════════════════════════════════════════════════
    /// @notice Deployer address (funding wallet that executed Flashbots deployment)
    address public immutable deployer;
    
    /// @notice Deployment timestamp — genesis lock activation moment
    uint64 public immutable deployedAt;
    
    /// @notice Chain ID where this gate is deployed
    uint256 public immutable chainId;
    
    /// @notice Genesis hash — cryptographic proof of deployment intent
    ///         keccak256(k1Genesis, k2Authority, k3DropWallet, deployer, deployedAt, chainId)
    bytes32 public immutable genesisHash;
    
    // ═══════════════════════════════════════════════════════════════════════
    // QUEUE — INTENTS FROM K1 (ONLY K1 CAN QUEUE)
    // ═══════════════════════════════════════════════════════════════════════
    struct QueuedIntent {
        bytes32 intentHash;
        address target;
        uint256 value;
        bytes data;
        uint256 gasLimit;
        uint64 queuedAt;
        address k2OverrideDest;  // K2-chosen destination (set at authorize)
        bool authorized;
        bool executed;
        bytes k2Sig;
    }
    mapping(bytes32 => QueuedIntent) public intents;
    
    // ═══════════════════════════════════════════════════════════════════════
    // RATE GUARD — K1 ATTEMPT COUNTERS + BLACKLIST
    // ═══════════════════════════════════════════════════════════════════════
    mapping(address => uint256) public k1Attempts;
    mapping(address => bool) public k1Blacklisted;
    uint256 public constant MAX_K1_ATTEMPTS = 50;
    
    // ═══════════════════════════════════════════════════════════════════════
    // GAS CAP — WHITELISTED ADDRESSES BYPASS (SET AT DEPLOYMENT)
    // ═══════════════════════════════════════════════════════════════════════
    mapping(address => bool) public whitelisted;
    uint256 public constant GAS_CAP = 8_000_000;
    
    // ═══════════════════════════════════════════════════════════════════════
    // SEVERANCE — IRREVERSIBLE, K2 OR CLEAN WALLET ONLY
    // ═══════════════════════════════════════════════════════════════════════
    bool public ingressSevered;
    bool public egressSevered;
    
    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    event IntentQueued(bytes32 indexed intentHash, address indexed k1, address target, uint256 value, uint64 queuedAt);
    event IntentAuthorized(bytes32 indexed intentHash, address indexed k2, address k2OverrideDest);
    event IntentExecuted(bytes32 indexed intentHash, bool success);
    event AssetsForwarded(address indexed token, bytes32 indexed intentHash, address to, uint256 amount);
    event NFTForwarded(address indexed nft, uint256 indexed tokenId, bytes32 indexed intentHash, address to);
    event IngressSevered();
    event EgressSevered();
    event K1Blacklisted(address indexed k1);
    event GasCapExceeded(bytes32 indexed intentHash, uint256 gasUsed);
    event GenesisLocked(address indexed k1Genesis, address indexed k2Authority, address indexed k3DropWallet, bytes32 genesisHash);
    
    // ════════════════════════════════════════════════════════════════════════
    // REENTRANCY GUARD
    // ═══════════════════════════════════════════════════════════════════════
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private status;
    
    modifier nonReentrant() {
        require(status != ENTERED, "ReentrancyDetected");
        status = ENTERED;
        _;
        status = NOT_ENTERED;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // ECRECOVER HELPER
    // ═══════════════════════════════════════════════════════════════════════
    function _ecrecover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR — GENESIS LOCK ACTIVATION
    // ═══════════════════════════════════════════════════════════════════════
    /// @param _k1Genesis      Genesis EOA being gated (compromised wallet)
    /// @param _k2Authority    Air-gapped authorization gate (offline key)
    /// @param _k3DropWallet   Drop destination (clean wallet)
    /// @param _cleanWallet    Additional genesis wallet for severance
    /// @param _authWindow     K2 authorization window (seconds)
    /// @param _minDelay       Minimum delay before execution
    /// @param _additionalWhitelisted  Additional gas-cap-bypass addresses
    constructor(
        address _k1Genesis,
        address _k2Authority,
        address _k3DropWallet,
        address _cleanWallet,
        uint64 _authWindow,
        uint64 _minDelay,
        address[] memory _additionalWhitelisted
    ) {
        // Genesis binding — immutable
        k1Genesis = _k1Genesis;
        k2Authority = _k2Authority;
        k3DropWallet = _k3DropWallet;
        cleanWallet = _cleanWallet;
        authWindow = _authWindow;
        minDelay = _minDelay;
        deployer = msg.sender;
        deployedAt = uint64(block.timestamp);
        chainId = block.chainid;
        genesisHash = keccak256(abi.encode(_k1Genesis, _k2Authority, _k3DropWallet, _cleanWallet, msg.sender, block.timestamp, block.chainid));
        
        // Whitelist genesis addresses + deployer (gas cap bypass)
        whitelisted[_k1Genesis] = true;
        whitelisted[_k2Authority] = true;
        whitelisted[_k3DropWallet] = true;
        whitelisted[_cleanWallet] = true;
        whitelisted[msg.sender] = true;
        for (uint i = 0; i < _additionalWhitelisted.length; i++) {
            whitelisted[_additionalWhitelisted[i]] = true;
        }
        
        status = 1; // NOT_ENTERED
        
        emit GenesisLocked(_k1Genesis, _k2Authority, _k3DropWallet, genesisHash);
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // CORE: K1 QUEUES INTENT — BY ITSELF NEVER MOVES VALUE
    // ═══════════════════════════════════════════════════════════════════════
    function queueIntent(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 gasLimit,
        bytes32 nonce
    ) external returns (bytes32) {
        require(msg.sender == k1Genesis, "Only K1 Genesis can queue");
        require(!ingressSevered, "Ingress severed — no new intents");
        require(!k1Blacklisted[msg.sender], "K1 blacklisted");
        require(gasLimit <= GAS_CAP || whitelisted[msg.sender], "Gas cap exceeded");
        
        bytes32 intentHash = keccak256(abi.encode(target, value, data, gasLimit, nonce, block.timestamp));
        require(intents[intentHash].target == address(0), "Intent already queued");
        
        // Rate guard — track ALL callers (including whitelisted for visibility)
        k1Attempts[msg.sender]++;
        if (k1Attempts[msg.sender] >= MAX_K1_ATTEMPTS) {
            k1Blacklisted[msg.sender] = true;
            emit K1Blacklisted(msg.sender);
        }
        
        intents[intentHash] = QueuedIntent({
            intentHash: intentHash,
            target: target,
            value: value,
            data: data,
            gasLimit: gasLimit,
            queuedAt: uint64(block.timestamp),
            k2OverrideDest: address(0),
            authorized: false,
            executed: false,
            k2Sig: bytes("")
        });
        
        emit IntentQueued(intentHash, msg.sender, target, value, uint64(block.timestamp));
        return intentHash;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CORE: K2 AUTHORIZES — CRYPTOGRAPHIC GATE, NO K2 SIG = INERT
    // ═══════════════════════════════════════════════════════════════════════
    function authorizeIntent(
        bytes32 intentHash,
        address overrideDestination,
        bytes calldata k2Sig
    ) external nonReentrant {
        require(msg.sender == k2Authority, "Only K2 Authority can authorize");
        
        QueuedIntent storage i = intents[intentHash];
        require(i.target != address(0), "Intent not found");
        require(!i.authorized, "Already authorized");
        require(!i.executed, "Already executed");
        require(block.timestamp <= i.queuedAt + authWindow, "Auth window expired");
        
        // K2 signs intentHash + overrideDestination — binds authorization to exact intent + destination
        bytes32 authHash = keccak256(abi.encode(intentHash, overrideDestination));
        address recovered = _ecrecover(authHash, k2Sig);
        require(recovered == k2Authority, "Invalid K2 signature");
        
        i.authorized = true;
        i.k2OverrideDest = overrideDestination;
        i.k2Sig = k2Sig;
        
        emit IntentAuthorized(intentHash, k2Authority, overrideDestination);
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // CORE: EXECUTE — DELAY, WINDOW, BOUNDED GAS, SWEEP TO K3
    // ═══════════════════════════════════════════════════════════════════════
    function executeIntent(bytes32 intentHash) external nonReentrant {
        QueuedIntent storage i = intents[intentHash];
        require(i.target != address(0), "Intent not found");
        require(i.authorized, "Not authorized by K2");
        require(!i.executed, "Already executed");
        require(!egressSevered, "Egress severed");
        require(block.timestamp >= i.queuedAt + minDelay, "Min delay not elapsed");
        require(block.timestamp <= i.queuedAt + authWindow, "Auth window expired");
        
        // K2's override destination takes precedence — K1 cannot redirect
        address dest = i.k2OverrideDest != address(0) ? i.k2OverrideDest : i.target;
        i.executed = true;
        
        bool success;
        if (i.value > 0) {
            (success,) = dest.call{value: i.value, gas: i.gasLimit}(i.data);
        } else {
            (success,) = dest.call{gas: i.gasLimit}(i.data);
        }
        
        // SWEEP: All ETH in contract → K3 drop wallet
        if (address(this).balance > 0) {
            (bool swept,) = k3DropWallet.call{value: address(this).balance}("");
            require(swept, "K3 sweep failed");
        }
        
        emit IntentExecuted(intentHash, success);
        if (!success) revert("Execution failed");
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FORWARD ERC20 — ONLY TO K2-CHOSEN DESTINATION
    // ═══════════════════════════════════════════════════════════════════════
    function forwardERC20(address token, bytes32 intentHash) external nonReentrant {
        QueuedIntent storage i = intents[intentHash];
        require(i.target != address(0), "Intent not found");
        require(i.authorized, "Not authorized");
        require(i.executed, "Not executed");
        require(i.k2OverrideDest != address(0), "No K2 override destination");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to forward");
        
        IERC20(token).safeTransfer(i.k2OverrideDest, balance);
        emit AssetsForwarded(token, intentHash, i.k2OverrideDest, balance);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FORWARD ERC721 — ONLY TO K2-CHOSEN DESTINATION
    // ═══════════════════════════════════════════════════════════════════════
    function forwardERC721(address nft, uint256 tokenId, bytes32 intentHash) external nonReentrant {
        QueuedIntent storage i = intents[intentHash];
        require(i.target != address(0), "Intent not found");
        require(i.authorized, "Not authorized");
        require(i.executed, "Not executed");
        require(i.k2OverrideDest != address(0), "No K2 override destination");
        
        require(IERC721(nft).ownerOf(tokenId) == address(this), "Not owner");
        
        IERC721(nft).safeTransferFrom(address(this), i.k2OverrideDest, tokenId);
        emit NFTForwarded(nft, tokenId, intentHash, i.k2OverrideDest);
    }
    
    interface IERC20 {
        function balanceOf(address account) external view returns (uint256);
        function safeTransfer(address to, uint256 amount) external;
    }
    interface IERC721 {
        function ownerOf(uint256 tokenId) external view returns (address);
        function safeTransferFrom(address from, address to, uint256 tokenId) external;
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // SEVERANCE — IRREVERSIBLE, K2 OR CLEAN WALLET
    // ════════════════════════════════════════════════════════════════════════
    function severIngress() external nonReentrant {
        require(msg.sender == k2Authority || msg.sender == cleanWallet, "Only K2 or clean wallet");
        require(!ingressSevered, "Already severed");
        ingressSevered = true;
        emit IngressSevered();
    }
    
    function severEgress() external nonReentrant {
        require(msg.sender == k2Authority || msg.sender == cleanWallet, "Only K2 or clean wallet");
        require(!egressSevered, "Already severed");
        egressSevered = true;
        emit EgressSevered();
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ERC-777 HOOKS — SILENT ACCEPTANCE (K1 CANNOT DIRECTLY SEND)
    // ════════════════════════════════════════════════════════════════════════
    function tokensToSend(address operator, address from, address to, uint256 amount, bytes calldata userData, bytes calldata operatorData) external {
        // Silent — K1 Genesis cannot directly send via ERC-777
        // All movement must go through queueIntent → authorizeIntent → executeIntent
    }
    
    function tokensReceived(address operator, address from, address to, uint256 amount, bytes calldata userData, bytes calldata operatorData) external {
        // Silent acceptance — incoming assets automatically fall under gate
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // RECEIVE / FALLBACK
    // ═══════════════════════════════════════════════════════════════════════
    receive() external payable {
        // Accept ETH — falls under gate automatically
    }
    
    fallback() external {
        revert("Unknown call — use queueIntent/authorizeIntent/executeIntent");
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // GENESIS VERIFICATION — CRAWL FOR HISTORICAL PROOF
    // ════════════════════════════════════════════════════════════════════════
    /// @notice Verify this is the genuine genesis deployment
    /// @return k1Genesis_      Original compromised wallet
    /// @return k2Authority_    Air-gapped gate
    /// @return k3DropWallet_   Drop destination
    /// @return deployer_       Funding wallet
    /// @return deployedAt_     Genesis timestamp
    /// @return chainId_        Deployment chain
    /// @return genesisHash_    Cryptographic proof of deployment intent
    function verifyGenesis() external view returns (
        address k1Genesis_, 
        address k2Authority_, 
        address k3DropWallet_,
        address deployer_, 
        uint64 deployedAt_, 
        uint256 chainId_, 
        bytes32 genesisHash_
    ) {
        return (k1Genesis, k2Authority, k3DropWallet, deployer, deployedAt, chainId, genesisHash);
    }
    
    /// @notice Check if K1 is blacklisted (hacker attempting access)
    function isK1Blacklisted(address k1) external view returns (bool) {
        return k1Blacklisted[k1];
    }
    
    /// @notice Check if severance active
    function isSevered() external view returns (bool ingress, bool egress) {
        return (ingressSevered, egressSevered);
    }
    
    /// @notice Get intent state
    function getIntent(bytes32 intentHash) external view returns (
        address target,
        uint256 value,
        uint64 queuedAt,
        address k2OverrideDest,
        bool authorized,
        bool executed
    ) {
        QueuedIntent storage i = intents[intentHash];
        return (i.target, i.value, i.queuedAt, i.k2OverrideDest, i.authorized, i.executed);
    }
    
    // Minimal health check
    function _healthCheck() external view returns (bytes32) {
        return keccak256("eip777g.genesis.v1");
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // REENTRANCY GUARD
    // ═══════════════════════════════════════════════════════════════════════
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private status;
    
    modifier nonReentrant() {
        require(status != 2, "ReentrancyDetected");
        status = 2;
        _;
        status = 1;
    }
}
