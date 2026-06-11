#!/usr/bin/env node
/**
 * SecureGate v1 — live multi-chain + on-chain verification
 * Owner: Empress (@Hope_ology)
 * No keys printed. RPC hosts only.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const { spawn } = require('child_process');
const { ethers } = require('ethers');

const ROOT = require('path').join(__dirname, '..');
const EXPECTED = {
  gate: '0x56310d7e48d9249df358ab9daa6a2dad0e03e242',
  k1: '0x01152d5c7467204bFa015061097b193CbceA8ca9',
  k2: '0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553',
  k3: '0xA0eb06a5fab172860837C4D68e75F339896500b5',
  authWindow: 3600,
  minDelay: 900,
};

const HL_CORE_API = (process.env.HL_CORE_API_URL || 'https://api.hyperliquid.xyz/info').trim();

const FABRICS = {
  ethereum: { name: 'Ethereum Mainnet', chainId: 1, env: ['RPC_URL', 'ETH_RPC_URL'], fallback: 'https://ethereum.publicnode.com' },
  'hl-evm': { name: 'Hyperliquid EVM', chainId: 999, env: ['HL_EVM_RPC_URL', 'HYPERLIQUID_RPC_URL'], fallback: 'https://rpc.hyperliquid.xyz/evm' },
  base: { name: 'Base', chainId: 8453, env: ['BASE_RPC_URL'], fallback: 'https://mainnet.base.org' },
  arbitrum: { name: 'Arbitrum One', chainId: 42161, env: ['ARBITRUM_RPC_URL'], fallback: 'https://arb1.arbitrum.io/rpc' },
  optimism: { name: 'Optimism', chainId: 10, env: ['OPTIMISM_RPC_URL'], fallback: 'https://mainnet.optimism.io' },
  polygon: { name: 'Polygon PoS', chainId: 137, env: ['POLYGON_RPC_URL'], fallback: 'https://polygon-rpc.com' },
  bnb: { name: 'BNB Chain', chainId: 56, env: ['BNB_RPC_URL', 'BSC_RPC_URL'], fallback: 'https://bsc-dataseed.binance.org' },
};

const EXTRA = {
  plasma: { name: 'Plasma', chainId: null, env: ['PLASMA_RPC_URL'] },
  ink: { name: 'Ink', chainId: null, env: ['INK_RPC_URL'] },
  avax: { name: 'Avalanche', chainId: 43114, env: ['AVAX_RPC_URL'] },
  monad: { name: 'Monad testnet', chainId: null, env: ['MONAD_RPC_URL'] },
  abstract: { name: 'Abstract', chainId: null, env: ['ABSTRACT_RPC_URL'] },
};

const RELAYS = [
  { id: 'flashbots', url: 'https://relay.flashbots.net' },
  { id: 'protect', url: 'https://rpc.flashbots.net' },
  { id: 'builder0x69', url: 'https://builder0x69.io' },
  { id: 'rsync', url: 'https://rsync-builder.xyz' },
  { id: 'titan', url: 'https://rpc.titanbuilder.xyz' },
  { id: 'beaver', url: 'https://rpc.beaverbuild.org' },
];

let passed = 0;
let failed = 0;

function ok(msg) { passed++; console.log(`  ✓ ${msg}`); }
function fail(msg, detail) { failed++; console.error(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`); }

function rpcHost(url) {
  try { return new URL(url).host; } catch { return '(invalid)'; }
}

function resolveRpc(envKeys, fallback) {
  for (const k of envKeys) {
    if (process.env[k]?.trim()) return process.env[k].trim();
  }
  return fallback || null;
}

async function probeChain(id, cfg) {
  const rpc = resolveRpc(cfg.env, cfg.fallback);
  if (!rpc) {
    fail(`${id} RPC`, 'no URL configured');
    return;
  }
  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const net = await provider.getNetwork();
    const block = await provider.getBlock('latest');
    const cid = Number(net.chainId);
    if (cfg.chainId && cid !== cfg.chainId) {
      fail(`${id} chainId`, `got ${cid} expected ${cfg.chainId} via ${rpcHost(rpc)}`);
      return;
    }
    ok(`${id} — chain ${cid} block ${block.number} (${rpcHost(rpc)})`);
    return { id, rpc, chainId: cid, block: block.number };
  } catch (e) {
    fail(`${id} RPC`, `${rpcHost(rpc)}: ${e.message}`);
  }
}

async function verifyEthereumGate() {
  console.log('\n[ETH MAINNET] Registry contract (live on-chain)');
  try {
    const gate = require('../gate');
    const state = await gate.readState();
    if (state.overallStatusLabel !== 'gate_deployed') {
      fail('registry deployed', state.overallStatusLabel);
      return;
    }
    ok('registry deployed at ' + EXPECTED.gate);

    const g = state.chains[0].gate;
    const checks = [
      ['K1', g.k1, EXPECTED.k1],
      ['K2', g.k2, EXPECTED.k2],
      ['K3', g.k3, EXPECTED.k3],
    ];
    for (const [label, got, exp] of checks) {
      if ((got || '').toLowerCase() === exp.toLowerCase()) ok(`on-chain ${label} = ${exp.slice(0, 10)}…`);
      else fail(`on-chain ${label}`, got);
    }
    if (g.authWindow === EXPECTED.authWindow) ok(`AUTH_WINDOW = ${g.authWindow}`);
    else fail('AUTH_WINDOW', String(g.authWindow));
    if (g.minDelay === EXPECTED.minDelay) ok(`MIN_DELAY = ${g.minDelay}`);
    else fail('MIN_DELAY', String(g.minDelay));

    if (state.model.envK1Bal != null) ok(`K1 balance readable: ${Number(state.model.envK1Bal).toFixed(6)} ETH`);
    if (state.model.envK3Bal != null) ok(`K3 balance readable: ${Number(state.model.envK3Bal).toFixed(6)} ETH`);

    if (process.env.DEPLOYER_PRIVATE_KEY) {
      const provider = new ethers.JsonRpcProvider(resolveRpc(['RPC_URL', 'ETH_RPC_URL'], FABRICS.ethereum.fallback));
      const w = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
      const bal = await provider.getBalance(w.address);
      ok(`deployer ${w.address.slice(0, 10)}… balance ${ethers.formatEther(bal)} ETH`);
    }
  } catch (e) {
    fail('ethereum gate read', e.message);
  }
}

async function probeRelay(r) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(r.url, { signal: ctrl.signal, headers: { 'User-Agent': 'SecureGate-Verify/1' } });
    const ms = Date.now() - started;
    if (res.status < 500) ok(`mesh ${r.id} online HTTP ${res.status} ${ms}ms`);
    else fail(`mesh ${r.id}`, `HTTP ${res.status}`);
  } catch (e) {
    fail(`mesh ${r.id}`, e.message);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    http.get({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, timeout: 15000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

async function probeHlCoreApi() {
  console.log('\n[HL CORE] Clearinghouse API');
  try {
    const res = await fetch(HL_CORE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
    });
    if (!res.ok) {
      fail('hl-core API', `HTTP ${res.status}`);
      return;
    }
    const meta = await res.json();
    if (meta?.universe?.length) ok(`hl-core meta — ${meta.universe.length} markets (${new URL(HL_CORE_API).host})`);
    else fail('hl-core API meta', 'missing universe');
  } catch (e) {
    fail('hl-core API', e.message);
  }
}

function verifyDeployScripts() {
  console.log('\n[DEPLOY SCRIPTS] Route wiring');
  const fs = require('fs');
  const scripts = [
    'deploy-bundle.js',
    'scripts/deploy-fabric.js',
    'scripts/deploy-hl-evm.js',
    'scripts/deploy-hl-core.js',
    'scripts/revoke-approvals.js',
    'scripts/revoke-fabric.js',
    'scripts/revoke-hl-core.js',
  ];
  for (const s of scripts) {
    if (fs.existsSync(require('path').join(ROOT, s))) ok(s);
    else fail(s, 'missing');
  }
  const deployJs = fs.readFileSync(require('path').join(ROOT, 'routes/deploy.js'), 'utf8');
  const required = ['hl-evm', 'hl-core', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb'];
  for (const id of required) {
    if (deployJs.includes(`'${id}'`) || deployJs.includes(`"${id}"`)) ok(`deploy route registered: ${id}`);
    else fail(`deploy route registered: ${id}`);
  }
  if (deployJs.includes('revoke-fabric.js')) ok('revoke-fabric wired');
  else fail('revoke-fabric wired');
  if (deployJs.includes('revoke-hl-core.js')) ok('revoke-hl-core wired');
  else fail('revoke-hl-core wired');
}

async function verifyServer() {
  console.log('\n[HTTP SERVER] Live dashboard + API');
  const port = Number(process.env.BACKEND_PORT || 3001) + 2000;
  const base = `http://127.0.0.1:${port}`;

  const child = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, BACKEND_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise(r => setTimeout(r, 1500));

  try {
    const health = await httpGet(`${base}/health`);
    if (health.status === 200) ok('GET /health');
    else fail('GET /health', String(health.status));

    const dash = await httpGet(`${base}/`);
    if (dash.status === 200 && dash.body.includes('PUBLIC_WIRING')) ok('GET / serves live build with PUBLIC_WIRING');
    else fail('GET / live dashboard');
    if (!dash.body.includes('ExportBundle')) ok('live has no ExportBundle');
    else fail('live leaks ExportBundle');

    const state = await httpGet(`${base}/api/state`);
    if (state.status === 200) {
      const d = JSON.parse(state.body);
      if (d.overallStatusLabel === 'gate_deployed') ok('GET /api/state gate_deployed');
      else fail('GET /api/state', d.overallStatusLabel);
    } else fail('GET /api/state', String(state.status));

    const mesh = await httpGet(`${base}/relay/mesh`);
    if (mesh.status === 200) {
      const d = JSON.parse(mesh.body);
      if (d.relays?.length >= 6) ok(`GET /relay/mesh ${d.online}/${d.total} online`);
      else fail('GET /relay/mesh');
    } else fail('GET /relay/mesh', String(mesh.status));

    const funding = await httpGet(`${base}/api/deploy/funding`);
    if (funding.status === 200 && JSON.parse(funding.body).chains?.length >= 8) ok('GET /api/deploy/funding 8 fabrics');
    else fail('GET /api/deploy/funding');

    const blocked = await httpGet(`${base}/api/export/build?download=1`);
    if (blocked.status === 403 || blocked.status === 503) ok(`export build locked without operator phrase (HTTP ${blocked.status})`);
    else fail('export gate', String(blocked.status));
  } catch (e) {
    fail('server', e.message);
  } finally {
    child.kill('SIGTERM');
  }
}

async function main() {
  console.log('SecureGate v1 — ALL CHAINS LIVE VERIFICATION');
  console.log('═'.repeat(50));

  console.log('\n[DASHBOARD FABRICS] RPC connectivity');
  for (const [id, cfg] of Object.entries(FABRICS)) {
    await probeChain(id, cfg);
  }

  console.log('\n[EXTRA .env RPCs]');
  for (const [id, cfg] of Object.entries(EXTRA)) {
    await probeChain(id, { ...cfg, fallback: null });
  }

  await verifyEthereumGate();
  await probeHlCoreApi();
  verifyDeployScripts();

  console.log('\n[BUILDER MESH] Direct relay probes');
  for (const r of RELAYS) await probeRelay(r);

  await verifyServer();

  console.log('\n' + '═'.repeat(50));
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });