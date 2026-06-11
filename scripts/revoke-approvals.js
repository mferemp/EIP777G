#!/usr/bin/env node
/**
 * SecureGate v1 — Ethereum multi-relay Flashbots severance bundle
 * Owner: Empress
 *
 * Atomic private bundle via 6-builder mesh:
 *   1) Courier → K1 fund (optional, beats sweeper to fund α lane)
 *   2) K1-signed standard contract revokes (delegates/approvals)
 *
 * All txs land together or none — no mempool exposure.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { ethers } = require('ethers');
const { parseApprovals, encodeRevokeCall } = require('./lib/revoke-encode');
const { maxBaseFeeInFutureBlock, submitBundleToMesh, PRIORITY_TIERS_GWEI } = require('./lib/builder-mesh');

const {
  RPC_URL,
  K1_PRIVATE_KEY,
  K1_ADDRESS,
  DEPLOYER_PRIVATE_KEY,
  ETH_CAP_WEI = '25000000000000000',
  FUND_K1_WEI,
} = process.env;

if (!RPC_URL || !K1_PRIVATE_KEY || !K1_ADDRESS) {
  console.error('Missing RPC_URL, K1_PRIVATE_KEY, or K1_ADDRESS');
  process.exit(1);
}

const HARD_CAP = BigInt(ETH_CAP_WEI);

async function buildSignedBundle(provider, tierGwei) {
  const k1 = new ethers.Wallet(K1_PRIVATE_KEY, provider);
  if (k1.address.toLowerCase() !== K1_ADDRESS.toLowerCase()) {
    throw new Error(`K1_PRIVATE_KEY does not match K1_ADDRESS (${k1.address} != ${K1_ADDRESS})`);
  }

  const approvals = parseApprovals(process.env.REVOKE_APPROVALS_JSON);
  if (!approvals.length) {
    return { empty: true };
  }

  const deployer = DEPLOYER_PRIVATE_KEY
    ? new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)
    : null;

  const block = await provider.getBlock('latest');
  const priorityFee = ethers.parseUnits(String(tierGwei), 'gwei');
  const worstBase = maxBaseFeeInFutureBlock(block.baseFeePerGas, 10);
  const maxFee = worstBase + priorityFee;

  const signedTxs = [];
  let totalCost = 0n;

  if (deployer && FUND_K1_WEI) {
    const fundWei = BigInt(FUND_K1_WEI);
    const gas = 21000n;
    totalCost += gas * maxFee + fundWei;
    const fundTx = {
      to: k1.address,
      value: fundWei,
      from: deployer.address,
      chainId: 1,
      type: 2,
      nonce: await provider.getTransactionCount(deployer.address, 'pending'),
      gasLimit: gas,
      maxPriorityFeePerGas: priorityFee,
      maxFeePerGas: maxFee,
    };
    signedTxs.push(await deployer.signTransaction(fundTx));
    console.log(`Fund K1: ${ethers.formatEther(fundWei)} ETH (courier → α, private bundle)`);
  }

  let k1Nonce = await provider.getTransactionCount(k1.address, 'pending');
  for (const approval of approvals) {
    const { to, data, type, spender } = encodeRevokeCall(approval);
    const gas = 80000n;
    totalCost += gas * maxFee;
    const tx = {
      to,
      data,
      from: k1.address,
      chainId: 1,
      type: 2,
      nonce: k1Nonce++,
      gasLimit: gas,
      maxPriorityFeePerGas: priorityFee,
      maxFeePerGas: maxFee,
    };
    signedTxs.push(await k1.signTransaction(tx));
    console.log(`Encoded severance: ${type} ${to} delegate=${spender}`);
  }

  if (totalCost > HARD_CAP) {
    throw new Error(`Bundle est. ${ethers.formatEther(totalCost)} ETH exceeds hard cap ${ethers.formatEther(HARD_CAP)}`);
  }

  return { signedTxs, k1: k1.address, count: approvals.length, totalCost };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const authSigner = DEPLOYER_PRIVATE_KEY
    ? new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)
    : new ethers.Wallet(K1_PRIVATE_KEY, provider);

  console.log('ETH severance — multi-relay Flashbots mesh (6 builders)');
  console.log('K1 (α):', K1_ADDRESS);
  if (DEPLOYER_PRIVATE_KEY) {
    console.log('Courier:', authSigner.address);
  }

  for (const tierGwei of PRIORITY_TIERS_GWEI) {
    const built = await buildSignedBundle(provider, tierGwei);
    if (built.empty) {
      console.log('REVOKE_APPROVALS_JSON empty — add Severance tab rows first.');
      process.exit(0);
    }

    const result = await submitBundleToMesh({
      provider,
      authSigner,
      signedTxs: built.signedTxs,
      label: `severance (${built.count} revokes)`,
      windowBlocks: 10,
      hardCapWei: HARD_CAP,
    });

    if (result.ok) {
      console.log(`\n✓ ETH severance bundle landed — ${built.count} revoke(s) @ block ${result.block}`);
      process.exit(0);
    }
  }

  console.log('Severance bundle not included — escalate FUND_K1_WEI / PRIORITY_GWEI or retry mesh');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });