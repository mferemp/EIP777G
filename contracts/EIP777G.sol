// SPDX-License-Identifier: PROPRIETARY
// EIP777G — Irrevocable Key Nullification Gate
// Owner: Empress (@Hope_ology) — Sole Author / IP / Property
// NO REPRODUCTION, REDISTRIBUTION, OR REVERSE ENGINEERING PERMITTED
// This contract implements the exact mechanism specified by Empress.

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
    // ═════════════════════════════════════════════════════════════════════════
    // STORAGE — IMMUTABLE WHITELIST SET AT CONSTRUCTION
    // ════════════════════════════════════════════════════════════════════════
    address public immutable thresholdSigner;   // K1 — ingress (can only queue)
    address public immutable k2Authority;       // K2 — must sign authorizeTransaction
    address public immutable defaultDropWallet; // K3 — terminus / clean drop
    address public immutable cleanWallet;       // additional verified wallet
    
    uint64 public immutable authWindow;         // K2 authorization window (seconds)
    uint64 public immutable minDelay;           // minimum delay before execute
    
    // ════════════════════════════════════════════════════════════════════════
    // RATE GUARD — PER-K1 ATTEMPT COUNTERS + BLACKLIST
    // ════════════════════════════════════════════════════════════════════════
    mapping(address => uint256) public k1Attempts;
    mapping(address => bool) public k1Blacklisted;
    uint256 public constant MAX_K1_ATTEMPTS = 50;
    
    // ════════════════════════════════════════════════════════════════════════
    // QUEUE STORAGE
    // ═══════════════════════════════════════════════════════════════════════
    struct QueuedTx {
        bytes32 txHash;
        address target;
        uint256 value;
        bytes data;
        uint256 gasLimit;
        uint64 queuedAt;
        address k2OverrideDest; // optional K2-chosen destination
        bool authorized;
        bool executed;
        bytes k2Sig;
    }
    mapping(bytes32 => QueuedTx) public queue;
    
    // ═══════════════════════════════════════════════════════════════════════
    // WHITELIST — GAS CAP & RATE BYPASS (IMMUTABLE, SET AT CONSTRUCTION)
    // ════════════════════════════════════════════════════════════════════════
    mapping(address => bool) public whitelisted;
    uint256 public constant GAS_CAP = 8_000_000;
    
    // ═══════════════════════════════════════════════════════════════════════
    // SEVERANCE FLAGS — ONCE SEVERED, IRREVERSIBLE
    // ═══════════════════════════════════════════════════════════════════════
    bool public ingressSevered;
    bool public egressSevered;
    
    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ════════════════════════════════════════════════════════════════════════
    event Queued(bytes32 indexed txHash, address indexed k1, address target, uint256 value, uint64 queuedAt);
    event Authorized(bytes32 indexed txHash, address indexed k2, address k2OverrideDest);
    event Executed(bytes32 indexed txHash, bool success);
    event ForwardedERC20(address indexed token, bytes32 indexed authTxHash, address to);
    event ForwardedERC721(address indexed nft, uint256 indexed tokenId, bytes32 indexed authTxHash);
    event IngressSevered();
    event EgressSevered();
    event K1Blacklisted(address indexed k1);
    event GasCapExceeded(bytes32 indexed txHash, uint256 gasUsed);
    
    // ═══════════════════════════════════════════════════════════════════════
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
    // CONSTRUCTOR — SINGLE USE, IMMUTABLE WHITELIST
    // ═══════════════════════════════════════════════════════════════════════
    constructor(
        address _thresholdSigner,
        address _k2Authority,
        address _defaultDropWallet,
        address _cleanWallet,
        uint64 _authWindow,
        uint64 _minDelay,
        address[] memory _additionalWhitelisted
    ) {
        thresholdSigner = _thresholdSigner;
        k2Authority = _k2Authority;
        defaultDropWallet = _defaultDropWallet;
        cleanWallet = _cleanWallet;
        authWindow = _authWindow;
        minDelay = _minDelay;
        
        whitelisted[_thresholdSigner] = true;
        whitelisted[_k2Authority] = true;
        whitelisted[_defaultDropWallet] = true;
        whitelisted[_cleanWallet] = true;
        for (uint i = 0; i < _additionalWhitelisted.length; i++) {
            whitelisted[_additionalWhitelisted[i]] = true;
        }
        status = NOT_ENTERED;
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // CORE: K1 QUEUES — BY ITSELF NEVER MOVES VALUE
    // ═══════════════════════════════════════════════════════════════════════
    function queueTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 gasLimit,
        bytes32 nonce
    ) external returns (bytes32) {
        require(msg.sender == thresholdSigner, "Only K1 can queue");
        require(!k1Blacklisted[msg.sender], "K1 blacklisted");
        require(gasLimit <= GAS_CAP, "Gas cap exceeded");
        
        bytes32 txHash = keccak256(abi.encode(target, value, data, gasLimit, nonce, block.timestamp));
        require(queue[txHash].target == address(0), "Already queued");
        
        k1Attempts[msg.sender]++;
        if (k1Attempts[msg.sender] >= MAX_K1_ATTEMPTS) {
            k1Blacklisted[msg.sender] = true;
            emit K1Blacklisted(msg.sender);
        }
        
        queue[txHash] = QueuedTx({
            txHash: txHash,
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
        
        emit Queued(txHash, msg.sender, target, value, uint64(block.timestamp));
        return txHash;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE: K2 AUTHORIZES — NO K2 SIG = INERT, CAN EXPIRE/PENALIZE
    // ═══════════════════════════════════════════════════════════════════════
    function authorizeTransaction(
        bytes32 txHash,
        address overrideDestination,
        bytes calldata k2Sig
    ) external nonReentrant {
        require(msg.sender == k2Authority, "Only K2 can authorize");
        
        QueuedTx storage q = queue[txHash];
        require(q.target != address(0), "Not queued");
        require(!q.authorized, "Already authorized");
        require(!q.executed, "Already executed");
        require(block.timestamp <= q.queuedAt + authWindow, "Auth window expired");
        
        // Verify K2 signature over txHash + overrideDestination
        bytes32 authHash = keccak256(abi.encode(txHash, overrideDestination));
        address recovered = _ecrecover(authHash, k2Sig);
        require(recovered == k2Authority, "Invalid K2 signature");
        
        q.authorized = true;
        q.k2OverrideDest = overrideDestination;
        q.k2Sig = k2Sig;
        
        emit Authorized(txHash, k2Authority, overrideDestination);
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // ECRECOVER HELPER
    // ════════════════════════════════════════════════════════════════════════
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
    
    // ════════════════════════════════════════════════════════════════════════
    // CORE: EXECUTE — MIN DELAY, AUTH WINDOW, BOUNDED GAS, SWEEP TO DROP WALLET
    // ════════════════════════════════════════════════════════════════════════
    function executeTransaction(bytes32 txHash) external nonReentrant {
        QueuedTx storage q = queue[txHash];
        require(q.target != address(0), "Not queued");
        require(q.authorized, "Not authorized by K2");
        require(!q.executed, "Already executed");
        require(block.timestamp >= q.queuedAt + minDelay, "Min delay not elapsed");
        require(block.timestamp <= q.queuedAt + authWindow, "Auth window expired");
        
        address dest = q.k2OverrideDest != address(0) ? q.k2OverrideDest : q.target;
        q.executed = true;
        
        bool success;
        if (q.value > 0) {
            (success,) = dest.call{value: q.value, gas: q.gasLimit}(q.data);
        } else {
            (success,) = dest.call{gas: q.gasLimit}(q.data);
        }
        
        // Sweep ETH to drop wallet immediately after execution
        if (address(this).balance > 0) {
            (bool swept,) = defaultDropWallet.call{value: address(this).balance}("");
            require(swept, "Drop wallet sweep failed");
        }
        
        emit Executed(txHash, success);
        if (!success) revert("Execution failed");
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // FORWARD ERC20 — ONLY TO K2-CHOSEN DESTINATION, NOT ARBITRARY ADDRESSES
    // ═════════════════════════════════════════════════════════════════════════
    function forwardERC20(address token, bytes32 authorizedTxHash) external nonReentrant {
        QueuedTx storage q = queue[authorizedTxHash];
        require(q.target != address(0), "Not queued");
        require(q.authorized, "Not authorized");
        require(q.executed, "Not executed");
        require(q.k2OverrideDest != address(0), "No K2 override destination set");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance to forward");
        
        IERC20(token).safeTransfer(q.k2OverrideDest, balance);
        emit ForwardedERC20(token, authorizedTxHash, q.k2OverrideDest);
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // FORWARD ERC721 — ONLY TO K2-CHOSEN DESTINATION
    // ════════════════════════════════════════════════════════════════════════
    function forwardERC721(address nft, uint256 tokenId, bytes32 authorizedTxHash) external nonReentrant {
        QueuedTx storage q = queue[authorizedTxHash];
        require(q.target != address(0), "Not queued");
        require(q.authorized, "Not authorized");
        require(q.executed, "Not executed");
        require(q.k2OverrideDest != address(0), "No K2 override destination set");
        
        require(IERC721(nft).ownerOf(tokenId) == address(this), "Not owner");
        
        IERC721(nft).safeTransferFrom(address(this), q.k2OverrideDest, tokenId);
        emit ForwardedERC721(nft, tokenId, authorizedTxHash);
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
    // SEVERANCE — IRREVERSIBLE, K2-SIGNED OR GOVERNANCE
    // ═══════════════════════════════════════════════════════════════════════
    function severIngress() external nonReentrant {
        require(msg.sender == k2Authority || msg.sender == cleanWallet, "Only K2 or clean wallet can sever ingress");
        require(!ingressSevered, "Already severed");
        ingressSevered = true;
        emit IngressSevered();
    }
    
    function severEgress() external nonReentrant {
        require(msg.sender == k2Authority || msg.sender == cleanWallet, "Only K2 or clean wallet can sever egress");
        require(!egressSevered, "Already severed");
        egressSevered = true;
        emit EgressSevered();
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // ERC-777 HOOKS — MINIMAL, NO STATE LEAKAGE
    // ═══════════════════════════════════════════════════════════════════════
    function tokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {
        // Silent acceptance — K1 can only queue, not directly send
        // Hook fires but no state change allowed
    }
    
    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {
        // Silent acceptance
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // RECEIVE / FALLBACK
    // ═══════════════════════════════════════════════════════════════════════
    receive() external payable {
        // Accept ETH (e.g., for funding or airdrops)
    }
    
    fallback() external {
        revert("Unknown call");
    }
    
    // ════════════════════════════════════════════════════════════════════════
    // VIEW HELPERS
    // ════════════════════════════════════════════════════════════════════════
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
    
    // Minimal health check
    function _healthCheck() external view returns (bytes32) {
        return keccak256("eip777g.v1.alive");
    }
