# EIP777G - Secure ERC-777 Token with Operator-Gated Architecture

> **The entire premise: Zero EOA workarounds. Pure operator + hook model.**

## 🎯 Core Philosophy

EIP777G implements **ERC-777** as it was intended: **tokens move ONLY via operators and hooks**. There is no `approve()`, no `transferFrom()`, no ERC-20 fallback patterns. The operator model IS the authorization model.

## 🔐 Security Architecture

### 1. Operator-Gated Movement (No EOA Workarounds)
```solidity
// THE ONLY WAYS TO MOVE TOKENS:
function send(address to, uint256 amount, bytes calldata data) external;           // Holder moves own
function operatorSend(address from, address to, uint256 amount, bytes calldata data, bytes calldata operatorData) external; // Operator moves for holder
function burn(uint256 amount, bytes calldata data) external;                         // Holder burns own
function operatorBurn(address from, uint256 amount, bytes calldata data, bytes calldata operatorData) external; // Operator burns for holder

// THESE DO NOT EXIST:
function approve(address spender, uint256 amount) external;  // ❌ REMOVED
function allowance(address owner, address spender) external view returns (uint256); // ❌ REMOVED
function transferFrom(address from, address to, uint256 amount) external; // ❌ REMOVED
```

### 2. Mandatory Granularity Enforcement
- Set at deployment, immutable
- ALL amounts (send, burn, mint) must be multiples
- Violations revert with `GranularityViolationError` + event emission

### 3. Ingress Severance (Emergency Circuit Breaker)
```solidity
function severIngress(string calldata coherenceSecret) external onlyRole(SEVER_ROLE);
function restoreIngress() external onlyRole(ADMIN_ROLE);
```
- One-way emergency stop (requires coherence secret "EmpressGate")
- Blocks ALL ingress sends (except burns to address(0))
- Auditable with `IngressSevered` / `IngressRestored` events

### 4. Reentrancy Protection
- `nonReentrant` modifier on ALL state-changing functions
- Custom error `ReentrancyDetected` for gas efficiency

### 5. Access Control (OpenZeppelin AccessControl)
- `DEFAULT_ADMIN_ROLE`: Full contract admin
- `OPERATOR_ROLE`: Can mint (contract is operator for itself)
- `SEVER_ROLE`: Can sever ingress
- `ADMIN_ROLE`: Manage default operators
- `EMERGENCY_ROLE`: Reserved for future emergency actions

### 6. ERC-1820 Registration
- Automatic registration of `ERC777TokensSender` and `ERC777TokensRecipient` interfaces
- Prevents tokens from being stuck in unaware contracts

## 📋 Specification Compliance

| Feature | Status | Notes |
|---------|--------|-------|
| ERC-777 Interface | ✅ | Full implementation |
| ERC-1820 Registration | ✅ | Auto-register on deploy |
| Backwards Compatibility | ✅ | `transfer()` works via `send()` |
| Hooks: tokensToSend | ✅ | Called before state change |
| Hooks: tokensReceived | ✅ | Called after state change |
| Operators | ✅ | Default + explicit authorization |
| Granularity | ✅ | Immutable, enforced everywhere |
| Decimals (18) | ✅ | Fixed per ERC-777 spec |
| Events | ✅ | Sent, Minted, Burned, Auth/Revoke |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Run tests
npm test

# Deploy to local network
npm run node          # Terminal 1: Start local node
npm run deploy:local  # Terminal 2: Deploy

# Deploy to Sepolia
npm run deploy:sepolia

# Verify on Etherscan
npm run verify --network sepolia <CONTRACT_ADDRESS> "EIP777G Token" "EIP777G" "[]" 1 "0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24" <ADMIN_ADDRESS>
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run with gas reporting
REPORT_GAS=true npm test
```

### Key Test Categories
1. **Operator Model** - Validates no EOA workarounds exist
2. **Token Movement** - Pure ERC-777 send/operatorSend/burn/operatorBurn
3. **Hooks** - tokensToSend / tokensReceived with data/operatorData
4. **Severance** - Emergency ingress stop/restore
5. **Granularity** - Enforcement on all operations
6. **Reentrancy** - Attack vectors blocked
7. **Access Control** - Role-based permissions

## 📁 Project Structure

```
securegate-v1/
├── contracts/
│   └── EIP777G.sol           # Main contract
├── scripts/
│   └── deploy.ts             # Deployment script
├── test/
│   ├── EIP777G.test.ts       # Comprehensive test suite
│   └── mocks/                # Test mock contracts
│       ├── MockERC777Sender.sol
│       ├── MockERC777Recipient.sol
│       ├── MockNoHook.sol
│       └── ReentrantAttacker.sol
├── hardhat.config.ts         # Hardhat configuration
├── package.json
└── tsconfig.json
```

## ⚠️ Critical Security Notes

### The "No EOA Workaround" Guarantee
This contract **intentionally omits** ERC-20 `approve()` / `allowance` / `transferFrom()`. 
- If you need ERC-20 compatibility, wrap with an adapter contract
- The operator model is **strictly enforced** at the protocol level
- Any attempt to use `approve()` will fail at compile time (function doesn't exist)

### Deployment Checklist
- [ ] Set granularity appropriately (1 = fully partitionable)
- [ ] Configure default operators (empty = no pre-authorized operators)
- [ ] Register ERC-1820 interfaces post-deployment
- [ ] Grant `OPERATOR_ROLE` to trusted contracts for minting
- [ ] Secure `SEVER_ROLE` with multi-sig or timelock
- [ ] Verify on Etherscan with correct constructor args

### Hook Safety
- Recipients **MUST** implement `IERC777Recipient` to receive tokens
- This PREVENTS stuck tokens (the #1 ERC-20 failure mode)
- Sender hooks (`tokensToSend`) enable pre-transfer logic
- Both hooks receive `data` (from holder) and `operatorData` (from operator)

## 📜 License

MIT License - See LICENSE file for details.

## 👑 Custody

**Empress Hopeology** - Proprietary rules apply. Full sole custody.

---

**"The operator model IS the authorization model. No approve. No transferFrom. No workarounds."**