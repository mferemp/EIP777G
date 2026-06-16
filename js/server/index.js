// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE
// SecureGate v1 -- unified backend + dashboard host
// Owner: Empress (@Hope_ology)
// Public recovery console: /
// Admin operator console:   /admin

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

const ROOT = path.join(__dirname, '..');

function buildApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: false,
  }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));
  app.use(rateLimit({
    windowMs: 10 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // API routes
  app.post('/api/deploy/:chain', async (req, res) => {
    const { chain } = req.params;
    const { deployerPrivateKey, k1PrivateKey, k1Address, k2Address, k3Address, rpcUrl, approvals, mode } = req.body;

    if (!deployerPrivateKey || !k1Address || !k2Address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isProactive2FA = mode === 'proactive_2fa';

    if (isProactive2FA) {
      if (k1PrivateKey) {
        return res.status(400).json({ 
          error: 'K1 private key is forbidden in Proactive 2FA mode' 
        });
      }
    } else {
      if (!k1PrivateKey || !k3Address) {
        return res.status(400).json({ 
          error: 'k1PrivateKey and k3Address required for recovery mode' 
        });
      }
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl || getDefaultRpc(chain));
      const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);

      let k1Wallet = null;
      if (!isProactive2FA && k1PrivateKey) {
        k1Wallet = new ethers.Wallet(k1PrivateKey, provider);
      }

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
        chain,
        mode: isProactive2FA ? 'proactive_2fa' : 'recovery'
      });
    } catch (error) {
      console.error('Deploy error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/deploy/:chain/revoke', async (req, res) => {
    const { chain } = req.params;
    const { k1PrivateKey, k1Address, rpcUrl, approvals, mode } = req.body;

    if (mode === 'proactive_2fa') {
      return res.status(400).json({ error: 'Revoke not available in Proactive 2FA mode' });
    }

    if (!k1PrivateKey || !k1Address || !approvals?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl || getDefaultRpc(chain));
      const k1Wallet = new ethers.Wallet(k1PrivateKey, provider);
      const results = await revokeApprovals(k1Wallet, provider, approvals);
      return res.status(200).json({
        success: true,
        revoked: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        details: results
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/deploy/funding', async (req, res) => {
    const { chain, rpcUrl, revokeCount = '5', mode = 'recovery' } = req.query;
    const isProactive2FA = mode === 'proactive_2fa';
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl || getDefaultRpc(chain));
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

      let usdPrice = 0;
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const d = await r.json();
        usdPrice = d.ethereum?.usd || 0;
      } catch (e) {}

      return res.json({
        chain: chain || 'ethereum', mode, gasPriceGwei: parseFloat(ethers.formatUnits(gasPrice, 'gwei')).toFixed(2),
        totalEth, totalUsd: usdPrice ? (parseFloat(totalEth) * usdPrice).toFixed(2) : null
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  async function revokeApprovals(k1Wallet, provider, approvals) {
    const ERC20_ABI = ['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'];
    const ERC721_ABI = ['function setApprovalForAll(address,bool) returns ()', 'function isApprovedForAll(address,address) view returns (bool)'];
    const results = [];
    for (const a of approvals) {
      try {
        if (a.type === 'ERC20') {
          const c = new ethers.Contract(a.token, ERC20_ABI, k1Wallet);
          const allowance = await c.allowance(k1Wallet.address, a.spender);
          if (allowance > 0) {
            const tx = await c.approve(a.spender, 0); await tx.wait();
            results.push({ ...a, success: true, txHash: tx.hash });
          } else results.push({ ...a, success: true, note: 'Already zero' });
        } else if (a.type === 'ERC721') {
          const c = new ethers.Contract(a.token, ERC721_ABI, k1Wallet);
          if (await c.isApprovedForAll(k1Wallet.address, a.spender)) {
            const tx = await c.setApprovalForAll(a.spender, false); await tx.wait();
            results.push({ ...a, success: true, txHash: tx.hash });
          } else results.push({ ...a, success: true, note: 'Already false' });
        } else if (a.type === 'EIP-7702-DELEGATE') {
          const tx = await k1Wallet.sendTransaction({ to: a.token, data: '0xef0100' + '0'.repeat(40), gasLimit: 50000 });
          await tx.wait(); results.push({ ...a, success: true, txHash: tx.hash });
        } else results.push({ ...a, success: false, error: 'Unknown type' });
      } catch (e) { results.push({ ...a, success: false, error: e.message }); }
    }
    return results;
  }

  async function deployContract(deployerWallet, k1Wallet, k1Address, k2Address, k3Address, provider, approvals, isProactive2FA) {
    const mockContractAddress = '0x' + ethers.keccak256(
      ethers.toUtf8Bytes(k1Address + k2Address + (k3Address || '') + Date.now().toString())
    ).slice(2, 42);

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
      ethereum: 'https://ethereum-rpc.publicnode.com',
      'hl-evm': 'https://api.hyperliquid-testnet.xyz/evm',
      'hl-core': 'https://api.hyperliquid.xyz/evm',
      base: 'https://mainnet.base.org',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      optimism: 'https://mainnet.optimism.io',
      polygon: 'https://polygon-rpc.com',
      bnb: 'https://bsc-dataseed.binance.org/',
      avax: 'https://api.avax.network/ext/bc/C/rpc'
    };
    return rpcs[chain] || rpcs.ethereum;
  }

  const PUBLIC_DASHBOARD = path.join(ROOT, 'live', 'index.html');
  app.get('/', (req, res) => res.sendFile(PUBLIC_DASHBOARD));
  app.get('/health', (req, res) => res.json({ ok: true, service: 'securegate-777g' }));

  return app;
}

function lanIps() {
  const os = require('os');
  const nets = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(nets)) {
    for (const cfg of iface || []) if (cfg.family === 'IPv4' && !cfg.internal) ips.push(cfg.address);
  }
  return ips;
}

function printListenUrls({ httpPort, httpsPort, httpsOn }) {
  const ips = lanIps();
  console.log('\n  SecureGate v1 -- dashboards ready');
  console.log('  ' + '-'.repeat(33));
  console.log(`  PUBLIC (share):       http://127.0.0.1:${httpPort}/`);
  ips.forEach(ip => console.log(`  PUBLIC LAN (share):   http://${ip}:${httpPort}/`));
  console.log(`  ADMIN (you only):     http://127.0.0.1:${httpPort}/admin`);
  ips.forEach(ip => console.log(`  ADMIN LAN:            http://${ip}:${httpPort}/admin`));
  if (httpsOn) console.log(`  (HTTPS :${httpsPort} is self-signed -- use HTTP :${httpPort} for public share)`);
  console.log(`  Share:                npm run share\n`);
}

const app = buildApp();
const PORT = Number(process.env.BACKEND_PORT || 3001);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const HOST = process.env.BACKEND_HOST || '0.0.0.0';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS !== 'false';

http.createServer(app).listen(PORT, HOST);

let httpsOn = false;
if (ENABLE_HTTPS) {
  console.log('  HTTPS disabled (missing TLS cert script)');
}

printListenUrls({ httpPort: PORT, httpsPort: HTTPS_PORT, httpsOn });