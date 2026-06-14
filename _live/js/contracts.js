/**
 * Contract ABIs, Bytecode & Deployment Constants
 * EIP-777G Genesis Gate
 */

export const GENESIS_LOCK_ABI = [
  // Constructor
  'constructor(address,address,address,address,uint64,uint64,bytes)',

  // Core functions
  'function queueIntent(address target, uint256 value, bytes calldata data, uint256 gasLimit, bytes32 nonce) external returns (bytes32)',
  'function authorizeIntent(bytes32 intentHash, address overrideDestination, bytes calldata k2Sig) external',
  'function executeIntent(bytes32 intentHash) external',
  'function forwardERC20(address token, bytes32 intentHash) external',
  'function forwardERC721(address nft, uint256 tokenId, bytes32 intentHash) external',
  'function severIngress() external',
  'function severEgress() external',

  // View functions
  'function verifyGenesis() external view returns (address k1Genesis, address k2Authority, address k3DropWallet, address cleanWallet, uint64 deployedAt, uint256 chainId, bytes32 genesisHash)',
  'function k1Genesis() external view returns (address)',
  'function k2Authority() external view returns (address)',
  'function k3DropWallet() external view returns (address)',
  'function cleanWallet() external view returns (address)',
  'function authWindow() external view returns (uint64)',
  'function minDelay() external view returns (uint64)',
  'function deployer() external view returns (address)',
  'function deployedAt() external view returns (uint64)',
  'function chainId() external view returns (uint256)',
  'function genesisHash() external view returns (bytes32)',
  'function isIngressSevered() external view returns (bool)',
  'function isEgressSevered() external view returns (bool)',
  'function isSevered() external view returns (bool, bool)',
  'function getIntent(bytes32 intentHash) external view returns (tuple(bytes32 intentHash, address target, uint256 value, bytes data, uint256 gasLimit, uint64 queuedAt, address k2OverrideDest, bool authorized, bool executed))',
  'function k1Attempts(address k1) external view returns (uint256)',
  'function isK1Blacklisted(address k1) external view returns (bool)',
  'function isWhitelisted(address addr) external view returns (bool)',

  // Events
  'event IntentQueued(bytes32 indexed intentHash, address indexed k1, address target, uint256 value, uint64 queuedAt)',
  'event IntentAuthorized(bytes32 indexed intentHash, address indexed k2, address k2OverrideDest)',
  'event IntentExecuted(bytes32 indexed intentHash, bool success)',
  'event AssetsForwarded(address indexed token, bytes32 indexed intentHash, address to, uint256 amount)',
  'event NFTForwarded(address indexed nft, uint256 indexed tokenId, bytes32 indexed intentHash, address to)',
  'event IngressSevered()',
  'event EgressSevered()',
  'event K1Blacklisted(address indexed k1)',
  'event GenesisLocked(address indexed k1Genesis, address indexed k2Authority, address indexed k3DropWallet, bytes32 genesisHash)'
];

