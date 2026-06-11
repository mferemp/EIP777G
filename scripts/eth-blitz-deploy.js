#!/usr/bin/env node
/**
 * SecureGate v1 — ETH gate snap via multi-relay Flashbots mesh
 * Owner: Empress (@Hope_ology)
 *
 * Deploys EIP777G registry through 6-builder parallel mesh (no public mempool).
 * Requires severance complete on ethereum (see severance-gate.js).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { ethers } = require('ethers');
const artifact = require('../EIP777G.json');
const { assertDeployAllowed } = require('./lib/severance-gate');
const { maxBaseFeeInFutureBlock, submitBundleToMesh, PRIORITY_TIERS_GWEI } = require('./lib/builder-mesh');

const {
  RPC_URL,
  DEPLOYER_PRIVATE_KEY,
  K1_ADDRESS,
  K2_ADDRESS,
  CLEAN_WALLET,
  AUTH_WINDOW,
  MIN_DELAY,
  ETH_CAP_WEI = '25000000000000000',
} = process.env;

const HARD_CAP = BigInt(ETH_CAP_WEI);
const DEPLOY_GAS = 3_000_000n;

async function buildDeployTx(provider, deployer, tierGwei) {
  const block = await provider.getBlock('latest');
  const priorityFee = ethers.parseUnits(String(tierGwei), 'gwei');
  const worstBase = maxBaseFeeInFutureBlock(block.baseFeePerGas, 10);
  const maxFee = worstBase + priorityFee;
  const estCost = DEPLOY_GAS * maxFee;
  if (estCost > HARD_CAP) {
    throw new Error(`Deploy est. ${ethers.formatEther(estCost)} ETH exceeds cap`);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const txRequest = await factory.getDeployTransaction(
    K1_ADDRESS,
    K2_ADDRESS,
    CLEAN_WALLET,
    BigInt(AUTH_WINDOW),
    BigInt(MIN_DELAY),
  );

  const nonce = await provider.getTransactionCount(deployer.address, 'pending');
  const tx = {
    ...txRequest,
    from: deployer.address,
    chainId: 1,
    type: 2,
    nonce,
    gasLimit: DEPLOY_GAS,
    maxPriorityFeePerGas: priorityFee,
    maxFeePerGas: maxFee,
  };

  return { signed: await deployer.signTransaction(tx), estCost, maxFee };
}

async function main() {
  assertDeployAllowed('ethereum');

  if (!RPC_URL || !DEPLOYER_PRIVATE_KEY) throw new Error('RPC_URL and DEPLOYER_PRIVATE_KEY required');
  if (!K1_ADDRESS || !K2_ADDRESS || !CLEAN_WALLET) throw new Error('K1/K2/K3 addresses required');
  if (!AUTH_WINDOW || !MIN_DELAY) throw new Error('AUTH_WINDOW and MIN_DELAY required');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  console.log('ETH gate snap — multi-relay Flashbots mesh');
  console.log('Courier:', deployer.address);
  console.log('K1/K2/K3:', K1_ADDRESS, K2_ADDRESS, CLEAN_WALLET);

  for (const tierGwei of PRIORITY_TIERS_GWEI) {
    const { signed, estCost } = await buildDeployTx(provider, deployer, tierGwei);
    console.log(`Deploy tx encoded ~${ethers.formatEther(estCost)} ETH @ ${tierGwei} gwei priority`);

    const result = await submitBundleToMesh({
      provider,
      authSigner: deployer,
      signedTxs: [signed],
      label: 'gate deploy',
      windowBlocks: 10,
      hardCapWei: HARD_CAP,
    });

    if (result.ok) {
      const parsed = ethers.Transaction.from(signed);
      console.log(`\n✓ Gate deploy bundle landed block ${result.block} via ${result.relay}`);
      console.log('Deploy tx hash:', parsed.hash);
      console.log('Verify contract address on Etherscan after inclusion.');
      process.exit(0);
    }
  }

  console.log('Gate deploy bundle not included — retry mesh or raise priority tier');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });