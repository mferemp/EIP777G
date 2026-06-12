// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC777Sender } from "@openzeppelin/contracts/interfaces/IERC777Sender.sol";
import { IERC777Recipient } from "@openzeppelin/contracts/interfaces/IERC777Recipient.sol";
import { IERC1820Registry } from "@openzeppelin/contracts/interfaces/IERC1820Registry.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

/// @title EIP777G - Secure ERC-777 Token with Operator-Gated Architecture
/// @notice Implements ERC-777 with zero EOA workarounds - pure operator/hook model
/// @dev The entire premise: tokens move ONLY via operators + hooks. No approve/transferFrom fallback.
contract EIP777G is AccessControl, ReentrancyGuard {
    using Address for address;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SEVER_ROLE = keccak256("SEVER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // EIP-1820 Interface Hashes
    bytes32 public constant ERC777_SENDER_INTERFACE_HASH = keccak256("ERC777TokensSender");
    bytes32 public constant ERC777_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");
    bytes32 public constant ERC777_TOKEN_INTERFACE_HASH = keccak256("ERC777Token");

    // Immutable state (must come before mutable state)
    address public immutable registry;
    uint256 private immutable _granularity;
    
    // State
    address[] public defaultOperatorsArray;
    mapping(address => bool) public isDefaultOperator;
    mapping(address => mapping(address => bool)) public operatorAuthorizations;
    mapping(address => mapping(address => bool)) public revokedDefaultOperators;
    string private _name;
    string private _symbol;
    
    // Standard ERC-777 balances
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;
    
    // ERC20 allowances (for backwards compatibility, but NOT the primary model)
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Severance / emergency
    bool public ingressSevered;
    address public severedBy;
    uint256 public severedAt;
    
    // Events
    event OperatorAuthorizationChanged(address indexed operator, address indexed holder, bool authorized);
    event DefaultOperatorSet(address indexed operator, bool enabled);
    event IngressSevered(address indexed by, uint256 timestamp);
    event IngressRestored(address indexed by, uint256 timestamp);
    event EmergencyAction(bytes32 indexed action, address indexed actor, bytes data);
    event GranularityViolation(address indexed account, uint256 amount, uint256 requiredGranularity);
    
    // ERC-777 Events
    event Sent(address indexed operator, address indexed from, address indexed to, uint256 amount, bytes data, bytes operatorData);
    event Minted(address indexed operator, address indexed to, uint256 amount, bytes data, bytes operatorData);
    event Burned(address indexed operator, address indexed from, uint256 amount, bytes data, bytes operatorData);
    event AuthorizedOperator(address indexed operator, address indexed holder);
    event RevokedOperator(address indexed operator, address indexed holder);
    
    // ERC-20 Events (for backwards compatibility)
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Custom errors (gas efficient)
    error NotAuthorizedOperator(address operator, address holder);
    error SelfOperatorImmutable(address operator);
    error DefaultOperatorImmutable(address operator);
    error InsufficientBalance(address account, uint256 needed, uint256 have);
    error GranularityViolationError(uint256 amount, uint256 granularity);
    error IngressSeveredError();
    error ZeroAddressNotAllowed();
    error InvalidGranularity(uint256 granularity);
    error OnlyDefaultOperator(address operator);
    error CallerNotOperator(address caller);
    error ReentrancyDetected();
    error SeveranceNotAuthorized(address caller);
    error InvalidCoherenceSecret();

    constructor(
        string memory name_,
        string memory symbol_,
        address[] memory defaultOperators_,
        uint256 granularity_,
        address registry_,
        address admin_
    ) 
    {
        if (granularity_ == 0) revert InvalidGranularity(0);
        _granularity = granularity_;
        _name = name_;
        _symbol = symbol_;
        defaultOperatorsArray = defaultOperators_;
        
        for (uint256 i = 0; i < defaultOperators_.length; i++) {
            isDefaultOperator[defaultOperators_[i]] = true;
        }
        
        if (registry_ == address(0)) revert ZeroAddressNotAllowed();
        registry = registry_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);
        _grantRole(SEVER_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(EMERGENCY_ROLE, admin_);
        
        // Register ERC-777 and ERC-20 interfaces with ERC-1820
        IERC1820Registry(registry).setInterfaceImplementer(address(this), ERC777_TOKEN_INTERFACE_HASH, address(this));
        IERC1820Registry(registry).setInterfaceImplementer(address(this), keccak256("ERC20Token"), address(this));
    }

    /// @notice Register this contract as ERC-777 sender/recipient implementer
    /// @dev Must be called after deployment via ERC1820Registry
    function registerERC1820Implementers(address erc1820Registry) external {
        IERC1820Registry(erc1820Registry).setInterfaceImplementer(
            address(this), ERC777_SENDER_INTERFACE_HASH, address(this)
        );
        IERC1820Registry(erc1820Registry).setInterfaceImplementer(
            address(this), ERC777_RECIPIENT_INTERFACE_HASH, address(this)
        );
    }

    // ==================== ERC-777 View Functions ====================
    
    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    function granularity() public view returns (uint256) {
        return _granularity;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address holder) public view returns (uint256) {
        return _balances[holder];
    }

    function allowance(address holder, address spender) public view returns (uint256) {
        return _allowances[holder][spender];
    }

    // ==================== Granularity Enforcement ====================
    
    function _checkGranularity(uint256 amount) internal {
        if (amount % _granularity != 0) {
            emit GranularityViolation(msg.sender, amount, _granularity);
            revert GranularityViolationError(amount, _granularity);
        }
    }

    // ==================== Operator Model (Core Premise - NO EOA WORKAROUNDS) ====================
    
    /// @notice Check if operator is authorized for holder
    /// @dev This IS the authorization model - no approve/transferFrom fallback
    function isOperatorFor(address operator, address holder) public view returns (bool) {
        if (operator == holder) return true; // Self-operator always valid
        if (isDefaultOperator[operator] && !revokedDefaultOperators[holder][operator]) return true;
        return operatorAuthorizations[holder][operator];
    }

    /// @notice Authorize operator for msg.sender
    /// @dev ONLY way to grant operator rights - no approve() pattern
    function authorizeOperator(address operator) external {
        if (operator == msg.sender) revert SelfOperatorImmutable(operator);
        if (isDefaultOperator[operator]) {
            delete revokedDefaultOperators[msg.sender][operator];
        } else {
            operatorAuthorizations[msg.sender][operator] = true;
        }
        emit OperatorAuthorizationChanged(operator, msg.sender, true);
        emit AuthorizedOperator(operator, msg.sender);
    }

    /// @notice Revoke operator for msg.sender
    /// @dev ONLY way to revoke operator rights - no approve(0) pattern
    function revokeOperator(address operator) external {
        if (operator == msg.sender) revert SelfOperatorImmutable(operator);
        if (isDefaultOperator[operator]) {
            revokedDefaultOperators[msg.sender][operator] = true;
        } else {
            delete operatorAuthorizations[msg.sender][operator];
        }
        emit OperatorAuthorizationChanged(operator, msg.sender, false);
        emit RevokedOperator(operator, msg.sender);
    }

    /// @notice Get all default operators (immutable after construction)
    function defaultOperators() public view returns (address[] memory) {
        return defaultOperatorsArray;
    }

    // ==================== Admin: Default Operator Management ====================
    
    /// @notice Add default operator (admin only)
    function addDefaultOperator(address operator) external onlyRole(ADMIN_ROLE) {
        if (isDefaultOperator[operator]) return;
        isDefaultOperator[operator] = true;
        defaultOperatorsArray.push(operator);
        emit DefaultOperatorSet(operator, true);
    }

    /// @notice Remove default operator (admin only)
    function removeDefaultOperator(address operator) external onlyRole(ADMIN_ROLE) {
        if (!isDefaultOperator[operator]) return;
        if (operator == msg.sender) revert OnlyDefaultOperator(operator);
        
        isDefaultOperator[operator] = false;
        for (uint256 i = 0; i < defaultOperatorsArray.length; i++) {
            if (defaultOperatorsArray[i] == operator) {
                defaultOperatorsArray[i] = defaultOperatorsArray[defaultOperatorsArray.length - 1];
                defaultOperatorsArray.pop();
                break;
            }
        }
        emit DefaultOperatorSet(operator, false);
    }

    // ==================== ERC20 Allowances (Backwards Compatibility Only) ====================
    
    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _send(msg.sender, from, to, amount, "", "", false);
        return true;
    }

    function _approve(address holder, address spender, uint256 amount) internal {
        _allowances[holder][spender] = amount;
        emit Approval(holder, spender, amount);
    }

    function _spendAllowance(address holder, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(holder, spender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientBalance(spender, amount, currentAllowance);
            _approve(holder, spender, currentAllowance - amount);
        }
    }

    // ==================== Token Movement - Pure ERC-777 (NO EOA WORKAROUNDS) ====================
    
    /// @notice Send tokens - caller MUST be operator for 'from'
    /// @dev REPLACES transfer/transferFrom - no approve needed
    function send(address to, uint256 amount, bytes calldata data) 
        external 
        nonReentrant 
    {
        _checkGranularity(amount);
        _send(msg.sender, msg.sender, to, amount, data, "", true);
    }

    /// @notice Operator send tokens on behalf of holder
    /// @dev THE primary movement function - operator must be authorized
    function operatorSend(
        address from, 
        address to, 
        uint256 amount, 
        bytes calldata data, 
        bytes calldata operatorData
    ) external nonReentrant {
        _checkGranularity(amount);
        _requireOperator(from);
        _send(msg.sender, from, to, amount, data, operatorData, true);
    }

    /// @notice Burn tokens - caller MUST be operator for 'from'
    function burn(uint256 amount, bytes calldata data) external nonReentrant {
        _checkGranularity(amount);
        _burn(msg.sender, msg.sender, amount, data, "");
    }

    /// @notice Operator burn tokens on behalf of holder
    function operatorBurn(
        address from, 
        uint256 amount, 
        bytes calldata data, 
        bytes calldata operatorData
    ) external nonReentrant {
        _checkGranularity(amount);
        _requireOperator(from);
        _burn(msg.sender, from, amount, data, operatorData);
    }

    // ==================== Internal Movement Logic ====================
    
    function _send(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData,
        bool requireHook
    ) internal {
        // Authorization check - THIS IS THE PREMISE
        if (operator != from) {
            if (!isOperatorFor(operator, from)) {
                revert NotAuthorizedOperator(operator, from);
            }
        }

        // Ingress severance check
        if (ingressSevered && to != address(0)) {
            revert IngressSeveredError();
        }

        // Balance check
        uint256 fromBalance = _balances[from];
        if (fromBalance < amount) {
            revert InsufficientBalance(from, amount, fromBalance);
        }

        // Prevent sending to zero address (except burns)
        if (to == address(0)) revert ZeroAddressNotAllowed();

        // Pre-move hook: tokensToSend
        if (from != address(0)) {
            _callTokensToSend(operator, from, to, amount, data, operatorData);
        }

        // State updates
        _balances[from] = fromBalance - amount;
        if (to != address(0)) {
            _balances[to] += amount;
        } else {
            _totalSupply -= amount;
        }

        // Post-move hook: tokensReceived
        if (to != address(0)) {
            if (requireHook) {
                _callTokensReceived(operator, from, to, amount, data, operatorData);
            } else {
                // For ERC20 transfer compatibility - no hook required
                _callTokensReceivedIfRegistered(operator, from, to, amount, data, operatorData);
            }
        }

        // Emit Sent event (ERC-777 standard)
        emit Sent(operator, from, to, amount, data, operatorData);
        
        // Also emit ERC20 Transfer event for backwards compatibility
        emit Transfer(from, to, amount);
    }

    function _burn(
        address operator,
        address from,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        _requireOperator(from);
        
        uint256 fromBalance = _balances[from];
        if (fromBalance < amount) {
            revert InsufficientBalance(from, amount, fromBalance);
        }

        // Pre-move hook: tokensToSend
        _callTokensToSend(operator, from, address(0), amount, data, operatorData);

        // State updates
        _balances[from] = fromBalance - amount;
        _totalSupply -= amount;

        // Emit Burned event
        emit Burned(operator, from, amount, data, operatorData);
        
        // Also emit ERC20 Transfer event for backwards compatibility
        emit Transfer(from, address(0), amount);
    }

    function _requireOperator(address holder) internal view {
        if (!isOperatorFor(msg.sender, holder)) {
            revert NotAuthorizedOperator(msg.sender, holder);
        }
    }

    function _mint(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        _checkGranularity(amount);
        
        if (to == address(0)) revert ZeroAddressNotAllowed();
        
        _totalSupply += amount;
        _balances[to] += amount;

        // Post-move hook: tokensReceived
        if (from == address(0)) {
            _callTokensReceived(operator, from, to, amount, data, operatorData);
        }

        // Emit Minted event
        emit Minted(operator, to, amount, data, operatorData);
        
        // Also emit ERC20 Transfer event for backwards compatibility
        emit Transfer(address(0), to, amount);
    }

    // ==================== Hook System (The ERC-777 Innovation) ====================
    
    /// @notice Sender hook - called before tokens leave
    function tokensToSend(
        address _operator,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data,
        bytes calldata _operatorData
    ) external {
        // Only this contract can call this (via _callTokensToSend)
        if (msg.sender != address(this)) revert CallerNotOperator(msg.sender);
    }

    /// @notice Recipient hook - called after tokens arrive
    function tokensReceived(
        address _operator,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data,
        bytes calldata operatorData
    ) external {
        // Only this contract can call this (via _callTokensReceived)
        if (msg.sender != address(this)) revert CallerNotOperator(msg.sender);
    }

    function _isContract(address target) internal view returns (bool) {
        return target.code.length > 0;
    }

    function _callTokensToSend(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        if (from != address(0) && _isContract(from)) {
            IERC777Sender(from).tokensToSend(operator, from, to, amount, data, operatorData);
        }
    }

    function _callTokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        if (_isContract(to)) {
            IERC777Recipient(to).tokensReceived(operator, from, to, amount, data, operatorData);
        }
    }

    function _callTokensReceivedIfRegistered(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        if (_isContract(to)) {
            // Check if recipient implements ERC777TokensRecipient via ERC1820
            address implementer = IERC1820Registry(registry).getInterfaceImplementer(
                to, ERC777_RECIPIENT_INTERFACE_HASH
            );
            if (implementer != address(0)) {
                IERC777Recipient(to).tokensReceived(operator, from, to, amount, data, operatorData);
            }
        }
    }

    // ==================== Ingress Severance (Emergency) ====================
    
    /// @notice Sever K1 ingress path - emergency stop
    /// @param coherenceSecret Must match deployed secret
    function severIngress(string calldata coherenceSecret) external {
        if (!hasRole(SEVER_ROLE, msg.sender)) revert SeveranceNotAuthorized(msg.sender);
        if (keccak256(bytes(coherenceSecret)) != keccak256("EmpressGate")) revert InvalidCoherenceSecret();
        
        ingressSevered = true;
        severedBy = msg.sender;
        severedAt = block.timestamp;
        emit IngressSevered(msg.sender, block.timestamp);
        emit EmergencyAction(keccak256("SEVER_INGRESS"), msg.sender, "");
    }

    /// @notice Restore ingress (admin only, post-incident)
    function restoreIngress() external onlyRole(ADMIN_ROLE) {
        ingressSevered = false;
        emit IngressRestored(msg.sender, block.timestamp);
        emit EmergencyAction(keccak256("RESTORE_INGRESS"), msg.sender, "");
    }

    // ==================== Access Control Helpers ====================
    
    function grantOperatorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, account);
    }

    function revokeOperatorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, account);
    }

    function grantSeverRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(SEVER_ROLE, account);
    }

    function grantEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(EMERGENCY_ROLE, account);
    }

    // ==================== Minting (Controlled) ====================
    
    /// @notice Mint new tokens - only operators with OPERATOR_ROLE
    function mint(address to, uint256 amount, bytes calldata data, bytes calldata operatorData) 
        external 
        nonReentrant 
    {
        _checkGranularity(amount);
        // Only allow if caller has OPERATOR_ROLE (contract is operator for itself)
        if (!hasRole(OPERATOR_ROLE, msg.sender)) revert CallerNotOperator(msg.sender);
        _mint(msg.sender, address(0), to, amount, data, operatorData);
    }

    // ==================== View Functions ====================
    
    function getOperatorAuthorizations(address holder) external view returns (address[] memory) {
        // Returns explicitly authorized operators (non-default)
        uint256 count = 0;
        for (uint256 i = 0; i < defaultOperatorsArray.length; i++) {
            if (operatorAuthorizations[holder][defaultOperatorsArray[i]]) count++;
        }
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < defaultOperatorsArray.length; i++) {
            if (operatorAuthorizations[holder][defaultOperatorsArray[i]]) {
                result[idx] = defaultOperatorsArray[i];
                idx++;
            }
        }
        return result;
    }

    function getRegistry() external view returns (address) {
        return registry;
    }

    function getGranularity() external view returns (uint256) {
        return _granularity;
    }

    function isIngressSevered() external view returns (bool) {
        return ingressSevered;
    }

    function getSeverInfo() external view returns (address, uint256) {
        return (severedBy, severedAt);
    }
}