// ERC-20 ABI for revoke scanning
export const ERC20_ABI = [
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// ERC-721 ABI
export const ERC721_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

// Common delegate patterns to check
export const DELEGATE_PATTERNS = [
  // setApprovalForAll
  { method: 'setApprovalForAll', types: ['address', 'bool'] },
  // approve (ERC20)
  { method: 'approve', types: ['address', 'uint256'] },
  // custom delegate patterns
  { method: 'delegate', types: ['address'] },
  { method: 'setDelegate', types: ['address'] },
  { method: 'addOperator', types: ['address'] },
  { method: 'removeOperator', types: ['address'] }
];

// Network configurations
export const NETWORKS = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: 'https://relay.flashbots.net', enabled: true },
    gasMultiplier: 1.15
  },
  'hyperliquid-evm': {
    name: 'Hyperliquid EVM',
    chainId: 999,
    rpc: 'https://rpc.hyperliquid.xyz/evm',
    explorer: 'https://explorer.hyperliquid.xyz',
    nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  'hyperliquid-core': {
    name: 'Hyperliquid Core (Non-EVM)',
    chainId: 'hyperliquid',
    rpc: 'https://api.hyperliquid.xyz',
    explorer: 'https://explorer.hyperliquid.xyz',
    nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 8 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.0,
    isNonEVM: true
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpc: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  plasma: {
    name: 'Plasma',
    chainId: 9745,
    rpc: 'https://rpc.plasma.to',
    explorer: 'https://explorer.plasma.to',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  monad: {
    name: 'Monad',
    chainId: 10143,
    rpc: 'https://rpc.monad.xyz',
    explorer: 'https://explorer.monad.xyz',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  ink: {
    name: 'Ink',
    chainId: 57073,
    rpc: 'https://rpc-gel.inkonchain.com',
    explorer: 'https://explorer.inkonchain.com',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  unichain: {
    name: 'Unichain',
    chainId: 130,
    rpc: 'https://mainnet.unichain.org',
    explorer: 'https://explorer.unichain.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  abstract: {
    name: 'Abstract',
    chainId: 2741,
    rpc: 'https://rpc.abstract.money',
    explorer: 'https://explorer.abstract.money',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  avax: {
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    explorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  'ape-chain': {
    name: 'ApeChain',
    chainId: 33139,
    rpc: 'https://rpc.apechain.com',
    explorer: 'https://explorer.apechain.com',
    nativeCurrency: { name: 'APE', symbol: 'APE', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  },
  bnb: {
    name: 'BNB Chain',
    chainId: 56,
    rpc: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    flashbots: { relay: '', enabled: false },
    gasMultiplier: 1.1
  }
};;

// Chain configs for Hyperliquid Core (different API)
// Hyperliquid Core requires different deployment approach
export const HYPERLIQUID_CORE_CONFIG = {
  // Uses different signing/transaction format
  // Requires API wallet / EIP-712 signatures
  api: 'https://api.hyperliquid.xyz',
  ws: 'wss://api.hyperliquid.xyz/ws',
  // Contract deployment on Core is via different mechanism
  // Uses spot deploy / perp deploy depending on type
};

// Default RPCs as fallback
export const DEFAULT_RPCS = {
  ethereum: 'https://eth.llamarpc.com',
  'hyperliquid-evm': 'https://rpc.hyperliquid.xyz/evm',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com',
  bnb: 'https://bsc-dataseed.binance.org'
};

// Gas estimation constants (in wei for base operations)
export const GAS_ESTIMATES = {
  deploy: 3500000,
  revokeApproval: 45000,
  revokeDelegate: 50000,
  flashbotsBundle: 200000,
  smokeTest: 150000,
  verifyGenesis: 50000
};

// Funding calculation base costs (in native wei)
export const FUNDING_BASE = {
  ethereum: { deploy: '0.008', revoke: '0.002', flashbots: '0.001', buffer: '0.005' },
  'hyperliquid-evm': { deploy: '0.0005', revoke: '0.0001', flashbots: '0', buffer: '0.0005' },
  'hyperliquid-core': { deploy: '0.001', revoke: '0.0002', flashbots: '0', buffer: '0.001' },
  arbitrum: { deploy: '0.0002', revoke: '0.00005', flashbots: '0', buffer: '0.0002' },
  optimism: { deploy: '0.0002', revoke: '0.00005', flashbots: '0', buffer: '0.0002' },
  base: { deploy: '0.0001', revoke: '0.00003', flashbots: '0', buffer: '0.0002' },
  polygon: { deploy: '0.0005', revoke: '0.0001', flashbots: '0', buffer: '0.0005' },
  bnb: { deploy: '0.0003', revoke: '0.00008', flashbots: '0', buffer: '0.0003' }
};

// Known malicious/spam contracts to flag
export const MALICIOUS_PATTERNS = [
  '0x0000000000000000000000000000000000000000', // zero address
  // Add known drainer contracts, phishing contracts etc.
];

// Contract verification - genesis hash structure
export function encodeGenesisProof(params) {
  // genesisHash = keccak256(k1, k2, k3, clean, deployer, timestamp, chainId)
  // Encoded for constructor verification
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'uint64', 'bytes32', 'uint64', 'uint64', 'bytes32'],
    [
      params.firstTxHash || '0x',
      params.firstTxTimestamp || 0,
      params.deviceFingerprintHash || '0x',
      params.passkeyCreatedAt || 0,
      params.walletCreatedAt || 0,
      params.deviceFingerprint || '0x'
    ]
  );
}

// Decode genesis proof from contract
export function decodeGenesisProof(data) {
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
    ['bytes32', 'uint64', 'bytes32', 'uint64', 'uint64', 'bytes32'],
    data
  );
  return {
    firstTxHash: decoded[0],
    firstTxTimestamp: decoded[1],
    deviceFingerprintHash: decoded[2],
    passkeyCreatedAt: decoded[3],
    walletCreatedAt: decoded[4],
    deviceFingerprint: decoded[5]
  };
}