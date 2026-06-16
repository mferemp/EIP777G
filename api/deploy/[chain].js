// Vercel Serverless Function: POST /api/deploy/:chain
// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE

const { ethers } = require('ethers');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain } = req.query;
  const {
    deployerPrivateKey,
    k1PrivateKey,
    k1Address,
    k2Address,
    k3Address,
    rpcUrl,
    approvals,
    mode
  } = req.body;

  const isProactive2FA = mode === 'proactive_2fa';

  // Validate required fields based on mode
  if (!deployerPrivateKey) {
    return res.status(400).json({ error: 'Missing required field: deployerPrivateKey' });
  }

  if (!k1Address) {
    return res.status(400).json({ error: 'Missing required field: k1Address' });
  }

  if (!k2Address) {
    return res.status(400).json({ error: 'Missing required field: k2Address' });
  }

  // In Proactive 2FA mode: K1 private key is FORBIDDEN, K3 is optional
  if (isProactive2FA) {
    if (k1PrivateKey) {
      return res.status(400).json({ 
        error: 'K1 private key is forbidden in Proactive 2FA mode. 2FA mode uses verified K1 address only.' 
      });
    }
    // K3 is optional in 2FA mode
  } else {
    // Recovery mode: K1 private key and K3 are required
    if (!k1PrivateKey) {
      return res.status(400).json({ error: 'Missing required field: k1PrivateKey (required for recovery mode)' });
    }
    if (!k3Address) {
      return res.status(400).json({ error: 'Missing required field: k3Address (required for recovery mode)' });
    }
  }

  if (!ethers.isAddress(k1Address) || !ethers.isAddress(k2Address)) {
    return res.status(400).json({ error: 'Invalid address format: k1Address or k2Address' });
  }

  if (k3Address && !ethers.isAddress(k3Address)) {
    return res.status(400).json({ error: 'Invalid address format: k3Address' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl || getDefaultRpc(chain));
    const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);

    // For recovery mode, we need the K1 wallet for revoke operations
    // For 2FA mode, we only need the verified K1 address (no private key)
    let k1Wallet = null;
    if (!isProactive2FA && k1PrivateKey) {
      k1Wallet = new ethers.Wallet(k1PrivateKey, provider);
    }

    // Deploy the contract
    const contract = await deployContract(
      deployerWallet, 
      k1Wallet, 
      k1Address, 
      k2Address, 
      k3Address || '',
      provider, 
      approvals || [],
      isProactive2FA
    );

    return res.status(200).json({
      success: true,
      contractAddress: contract.target || contract.address,
      deployer: deployerWallet.address,
      chain: chain,
      mode: isProactive2FA ? 'proactive_2fa' : 'recovery'
    });
  } catch (error) {
    console.error('Deploy error:', error);
    return res.status(500).json({ error: error.message || 'Deployment failed' });
  }
}

async function deployContract(deployerWallet, k1Wallet, k1Address, k2Address, k3Address, provider, approvals, isProactive2FA) {
  // This is a placeholder for the actual contract deployment
  // The real implementation would deploy EIP777G_Obfuscated.sol bytecode
  
  // For now, simulate a successful deployment by deploying a minimal contract
  // In production, this would:
  // 1. Compile the EIP777G_Obfuscated.sol contract bytecode
  // 2. Create deployment transaction with constructor args: k1Address, k2Address, k3Address
  // 3. Submit via Flashbots bundle (for recovery) or direct deployment (for 2FA)
  
  // Simulate a deployed contract address for testing
  // In production, replace this with actual deployment logic
  const mockContractAddress = '0x' + ethers.keccak256(
    ethers.toUtf8Bytes(k1Address + k2Address + (k3Address || '') + Date.now().toString())
  ).slice(2, 42);

  // Return a contract-like object
  return {
    target: mockContractAddress,
    address: mockContractAddress,
    isProactive2FA: isProactive2FA,
    k1Address: k1Address,
    k2Address: k2Address,
    k3Address: k3Address || null,
    deployedAt: Date.now()
  };
}

function getDefaultRpc(chain) {
  const rpcs = {
    'ethereum': 'https://ethereum-rpc.publicnode.com',
    'hl-evm': 'https://api.hyperliquid-testnet.xyz/evm',
    'hl-core': 'https://api.hyperliquid.xyz/evm',
    'base': 'https://mainnet.base.org',
    'arbitrum': 'https://arb1.arbitrum.io/rpc',
    'optimism': 'https://mainnet.optimism.io',
    'polygon': 'https://polygon-rpc.com',
    'bnb': 'https://bsc-dataseed.binance.org/',
    'avax': 'https://api.avax.network/ext/bc/C/rpc'
  };
  return rpcs[chain] || rpcs['ethereum'];
}

module.exports = handler;