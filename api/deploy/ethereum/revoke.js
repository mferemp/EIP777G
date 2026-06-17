// Vercel Serverless Function: POST /api/deploy/:chain/revoke
// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE

const { ethers } = require('ethers');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain } = req.query;
  const {
    k1PrivateKey,
    k1Address,
    deployerPrivateKey, // accepted for compatibility but not used in revoke flow
    rpcUrl,
    approvals
  } = req.body;

  // Validate required fields
  if (!k1PrivateKey || !k1Address || !approvals || !approvals.length) {
    return res.status(400).json({ error: 'Missing required fields: k1PrivateKey, k1Address, approvals' });
  }

  if (!ethers.isAddress(k1Address)) {
    return res.status(400).json({ error: 'Invalid K1 address format' });
  }

  try {
    if (!rpcUrl) {
      return res.status(400).json({ error: 'RPC URL is required. Provide your own RPC URL.' });
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const k1Wallet = new ethers.Wallet(k1PrivateKey, provider);

    const results = await revokeApprovals(k1Wallet, provider, approvals);

    return res.status(200).json({
      success: true,
      revoked: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    });
  } catch (error) {
    console.error('Revoke error:', error);
    return res.status(500).json({ error: error.message || 'Revoke failed' });
  }
}

async function revokeApprovals(k1Wallet, provider, approvals) {
  const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ];

  // For ERC721, we need setApprovalForAll
  const ERC721_ABI = [
    'function setApprovalForAll(address operator, bool approved) returns ()',
    'function isApprovedForAll(address owner, address operator) view returns (bool)'
  ];

  // For EIP-7702 delegate, we need to revoke delegation
  const DELEGATE_ABI = [
    'function revokeDelegation() returns ()'
  ];

  const results = [];

  for (const approval of approvals) {
    try {
      const { token, spender, type } = approval;
      
      if (type === 'ERC20') {
        const contract = new ethers.Contract(token, ERC20_ABI, k1Wallet);
        const currentAllowance = await contract.allowance(k1Wallet.address, spender);
        if (currentAllowance > 0) {
          const tx = await contract.approve(spender, 0);
          await tx.wait();
          results.push({ token, spender, type, success: true, txHash: tx.hash });
        } else {
          results.push({ token, spender, type, success: true, txHash: null, note: 'Already zero' });
        }
      } else if (type === 'ERC721') {
        const contract = new ethers.Contract(token, ERC721_ABI, k1Wallet);
        const isApproved = await contract.isApprovedForAll(k1Wallet.address, spender);
        if (isApproved) {
          const tx = await contract.setApprovalForAll(spender, false);
          await tx.wait();
          results.push({ token, spender, type, success: true, txHash: tx.hash });
        } else {
          results.push({ token, spender, type, success: true, txHash: null, note: 'Already false' });
        }
      } else if (type === 'EIP-7702-DELEGATE') {
        // Revoke EIP-7702 delegation by setting empty code
        const tx = await k1Wallet.sendTransaction({
          to: token, // token is the K1 address in this case
          data: '0xef0100' + '0'.repeat(40), // EIP-7702 revoke delegation code
          gasLimit: 50000
        });
        await tx.wait();
        results.push({ token, spender, type, success: true, txHash: tx.hash });
      } else {
        results.push({ token, spender, type, success: false, error: 'Unknown type' });
      }
    } catch (err) {
      results.push({ token: approval.token, spender: approval.spender, type: approval.type, success: false, error: err.message });
    }
  }

  return results;
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