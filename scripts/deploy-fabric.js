#!/usr/bin/env node
/**
 * SecureGate v1 — generic EIP777G fabric deploy (EIP-1559)
 * Owner: Empress (@Hope_ology)
 *
 * Set DEPLOY_FABRIC to one of: hl-evm, base, arbitrum, optimism, polygon, bnb
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const { ethers } = require('ethers');
const artifact = require('../EIP777G.json');
const { assertDeployAllowed } = require('./lib/severance-gate');

const FABRICS = {
  'hl-evm': {
    label: 'Hyperliquid EVM',
    chainId: 999,
    rpcEnv: ['HL_EVM_RPC_URL', 'HYPERLIQUID_RPC_URL'],
    fallback: 'https://rpc.hyperliquid.xyz/evm',
    gateEnv: 'SECUREGATE_HL_ADDRESS',
  },
  base: {
    label: 'Base',
    chainId: 8453,
    rpcEnv: ['BASE_RPC_URL'],
    fallback: 'https://mainnet.base.org',
    gateEnv: 'SECUREGATE_BASE_ADDRESS',
  },
  arbitrum: {
    label: 'Arbitrum One',
    chainId: 42161,
    rpcEnv: ['ARBITRUM_RPC_URL'],
    fallback: 'https://arb1.arbitrum.io/rpc',
    gateEnv: 'SECUREGATE_ARBITRUM_ADDRESS',
  },
  optimism: {
    label: 'Optimism',
    chainId: 10,
    rpcEnv: ['OPTIMISM_RPC_URL'],
    fallback: 'https://mainnet.optimism.io',
    gateEnv: 'SECUREGATE_OPTIMISM_ADDRESS',
  },
  polygon: {
    label: 'Polygon PoS',
    chainId: 137,
    rpcEnv: ['POLYGON_RPC_URL'],
    fallback: 'https://polygon-rpc.com',
    gateEnv: 'SECUREGATE_POLYGON_ADDRESS',
  },
  bnb: {
    label: 'BNB Chain',
    chainId: 56,
    rpcEnv: ['BNB_RPC_URL', 'BSC_RPC_URL'],
    fallback: 'https://bsc-dataseed.binance.org',
    gateEnv: 'SECUREGATE_BNB_ADDRESS',
  },
};

function resolveRpc(cfg) {
  for (const key of cfg.rpcEnv) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return cfg.fallback;
}

function requireEnv(name) {
  const val = process.env[name]?.trim();
  if (!val) throw new Error(`${name} is not set in environment`);
  return val;
}

async function main() {
  const fabricId = (process.env.DEPLOY_FABRIC || '').trim();
  const cfg = FABRICS[fabricId];
  if (!cfg) {
    throw new Error(`DEPLOY_FABRIC must be one of: ${Object.keys(FABRICS).join(', ')}`);
  }
  assertDeployAllowed(fabricId);

  const rpc = resolveRpc(cfg);
  const provider = new ethers.JsonRpcProvider(rpc);
  const deployerPk = requireEnv('DEPLOYER_PRIVATE_KEY');
  const deployer = new ethers.Wallet(deployerPk, provider);

  const k1 = requireEnv('K1_ADDRESS');
  const k2 = requireEnv('K2_ADDRESS');
  const k3 = requireEnv('CLEAN_WALLET');
  const authWindow = BigInt(requireEnv('AUTH_WINDOW'));
  const minDelay = BigInt(requireEnv('MIN_DELAY'));

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== cfg.chainId) {
    throw new Error(`${cfg.label} chainId mismatch: got ${chainId}, expected ${cfg.chainId}`);
  }

  const bal = await provider.getBalance(deployer.address);
  console.log(`Fabric: ${fabricId} (${cfg.label})`);
  console.log('RPC:', rpc);
  console.log('Chain:', chainId);
  console.log('DEPLOYER:', deployer.address);
  console.log('Balance:', ethers.formatEther(bal), chainId === 137 ? 'MATIC' : chainId === 56 ? 'BNB' : chainId === 999 ? 'HYPE' : 'ETH');
  console.log('K1:', k1);
  console.log('K2:', k2);
  console.log('K3:', k3);
  console.log('authWindow:', authWindow.toString());
  console.log('minDelay:', minDelay.toString());

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  console.log(`Sending SecureGate deployment tx on ${cfg.label}...`);
  const contract = await factory.deploy(k1, k2, k3, authWindow, minDelay);

  const deployTx = contract.deploymentTransaction();
  console.log('Deploy tx hash:', deployTx.hash);

  const deployed = await contract.waitForDeployment();
  const addr = await deployed.getAddress();
  console.log(`✓ ${cfg.label} SecureGate deployed at ${addr}`);
  console.log(`\nSet in .env:  ${cfg.gateEnv}=${addr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});