#!/usr/bin/env node
/**
 * SecureGate v1 — smoke tests (no keys required for read-only checks)
 * Owner: Empress (@Hope_ology)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EXPECTED = {
  gate: '0x56310d7e48d9249df358ab9daa6a2dad0e03e242',
  k1: '0x01152d5c7467204bFa015061097b193CbceA8ca9',
  k2: '0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553',
  k3: '0xA0eb06a5fab172860837C4D68e75F339896500b5',
};

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function httpRequest(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function httpGet(url, headers = {}) {
  return httpRequest('GET', url, null, headers);
}

function httpPost(url, body, headers = {}) {
  return httpRequest('POST', url, body, headers);
}

async function testFiles() {
  console.log('\n[1] File structure');
  const required = [
    'operator/source/index.html', 'live/index.html', 'operator/CUSTODY.md',
    'docs/public/README.md', 'docs/public/PROTOCOL.md', 'docs/public/LICENSE',
    'docs/confidential/OPERATOR.md', 'docs/confidential/ACKNOWLEDGEMENT.md',
    'gate.js', 'EIP777G.json', 'server/index.js', 'server/relay.js',
    'routes/index.js', 'routes/state.js', 'routes/deploy.js', 'deploy-bundle.js',
    'scripts/build-live.js', 'scripts/deploy-fabric.js', 'scripts/deploy-hl-core.js',
    'scripts/deploy-hl-evm.js', 'scripts/revoke-approvals.js',
    'scripts/revoke-fabric.js', 'scripts/revoke-hl-core.js', 'scripts/lib/revoke-encode.js',
    'scripts/lib/builder-mesh.js', 'scripts/lib/severance-gate.js', 'scripts/eth-blitz-deploy.js',
  ];
  for (const f of required) {
    if (fs.existsSync(path.join(ROOT, f))) ok(f);
    else fail(f, 'missing');
  }

  const source = fs.readFileSync(path.join(ROOT, 'operator/source/index.html'), 'utf8');
  if (source.includes('SECUREGATE') || source.includes('SecureGate')) ok('source dashboard SecureGate branding');
  else fail('source dashboard branding');
  if (source.includes('ExportBundle') && source.includes('CodePanel')) ok('source export panel present');
  else fail('source export panel');
  if (!source.includes('if (!ObfuscationLayer.unlocked) return gateState')) ok('refreshGateState works without veil');
  else fail('refreshGateState still gated by veil');

  const live = fs.readFileSync(path.join(ROOT, 'live/index.html'), 'utf8');
  if (live.includes('SECUREGATE') || live.includes('SecureGate')) ok('live dashboard SecureGate branding');
  else fail('live dashboard branding');
  const liveForbidden = ['owner-code-panel', 'exportDashboardBox', 'CodePanel', 'ExportBundle', 'showSourceUnlock', 'id="identity-overlay"', 'id="idSecret"', 'id="veilPassphrase"', 'placeholder="Origin vector"'];
  for (const token of liveForbidden) {
    if (!live.includes(token)) ok(`live excludes ${token}`);
    else fail(`live contains forbidden ${token}`);
  }
  if (live.includes('LIVE_PUBLIC_ACCESS=!0') || live.includes('LIVE_PUBLIC_ACCESS=true')) ok('live PUBLIC_LINK access enabled');
  else fail('live PUBLIC_LINK access');
  if (live.includes('id="varsPanel"') && live.includes('id="deployerKey"')) ok('live recovery credentials panel');
  else fail('live recovery credentials panel');
  if (!/id="gateAddress"[^>]*value="0x/i.test(live) && !/id="k1Addr"[^>]*value="0x/i.test(live)) ok('live recovery fields not auto-populated');
  else fail('live recovery auto-populated address fields');
  if (!live.includes('Load wired defaults')) ok('live excludes operator-only load defaults');
  else fail('live exposes load wired defaults');
  if (live.includes('PUBLIC_WIRING')) ok('live internal wiring present (not shown in fields)');
  else fail('live PUBLIC_WIRING internal');
  const recoveryTabs = ['Telemetry', 'Queue', 'Authorize', 'Execute', 'Sever', 'Deploy', 'Beacon', 'Trace'];
  if (recoveryTabs.every((t) => live.includes(t))) ok('live full recovery tabs');
  else fail('live recovery tabs');
  if (live.includes('HowToPanel') && live.includes('PublicDocsPanel')) ok('live public how-to and docs');
  else fail('live public docs UI');
  if (live.includes('PUBLIC_WIRING')) ok('live PUBLIC_WIRING embedded');
  else fail('live PUBLIC_WIRING');
  if (!live.includes('simulateRelayActivity')) ok('no mesh simulation stub');
  else fail('mesh simulation stub still present');
  if (live.includes('viewport-fit=cover')) ok('mobile viewport meta');
  else fail('mobile viewport meta');
  if (!live.includes('_isLoopback()')) ok('no unauthorized localhost veil bypass');
  else fail('localhost veil bypass present');

  const publicReadme = fs.readFileSync(path.join(ROOT, 'docs/public/README.md'), 'utf8');
  if (publicReadme.includes('Helix Fabric')) ok('public README misdirection');
  else fail('public README misdirection');
  const confOp = fs.readFileSync(path.join(ROOT, 'docs/confidential/OPERATOR.md'), 'utf8');
  if (confOp.includes('CONFIDENTIAL')) ok('confidential OPERATOR.md');
  else fail('confidential OPERATOR.md');
}

async function testGateReader() {
  console.log('\n[2] On-chain gate reader (gate.js)');
  if (!process.env.RPC_URL) {
    fail('RPC_URL set', 'skip — set RPC_URL in .env');
    return;
  }
  try {
    const gate = require('../gate');
    const state = await gate.readState();
    if (state.overallStatusLabel === 'gate_deployed') ok('registry deployed on-chain');
    else fail('registry deployed', state.overallStatusLabel);

    const chain = state.chains[0];
    const g = chain.gate;
    if (g.k1?.toLowerCase() === EXPECTED.k1.toLowerCase()) ok('on-chain K1 matches spec');
    else fail('on-chain K1', g.k1);
    if (g.k2?.toLowerCase() === EXPECTED.k2.toLowerCase()) ok('on-chain K2 matches spec');
    else fail('on-chain K2', g.k2);
    if (g.k3?.toLowerCase() === EXPECTED.k3.toLowerCase()) ok('on-chain K3 matches spec');
    else fail('on-chain K3', g.k3);
    if (g.authWindow > 0) ok(`AUTH_WINDOW=${g.authWindow}`);
    else fail('AUTH_WINDOW');
    if (g.minDelay >= 0) ok(`MIN_DELAY=${g.minDelay}`);
    else fail('MIN_DELAY');
  } catch (e) {
    fail('gate.readState()', e.message);
  }
}

async function testServerEndpoints() {
  console.log('\n[3] HTTP server endpoints');
  const port = Number(process.env.BACKEND_PORT || 3001) + 1000;
  const base = `http://127.0.0.1:${port}`;

  execSync('node scripts/build-live.js', { cwd: ROOT, stdio: 'pipe' });

  const child = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      BACKEND_PORT: String(port),
      ENABLE_HTTPS: 'false',
      OPERATOR_VEIL_PHRASE: process.env.OPERATOR_VEIL_PHRASE || 'Hope_ology',
      OPERATOR_CONSENT_PHRASE: process.env.OPERATOR_CONSENT_PHRASE || 'EmpressConsentOnly',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise(r => setTimeout(r, 1200));

  try {
    const health = await httpGet(`${base}/health`);
    if (health.status === 200) ok('GET /health');
    else fail('GET /health', String(health.status));

    const dash = await httpGet(`${base}/`);
    if (dash.status === 200 && (dash.body.includes('SECUREGATE') || dash.body.includes('SECURE') && dash.body.includes('GATE'))) ok('GET / serves live dashboard');
    else fail('GET / live dashboard');
    if (!dash.body.includes('owner-code-panel')) ok('live served without source panel');
    else fail('live served with source panel');

    const exportRedirect = await httpGet(`${base}/export`);
    if (exportRedirect.status === 302 || exportRedirect.status === 301) ok('GET /export redirects to admin');
    else fail('GET /export redirect', String(exportRedirect.status));

    const adminDash = await httpGet(`${base}/admin`);
    if (adminDash.status === 200 && adminDash.body.includes('owner-code-panel')) ok('GET /admin serves operator dashboard');
    else fail('GET /admin operator dashboard');

    const howtoDoc = await httpGet(`${base}/api/docs/howto`);
    if (howtoDoc.status === 200 && howtoDoc.body.includes('Quick start')) ok('GET /api/docs/howto public');
    else fail('GET /api/docs/howto');

    if (dash.body.includes('HowToPanel') && !dash.body.includes('guide-overlay')) ok('public dashboard has How to not admin Guide');
    else fail('public how-to UI');

    const apiHealth = await httpGet(`${base}/api/health`);
    if (apiHealth.status === 200) ok('GET /api/health');
    else fail('GET /api/health', String(apiHealth.status));

    if (process.env.RPC_URL) {
      const st = await httpGet(`${base}/api/state`);
      if (st.status === 200) {
        const data = JSON.parse(st.body);
        if (data.overallStatusLabel === 'gate_deployed') ok('GET /api/state live');
        else fail('GET /api/state', data.overallStatusLabel);
      } else fail('GET /api/state', String(st.status));
    }

    const mesh = await httpGet(`${base}/relay/mesh`);
    if (mesh.status === 200) {
      const data = JSON.parse(mesh.body);
      if (Array.isArray(data.relays) && data.relays.length >= 6) ok('GET /relay/mesh live');
      else fail('GET /relay/mesh', 'bad payload');
    } else fail('GET /relay/mesh', String(mesh.status));

    const htmlDash = await httpGet(`${base}/`);
    if (htmlDash.body.includes('switchTab(7)') && htmlDash.body.includes('switchTab(5)') && htmlDash.body.includes('Recovery credentials')) ok('live recovery protocol served');
    else fail('live recovery protocol served');
    if (htmlDash.body.includes('id="varsPanel"') && htmlDash.body.includes('id="deployerKey"')) ok('live recovery paste boxes');
    else fail('live recovery paste boxes');

    const revokeBlocked = await httpPost(`${base}/api/deploy/ethereum/revoke`, {});
    if (revokeBlocked.status === 403) ok('revoke relay blocked without keys');
    else fail('revoke relay gate', String(revokeBlocked.status));

    const fakeKey = '0x' + '11'.repeat(32);
    const revokeAuth = await httpPost(`${base}/api/deploy/ethereum/revoke`, { k1PrivateKey: fakeKey, approvals: [] });
    if (revokeAuth.status !== 403) ok('revoke relay accepts ephemeral key auth (not 403)');
    else fail('revoke relay ephemeral auth', 'still 403');
    const src = fs.readFileSync(path.join(ROOT, 'operator/source/index.html'), 'utf8');
    if (src.includes('Operator Variables') && src.includes('deployBtnHtml')) ok('operator source retains full build');
    else fail('operator source full build');
    if (!htmlDash.body.includes('id="ownership-overlay"') && htmlDash.body.includes('id="howto-overlay"')) ok('public hides admin ownership overlay');
    else fail('public ownership strip');

    const docsList = await httpGet(`${base}/api/docs/list`);
    if (docsList.status === 200) {
      const data = JSON.parse(docsList.body);
      if (data.docs?.length >= 6) ok('GET /api/docs/list');
      else fail('GET /api/docs/list', 'insufficient docs');
    } else fail('GET /api/docs/list', String(docsList.status));

    const dashBlocked = await httpGet(`${base}/api/docs/dashboard`);
    if (dashBlocked.status === 403) ok('GET /api/docs/dashboard blocked without operator phrase');
    else fail('GET /api/docs/dashboard without proof', String(dashBlocked.status));

    const { ethers } = require('ethers');
    const proof = ethers.keccak256(ethers.toUtf8Bytes('Hope_ology:sg:v1'));
    const dashDoc = await httpGet(`${base}/api/docs/dashboard`, { 'X-Operator-Proof': proof });
    const dashContent = dashDoc.status === 200 ? JSON.parse(dashDoc.body).content || '' : '';
    if (dashDoc.status === 200 && (dashContent.includes('operator/source') || dashContent.includes('SecureGate'))) ok('GET /api/docs/dashboard with operator phrase');
    else fail('GET /api/docs/dashboard with proof', String(dashDoc.status));

    const operatorBlocked = await httpGet(`${base}/api/docs/operator`);
    if (operatorBlocked.status === 403) ok('GET /api/docs/operator blocked without proof');
    else fail('GET /api/docs/operator without proof', String(operatorBlocked.status));

    const operatorOk = await httpGet(`${base}/api/docs/operator`, { 'X-Operator-Proof': proof });
    if (operatorOk.status === 200 && JSON.parse(operatorOk.body).content?.includes('CONFIDENTIAL')) ok('GET /api/docs/operator with veil proof');
    else fail('GET /api/docs/operator with proof', String(operatorOk.status));

    const ack = await httpGet(`${base}/api/docs/acknowledgement`);
    if (ack.status === 200 && JSON.parse(ack.body).consentLocked) ok('GET /api/docs/acknowledgement');
    else fail('GET /api/docs/acknowledgement', String(ack.status));

    const ackAlterBlocked = await httpPost(`${base}/api/docs/acknowledgement`, {}, { 'X-Operator-Proof': proof });
    if (ackAlterBlocked.status === 403) ok('POST /api/docs/acknowledgement blocked without consent');
    else fail('POST acknowledgement without consent', String(ackAlterBlocked.status));

    const buildBlocked = await httpGet(`${base}/api/export/build?download=1`);
    if (buildBlocked.status === 403) ok('GET /api/export/build blocked without operator phrase');
    else fail('GET /api/export/build without proof', String(buildBlocked.status));

    const funding = await httpGet(`${base}/api/deploy/funding`);
    if (funding.status === 200) {
      const chains = JSON.parse(funding.body).chains || [];
      const ids = chains.map(c => c.id);
      const required = ['ethereum', 'hl-evm', 'hl-core', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb'];
      if (chains.length >= 8 && required.every(id => ids.includes(id))) ok('GET /api/deploy/funding 8 fabrics');
      else fail('GET /api/deploy/funding', `got ${ids.join(',')}`);
    } else fail('GET /api/deploy/funding', String(funding.status));

    const deployRoute = require('../routes/deploy');
    if (typeof deployRoute === 'function' || deployRoute.stack) ok('deploy routes module loads');
    else fail('deploy routes module');

    const deployJs = fs.readFileSync(path.join(ROOT, 'routes/deploy.js'), 'utf8');
    if (deployJs.includes('revoke-fabric.js') && deployJs.includes('revoke-hl-core.js')) ok('multi-chain revoke routes wired');
    else fail('multi-chain revoke routes');
    if (deployJs.includes('/severance')) ok('severance gate API');
    else fail('severance gate API');

    const severance = await httpGet(`${base}/api/deploy/severance`);
    if (severance.status === 200 && JSON.parse(severance.body).fabrics) ok('GET /api/deploy/severance');
    else fail('GET /api/deploy/severance', String(severance.status));
  } catch (e) {
    fail('server endpoints', e.message);
  } finally {
    child.kill('SIGTERM');
  }
}

async function main() {
  console.log('SecureGate v1 — smoke tests');
  await testFiles();
  await testGateReader();
  await testServerEndpoints();

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});