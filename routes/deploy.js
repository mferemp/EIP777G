const path = require('path');
const express = require('express');
const { execSync } = require('child_process');
const { requireRelayAuth } = require('./operator-gate');
const { getStatus, markSevered, isSevered } = require('../scripts/lib/severance-gate');

const router = express.Router();
const ROOT = path.join(__dirname, '..');

const CHAIN_SCRIPTS = {
  ethereum: { script: 'deploy-bundle.js', label: 'Ethereum Mainnet' },
  'hl-evm': { script: 'scripts/deploy-fabric.js', label: 'Hyperliquid EVM', fabric: 'hl-evm' },
  'hl-core': { script: 'scripts/deploy-hl-core.js', label: 'Hyperliquid Core', api: true },
  base: { script: 'scripts/deploy-fabric.js', label: 'Base', fabric: 'base' },
  arbitrum: { script: 'scripts/deploy-fabric.js', label: 'Arbitrum One', fabric: 'arbitrum' },
  optimism: { script: 'scripts/deploy-fabric.js', label: 'Optimism', fabric: 'optimism' },
  polygon: { script: 'scripts/deploy-fabric.js', label: 'Polygon PoS', fabric: 'polygon' },
  bnb: { script: 'scripts/deploy-fabric.js', label: 'BNB Chain', fabric: 'bnb' },
};

const REVOKE_SCRIPTS = {
  ethereum: { script: 'scripts/revoke-approvals.js', label: 'Ethereum Mainnet', flashbots: true },
  'hl-evm': { script: 'scripts/revoke-fabric.js', label: 'Hyperliquid EVM', fabric: 'hl-evm' },
  'hl-core': { script: 'scripts/revoke-hl-core.js', label: 'Hyperliquid Core', api: true },
  base: { script: 'scripts/revoke-fabric.js', label: 'Base', fabric: 'base' },
  arbitrum: { script: 'scripts/revoke-fabric.js', label: 'Arbitrum One', fabric: 'arbitrum' },
  optimism: { script: 'scripts/revoke-fabric.js', label: 'Optimism', fabric: 'optimism' },
  polygon: { script: 'scripts/revoke-fabric.js', label: 'Polygon PoS', fabric: 'polygon' },
  bnb: { script: 'scripts/revoke-fabric.js', label: 'BNB Chain', fabric: 'bnb' },
};

const RPC_ENV_BY_CHAIN = {
  ethereum: 'RPC_URL',
  'hl-evm': 'HL_EVM_RPC_URL',
  base: 'BASE_RPC_URL',
  arbitrum: 'ARBITRUM_RPC_URL',
  optimism: 'OPTIMISM_RPC_URL',
  polygon: 'POLYGON_RPC_URL',
  bnb: 'BNB_RPC_URL',
};

function buildEnv(body = {}, chain, cfg = {}) {
  const env = { ...process.env };
  if (body.rpcUrl) {
    if (chain === 'hl-core') {
      env.HL_CORE_API_URL = body.rpcUrl;
    } else {
      env.RPC_URL = body.rpcUrl;
      const rpcKey = RPC_ENV_BY_CHAIN[chain];
      if (rpcKey) env[rpcKey] = body.rpcUrl;
    }
  }
  if (body.apiUrl) env.HL_CORE_API_URL = body.apiUrl;
  if (cfg.fabric) env.DEPLOY_FABRIC = cfg.fabric;
  if (cfg.revokeFabric) env.REVOKE_FABRIC = cfg.revokeFabric;
  if (body.gateAddress) env.GATE_ADDRESS = body.gateAddress;
  if (body.k1Address) env.K1_ADDRESS = body.k1Address;
  if (body.k2Address) env.K2_ADDRESS = body.k2Address;
  if (body.k3Address) env.CLEAN_WALLET = body.k3Address;
  if (body.deployerPrivateKey) env.DEPLOYER_PRIVATE_KEY = body.deployerPrivateKey;
  if (body.k1PrivateKey) env.K1_PRIVATE_KEY = body.k1PrivateKey;
  if (body.approvals?.length) {
    env.REVOKE_APPROVALS_JSON = JSON.stringify(body.approvals);
  }
  if (body.hlAgents?.length) {
    env.HL_AGENTS_TO_REVOKE_JSON = JSON.stringify(body.hlAgents);
  }
  return env;
}

function runScript(relPath, env, timeout = 180000) {
  const full = path.join(ROOT, relPath);
  return execSync(`node "${full}"`, {
    encoding: 'utf8',
    cwd: ROOT,
    timeout,
    env,
  }).trim();
}

router.get('/severance', (req, res) => {
  res.json(getStatus());
});

