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

  const scriptMatch = home.text.match(/<script\s+src=["'](js\/app[^"']+\.js)["']><\/script>/);
  if (!scriptMatch) {
    fail('home page does not reference cache-busted app JS');
  } else {
    ok('home references ' + scriptMatch[1]);
  }

  const appPath = '/' + scriptMatch[1];
  const app = await fetchText(appPath);

  const isObfuscated = /^(\(function\(_0x|const\s+_0x[0-9a-f]+\s*=\s*function)/.test(app.text.trimStart().slice(0, 80));

  if (!app.r.ok || !/javascript/.test(app.r.headers.get('content-type') || '')) {
    fail(appPath + ' is not JavaScript');
  } else {
    ok(appPath + ' is JavaScript');
  }

  if (isObfuscated) {
    fail(appPath + ' obfuscated — literal stale-marker scan skipped; runtime-network-check required before gate closure');
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

  // Stale test file should not serve JS
  const staleGateTest = await fetchHead('/js/gate_test.js');
  if (staleGateTest.ok && /javascript/.test(staleGateTest.headers.get('content-type') || '')) {
    fail('/js/gate_test.js still serves JavaScript');
  } else {
    ok('/js/gate_test.js not serving JavaScript');
  }

  // genesis-verification.js must not be referenced in home HTML
  if (home.text.includes('js/genesis-verification.js')) {
    fail('home HTML still references js/genesis-verification.js');
  } else {
    ok('home HTML does not reference genesis-verification.js');
  }

  // excluded artifact/source paths must not serve HTML
  const excluded = [
    '/js/genesis-verification.js',
    '/artifacts/EIP777G.json',
    '/contracts/EIP777G.sol',
    '/EIP777G.json',
    '/abi.json',
    '/bytecode.txt'
  ];
  for (const p of excluded) {
    const r = await fetch(BASE + p, { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    const looksLikeHtml = /text\/html/.test(ct) || body.trimStart().startsWith('<!doctype html>') || body.trimStart().startsWith('<html');
    if (looksLikeHtml && r.ok) {
      fail(p + ' returns HTML (SPA rewrite leak)');
    } else {
      ok(p + ' does not return HTML');
    }
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
  if (bypassBody.includes('Expected { k1Addr, token }') || bypassBody.includes('Expected { token }')) {
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
