// Vercel Serverless Function: GET /api/deploy/funding
// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE

const { ethers } = require('ethers');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain, rpcUrl, revokeCount = '5', mode = 'recovery' } = req.query;
  const isProactive2FA = mode === 'proactive_2fa';

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl || getDefaultRpc(chain));
    
    // Get gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

    const count = isProactive2FA ? 0n : BigInt(revokeCount);
    const deployGas = 3000000n;
    const revokeGasPer = 80000n;
    const verifyGas = 50000n;
    const auth2Gas = 50000n;
    
    const totalGas = ((deployGas + count * revokeGasPer + verifyGas + (isProactive2FA ? auth2Gas : 0n)) * 130n) / 100n;
    const totalWei = totalGas * gasPrice;
    const totalEth = parseFloat(ethers.formatEther(totalWei)).toFixed(6);

    // Get ETH price in USD
    let usdPrice = 0;
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      usdPrice = data.ethereum?.usd || 0;
    } catch (e) {
      // Ignore price fetch errors
    }

    return res.status(200).json({
      chain: chain || 'ethereum',
      mode: mode,
      gasPriceGwei: parseFloat(ethers.formatUnits(gasPrice, 'gwei')).toFixed(2),
      deployGas: deployGas.toString(),
      revokeGasPer: revokeGasPer.toString(),
      revokeCount: count.toString(),
      verifyGas: verifyGas.toString(),
      auth2Gas: isProactive2FA ? auth2Gas.toString() : '0',
      totalGas: totalGas.toString(),
      totalWei: totalWei.toString(),
      totalEth: totalEth,
      totalUsd: usdPrice ? (parseFloat(totalEth) * usdPrice).toFixed(2) : null,
      deployEth: (parseFloat(totalEth) * (isProactive2FA ? 0.7 : 0.6)).toFixed(6),
      revokeEth: isProactive2FA ? '0' : (parseFloat(totalEth) * 0.3).toFixed(6),
      auth2Eth: isProactive2FA ? (parseFloat(totalEth) * 0.15).toFixed(6) : '0',
      verifyEth: (parseFloat(totalEth) * (isProactive2FA ? 0.15 : 0.1)).toFixed(6)
    });
  } catch (error) {
    console.error('Funding calculation error:', error);
    return res.status(500).json({ error: error.message || 'Funding calculation failed' });
  }
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