router.get('/funding', (req, res) => {
  res.json({
    chains: [
      { id: 'ethereum', name: 'Ethereum Mainnet', mesh: '6-builder Flashbots mesh', symbol: 'ETH', deployMin: 0.012, revokeMin: 0.008, buffer: 0.005, totalMin: 0.025, totalMax: 0.035, note: 'Mesh severance (fund K1 + revokes) → mesh gate snap' },
      { id: 'hl-evm', name: 'Hyperliquid EVM', mesh: 'HL Sequencer', symbol: 'HYPE', deployMin: 0.001, revokeMin: 0.001, buffer: 0.001, totalMin: 0.004, totalMax: 0.01, note: 'K1-signed delegate severance + registry deploy' },
      { id: 'hl-core', name: 'Hyperliquid Core', mesh: 'Clearinghouse API', symbol: 'USDC', deployMin: 0, revokeMin: 0, buffer: 0, totalMin: 0, totalMax: 0, note: 'Agent/delegate severance via exchange API + bootstrap' },
      { id: 'base', name: 'Base', mesh: 'L2 Sequencer', symbol: 'ETH', deployMin: 0.0008, revokeMin: 0.0005, buffer: 0.0003, totalMin: 0.002, totalMax: 0.005, note: 'K1-signed severance then EIP-1559 deploy' },
      { id: 'arbitrum', name: 'Arbitrum One', mesh: 'L2 Sequencer', symbol: 'ETH', deployMin: 0.0008, revokeMin: 0.0005, buffer: 0.0003, totalMin: 0.002, totalMax: 0.005, note: 'K1-signed severance then deploy' },
      { id: 'optimism', name: 'Optimism', mesh: 'L2 Sequencer', symbol: 'ETH', deployMin: 0.0008, revokeMin: 0.0005, buffer: 0.0003, totalMin: 0.002, totalMax: 0.005, note: 'K1-signed severance then deploy' },
      { id: 'polygon', name: 'Polygon PoS', mesh: 'Validator set', symbol: 'MATIC', deployMin: 1.5, revokeMin: 1.0, buffer: 0.5, totalMin: 4, totalMax: 10, note: 'K1 severance + deploy — fund K1 in MATIC' },
      { id: 'bnb', name: 'BNB Chain', mesh: 'Validator set', symbol: 'BNB', deployMin: 0.002, revokeMin: 0.002, buffer: 0.001, totalMin: 0.007, totalMax: 0.015, note: 'K1-signed severance then deploy' },
    ],
  });
});

router.post('/:chain/revoke', requireRelayAuth, async (req, res) => {
  const chain = req.params.chain;
  const cfg = REVOKE_SCRIPTS[chain];
  const body = req.body || {};

  if (!cfg) {
    return res.status(404).json({
      ok: false,
      chain,
      message: `Unknown fabric for severance: ${chain}`,
      known: Object.keys(REVOKE_SCRIPTS),
    });
  }

  if (!body.k1PrivateKey && !process.env.K1_PRIVATE_KEY) {
    return res.status(400).json({
      ok: false,
      chain,
      message: 'K1 private key required — severance must be signed by α lane (compromised wallet with delegates)',
    });
  }

  try {
    const env = buildEnv(body, chain, { revokeFabric: cfg.fabric });
    const output = runScript(cfg.script, env, cfg.flashbots ? 300000 : 180000);
    markSevered(chain, { mesh: cfg.flashbots ? 'flashbots-mesh' : cfg.api ? 'hl-exchange' : 'sequencer' });
    res.json({
      ok: true,
      chain,
      label: cfg.label,
      output,
      severed: true,
      mesh: cfg.flashbots ? '6-builder Flashbots mesh' : cfg.api ? 'HL Exchange' : 'Sequencer',
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      chain,
      label: cfg.label,
      error: err.message,
      output: (err.stdout || err.stderr || '').trim(),
    });
  }
});

router.post('/:chain', requireRelayAuth, async (req, res) => {
  const chain = req.params.chain;
  const cfg = CHAIN_SCRIPTS[chain];
  const body = req.body || {};

  if (!cfg) {
    return res.status(404).json({
      ok: false,
      chain,
      message: `Unknown fabric: ${chain}`,
      known: Object.keys(CHAIN_SCRIPTS),
    });
  }

  if (!body.forceDeploy && !isSevered(chain)) {
    return res.status(409).json({
      ok: false,
      chain,
      message: `Severance required on ${chain} before gate deploy — run delegate revokes on this fabric first`,
      severance: getStatus(),
    });
  }

  try {
    const env = buildEnv(body, chain, cfg);
    const output = runScript(cfg.script, env);
    res.json({ ok: true, chain, label: cfg.label, output, usedSessionVars: !!(body.deployerPrivateKey || body.rpcUrl || body.apiUrl) });
  } catch (err) {
    res.status(500).json({
      ok: false,
      chain,
      label: cfg.label,
      error: err.message,
      output: (err.stdout || err.stderr || '').trim(),
    });
  }
});

module.exports = router;