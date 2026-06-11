#!/usr/bin/env node
/**
 * SecureGate v1 — per-fabric approval / delegate severance (EVM)
 * Owner: Empress (@Hope_ology)
 *
 * K1 (compromised wallet) signs revokes — delegates/approvals live on α lane.
 * Courier (DEPLOYER) is not used as msg.sender for revoke calls.
 *
 * Set REVOKE_FABRIC: hl-evm | base | arbitrum | optimism | polygon | bnb
 * Approvals: REVOKE_APPROVALS_JSON env or dashboard POST body (injected by route)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { ethers } = require('ethers');
const { parseApprovals, encodeRevokeCall } = require('./lib/revoke-encode');

const FABRICS = {
  'hl-evm': {
    label: 'Hyperliquid EVM',
    chainId: 999,
    rpcEnv: ['HL_EVM_RPC_URL', 'HYPERLIQUID_RPC_URL'],
    fallback: 'https://rpc.hyperliquid.xyz/evm',
    symbol: 'HYPE',
  },
  base: {
    label: 'Base',
    chainId: 8453,
    rpcEnv: ['BASE_RPC_URL'],
    fallback: 'https://mainnet.base.org',
    symbol: 'ETH',
  },
  arbitrum: {
    label: 'Arbitrum One',
    chainId: 42161,
    rpcEnv: ['ARBITRUM_RPC_URL'],
    fallback: 'https://arb1.arbitrum.io/rpc',
    symbol: 'ETH',
  },
  optimism: {
    label: 'Optimism',
    chainId: 10,
    rpcEnv: ['OPTIMISM_RPC_URL'],
    fallback: 'https://mainnet.optimism.io',
    symbol: 'ETH',
  },
  polygon: {
    label: 'Polygon PoS',
    chainId: 137,
    rpcEnv: ['POLYGON_RPC_URL'],
    fallback: 'https://polygon-rpc.com',
    symbol: 'MATIC',
  },
  bnb: {
    label: 'BNB Chain',
    chainId: 56,
    rpcEnv: ['BNB_RPC_URL', 'BSC_RPC_URL'],
    fallback: 'https://bsc-dataseed.binance.org',
    symbol: 'BNB',
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
  if (!val) throw new Error(`${name} is not set`);
  return val;
}

async function main() {
  const fabricId = (process.env.REVOKE_FABRIC || '').trim();
  const cfg = FABRICS[fabricId];
  if (!cfg) {
    throw new Error(`REVOKE_FABRIC must be one of: ${Object.keys(FABRICS).join(', ')}`);
  }

  const approvals = parseApprovals(process.env.REVOKE_APPROVALS_JSON);
  if (!approvals.length) {
    console.log('REVOKE_APPROVALS_JSON empty — add delegate/approval rows in dashboard Severance tab or .env');
    process.exit(0);
  }

  const rpc = process.env.RPC_URL?.trim() || resolveRpc(cfg);
  const provider = new ethers.JsonRpcProvider(rpc);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== cfg.chainId) {
    throw new Error(`${cfg.label} chainId mismatch: got ${chainId}, expected ${cfg.chainId}`);
  }

  const k1Pk = requireEnv('K1_PRIVATE_KEY');
  const k1Addr = requireEnv('K1_ADDRESS');
  const k1 = new ethers.Wallet(k1Pk, provider);
  if (k1.address.toLowerCase() !== k1Addr.toLowerCase()) {
    throw new Error(`K1_PRIVATE_KEY does not match K1_ADDRESS (${k1.address} != ${k1Addr})`);
  }

  const capWei = BigInt(process.env.REVOKE_CAP_WEI || process.env.ETH_CAP_WEI || '25000000000000000');
  const priorityGwei = process.env.PRIORITY_GWEI || '2';
  const bal = await provider.getBalance(k1.address);

  console.log(`Fabric: ${fabricId} (${cfg.label})`);
  console.log('RPC:', rpc);
  console.log('K1 (α):', k1.address);
  console.log('K1 balance:', ethers.formatEther(bal), cfg.symbol);
  console.log(`Revoking ${approvals.length} delegate/approval link(s)…`);

  let spent = 0n;
  const results = [];

  for (const approval of approvals) {
    const { to, data, type, spender } = encodeRevokeCall(approval);
    const fee = await provider.getFeeData();
    const gasLimit = 80000n;
    const maxFee = fee.maxFeePerGas || fee.gasPrice || ethers.parseUnits('50', 'gwei');
    const maxPriority = fee.maxPriorityFeePerGas || ethers.parseUnits(priorityGwei, 'gwei');
    const estCost = gasLimit * maxFee;

    if (spent + estCost > capWei) {
      throw new Error(`Revoke cap exceeded on ${fabricId} — spent ${ethers.formatEther(spent)} + next ${ethers.formatEther(estCost)} > cap`);
    }
    if (bal < spent + estCost) {
      throw new Error(`K1 underfunded on ${fabricId} — need ~${ethers.formatEther(spent + estCost)} ${cfg.symbol} for gas`);
    }

    console.log(`→ ${type} ${to} sever ${spender}`);
    const tx = await k1.sendTransaction({
      to,
      data,
      type: 2,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPriority,
      gasLimit,
    });
    const receipt = await tx.wait();
    spent += receipt.gasUsed * (receipt.effectiveGasPrice || maxFee);
    results.push({ type, token: to, spender, hash: receipt.hash, block: receipt.blockNumber });
    console.log(`  ✓ included block ${receipt.blockNumber} tx ${receipt.hash}`);
  }

  console.log(`\n✓ ${cfg.label} severance complete — ${results.length} tx(s) on public sequencer`);
  console.log('Severance gate: fabric marked ready for gate deploy after relay ACK');
  console.log(JSON.stringify({ fabric: fabricId, k1: k1.address, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});