// gate.js — real SecureGate v1 on-chain state reader

require('dotenv').config();
const { ethers } = require('ethers');
const artifact = require('./EIP777G.json');

// Deployed SecureGate v1 contract
const GATE_ADDRESS = '0x56310d7e48d9249df358ab9daa6a2dad0e03e242';

function getProvider() {
  const rpc = process.env.RPC_URL;
  if (!rpc) throw new Error('RPC_URL is not set in environment');
  return new ethers.JsonRpcProvider(rpc);
}

async function getEthBalance(provider, address) {
  if (!address) return null;
  try {
    const bal = await provider.getBalance(address);
    return ethers.formatEther(bal);
  } catch {
    return null;
  }
}

async function readGateContract(provider) {
  const code = await provider.getCode(GATE_ADDRESS);
  if (!code || code === '0x') {
    return { deployed: false };
  }

  const gate = new ethers.Contract(GATE_ADDRESS, artifact.abi, provider);

  // Map real contract functions → K1/K2/K3 model
  const [thresholdSigner, k2Authority, defaultDropWallet, authWindow, minDelay] = await Promise.all([
    gate.thresholdSigner(),
    gate.k2Authority(),
    gate.defaultDropWallet(),
    gate.AUTH_WINDOW(),
    gate.MIN_DELAY(),
  ]);

  const block = await provider.getBlock('latest');

  return {
    deployed: true,
    address: GATE_ADDRESS,
    k1: thresholdSigner,
    k2: k2Authority,
    k3: defaultDropWallet,
    authWindow: Number(authWindow),
    minDelay: Number(minDelay),
    chainId: Number((await provider.getNetwork()).chainId),
    block: block?.number ?? null,
  };
}

module.exports = {
  async readState() {
    const provider = getProvider();

    const envK1 = process.env.K1_ADDRESS || null;
    const envK2 = process.env.K2_ADDRESS || null;
    const envK3 = process.env.CLEAN_WALLET || null;

    const [k1Bal, k3Bal, gateStatus] = await Promise.all([
      getEthBalance(provider, envK1),
      getEthBalance(provider, envK3),
      readGateContract(provider),
    ]);

    const overallStatusLabel = gateStatus.deployed ? 'gate_deployed' : 'pre_deploy';

    return {
      model: {
        envK1,
        envK2,
        envK3,
        onchainK1: gateStatus.k1 || null,
        onchainK2: gateStatus.k2 || null,
        onchainK3: gateStatus.k3 || null,
        invariant: 'K3 is the only exit; K2 cannot change K3; K1 cannot execute alone.',
      },
      overallStatusLabel,
      chains: [
        {
          name: 'ethereum',
          rpcLabel: 'mainnet',
          gate: gateStatus,
          k1EthBalance: k1Bal,
          k3EthBalance: k3Bal,
        },
      ],
    };
  },
};
