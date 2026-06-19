#!/usr/bin/env node

const BASE = process.env.LIVE_URL || 'https://securegate-777g.vercel.app';

let failures = 0;

function fail(msg) {
  failures++;
  console.error('FAIL:', msg);
}

function ok(msg) {
  console.log('ok:', msg);
}

async function fetchText(path) {
  const url = BASE + path + (path.includes('?') ? '&' : '?') + 't=' + Date.now();
  const r = await fetch(url, { cache: 'no-store' });
  return { r, text: await r.text(), url };
}

async function fetchHead(path) {
  const url = BASE + path + (path.includes('?') ? '&' : '?') + 't=' + Date.now();
  return fetch(url, { method: 'HEAD', cache: 'no-store' });
}

(async () => {
  console.log('checking live:', BASE);

  const home = await fetchText('/');
  if (!home.r.ok) fail('/ did not return ok');
  else ok('/ returns ok');

  const build = await fetchText('/build.json');
  if (!build.r.ok || !/json/.test(build.r.headers.get('content-type') || '')) {
    fail('/build.json missing or not JSON');
  } else {
    ok('/build.json is JSON');
    console.log(build.text.slice(0, 300));
  }

  const scriptMatch = home.text.match(/<script\s+src=["'](js\/app[^"']+\.js)["']><\/script>/);
  if (!scriptMatch) {
    fail('home page does not reference cache-busted app JS');
  } else {
    ok('home references ' + scriptMatch[1]);
  }

  const appPath = '/' + (scriptMatch ? scriptMatch[1] : 'js/app.js');
  const app = await fetchText(appPath);

  if (!app.r.ok || !/javascript/.test(app.r.headers.get('content-type') || '')) {
    fail(appPath + ' is not JavaScript');
  } else {
    ok(appPath + ' is JavaScript');
  }

  const forbidden = [
    'deployerPrivateKey',
    'k1PrivateKey',
    '/api/deploy',
    'sg_bypass_hash',
    'BYPASS_HASH',
    'setAdminBypassHash',
    'checkAdminBypass',
    'api.etherscan.io',
    'api.coingecko.com',
    'api.fontshare.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    '0x0000000000000000000000000000000000000000',
    'PROJECT: SecureGate'
  ];

  for (const pat of forbidden) {
    if (app.text.includes(pat)) fail(appPath + ' contains stale marker: ' + pat);
    else ok(appPath + ' no ' + pat);
  }

  const artifact = await fetchHead('/artifacts/EIP777G.json');
  if (!artifact.ok || !/json/.test(artifact.headers.get('content-type') || '')) {
    fail('/artifacts/EIP777G.json missing or not JSON');
  } else {
    ok('/artifacts/EIP777G.json is JSON');
  }

  const staleGateTest = await fetchHead('/js/gate_test.js');
  if (staleGateTest.ok && /javascript/.test(staleGateTest.headers.get('content-type') || '')) {
    fail('/js/gate_test.js still serves JavaScript');
  } else {
    ok('/js/gate_test.js not serving JavaScript');
  }

  const relay = await fetch(BASE + '/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });

  const relayBody = await relay.text();
  if (relayBody.includes('Expected { chainId:int, signedTxs:[0x...] }')) {
    ok('/api/relay shape ok');
  } else {
    fail('/api/relay unexpected: ' + relayBody);
  }

  const bypass = await fetch(BASE + '/api/bypass-verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });

  const bypassBody = await bypass.text();
  if (bypassBody.includes('Expected { k1Addr, token }')) {
    ok('/api/bypass-verify shape ok');
  } else {
    fail('/api/bypass-verify unexpected: ' + bypassBody);
  }

  if (failures) {
    console.error('\n' + failures + ' live stale-check failure(s).');
    process.exit(1);
  }

  console.log('\nlive-stale-check passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
