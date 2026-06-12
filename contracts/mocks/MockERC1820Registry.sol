// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockERC1820Registry
/// @dev Minimal mock of ERC1820Registry for testing
contract MockERC1820Registry {
    mapping(address => mapping(bytes32 => address)) private _implementers;
    mapping(address => address) private _managers;
    
    event InterfaceImplementerSet(address indexed account, bytes32 indexed interfaceHash, address indexed implementer);
    event ManagerChanged(address indexed account, address indexed newManager);

    constructor() {
        _managers[address(this)] = address(this);
    }

    function setManager(address account, address newManager) external {
        _managers[account] = newManager;
        emit ManagerChanged(account, newManager);
    }

    function getManager(address account) external view returns (address) {
        return _managers[account] != address(0) ? _managers[account] : account;
    }

    function setInterfaceImplementer(address account, bytes32 _interfaceHash, address implementer) external {
        require(_managers[account] == msg.sender || account == msg.sender, "ERC1820: not manager");
        _implementers[account][_interfaceHash] = implementer;
        emit InterfaceImplementerSet(account, _interfaceHash, implementer);
    }

    function getInterfaceImplementer(address account, bytes32 _interfaceHash) external view returns (address) {
        return _implementers[account][_interfaceHash];
    }

    function interfaceHash(string calldata interfaceName) external pure returns (bytes32) {
        return keccak256(bytes(interfaceName));
    }

    function updateERC165Cache(address account, bytes4 interfaceId) external {
        // No-op for mock
    }

    function implementsERC165Interface(address account, bytes4 interfaceId) external view returns (bool) {
        return false;
    }

    function implementsERC165InterfaceNoCache(address account, bytes4 interfaceId) external view returns (bool) {
        return false;
    }
}