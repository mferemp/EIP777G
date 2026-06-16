// Vercel Serverless Function: GET /api/deploy/funding
// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE

const { ethers } = require('ethers');

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain, rpcUrl, revokeCount = '5', mode = 'recovery' } = req.query;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl || getDefaultRpc(chain));
    
    // Get gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

    const count = BigInt(revokeCount);
    const deployGas = 3000000n;
    const revokeGasPer = 80000n;
    const verifyGas = 50000n;
    const sweeperGas = 150000n;

    let totalGas = 0n;
    const isProactive = mode === 'proactive_2fa';
    const isWalletRepo = mode === 'wallet_repo';

    if (isProactive) {
      // 2FA Preventative: K1 funds, NO deployer, NO flashbots, NO revokes
      totalGas = ((deployGas + verifyGas) * 130n) / 100n;
    } else if (isWalletRepo) {
      // Wallet Repo: deployer funds, Flashbots + revoke-all + sweeper bots
      totalGas = ((deployGas + count * revokeGasPer + sweeperGas + verifyGas) * 130n) / 100n;
    } else {
      // Standard Recovery: deployer funds, revoke bundle
      totalGas = ((deployGas + count * revokeGasPer + verifyGas) * 130n) / 100n;
    }

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

    // Calculate dynamic percentages from actual gas estimates
    const deployGasEst = deployGas;
    const verifyGasEst = verifyGas;
    const revokeGasTotal = count * revokeGasPer;
    const sweeperGasEst = sweeperGas;
    const totalGasUnbuffered = isProactive
      ? deployGasEst + verifyGasEst
      : isWalletRepo
        ? deployGasEst + revokeGasTotal + sweeperGasEst + verifyGasEst
        : deployGasEst + revokeGasTotal + verifyGasEst;

    const deployPct = (deployGasEst * 100 / totalGasUnbuffered).toFixed(0);
    const revokePct = isProactive ? '0' : (revokeGasTotal * 100 / totalGasUnbuffered).toFixed(0);
    const sweeperPct = isWalletRepo ? (sweeperGasEst * 100 / totalGasUnbuffered).toFixed(0) : '0';
    const verifyPct = (verifyGasEst * 100 / totalGasUnbuffered).toFixed(0);

    return res.status(200).json({
      chain: chain || 'ethereum',
      gasPriceGwei: parseFloat(ethers.formatUnits(gasPrice, 'gwei')).toFixed(2),
      deployGas: deployGas.toString(),
      revokeGasPer: revokeGasPer.toString(),
      revokeCount: count.toString(),
      verifyGas: verifyGas.toString(),
      sweeperGas: sweeperGas.toString(),
      totalGas: totalGas.toString(),
      totalWei: totalWei.toString(),
      totalEth: totalEth,
      totalUsd: usdPrice ? (parseFloat(totalEth) * usdPrice).toFixed(2) : null,
      mode: mode,
      deployEth: (parseFloat(totalEth) * deployGasEst / totalGasUnbuffered).toFixed(6),
      revokeEth: isProactive ? '0' : (parseFloat(totalEth) * revokeGasTotal / totalGasUnbuffered).toFixed(6),
      sweeperEth: isWalletRepo ? (parseFloat(totalEth) * sweeperGasEst / totalGasUnbuffered).toFixed(6) : '0',
      verifyEth: (parseFloat(totalEth) * verifyGasEst / totalGasUnbuffered).toFixed(6),
      deployPct: deployPct,
      revokePct: revokePct,
      sweeperPct: sweeperPct,
      verifyPct: verifyPct
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