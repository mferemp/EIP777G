#!/usr/bin/env node
const BASE = process.env.LIVE_URL || 'https://securegate-777g.vercel.app';

let failures = 0;
const fail = m => { failures++; console.error('FAIL:', m); };
const ok = m => console.log('ok:', m);

async function text(path) {
  const r = await fetch(BASE + path, { cache: 'no-store' });
  return { r, body: await r.text() };
}

async function head(path) {
  return fetch(BASE + path, { method: 'HEAD', cache: 'no-store' });
}

async function checkCsp() {
  const r = await fetch(BASE + '/', { cache: 'no-store' });
  const csp = r.headers.get('content-security-policy') || '';
  if (!csp.includes("connect-src 'self'") || csp.includes('etherscan.io') || csp.includes('coingecko.com') || csp.includes('fontshare.com')) {
    fail('CSP does not enforce connect-src self only');
  } else {
    ok('CSP connect-src self only');
  }
}

(async () => {
  // Resolve current versioned app script from HTML
  const home = await text('/');
  const scriptMatch = home.body.match(/<script\s+src=["'](js\/app[^"']+\.js)["']><\/script>/);
  if (!scriptMatch) {
    fail('home page does not reference cache-busted app JS');
    process.exit(1);
  }
  const appPath = '/' + scriptMatch[1];
  ok('home references ' + scriptMatch[1]);

  const app = await text(appPath + '?livecheck=' + Date.now());

  const isObfuscated = /^(\(function\(_0x|const\s+_0x[0-9a-f]+\s*=\s*function)/.test(app.body.trimStart().slice(0, 80));

  if (!app.r.ok || !/javascript/.test(app.r.headers.get('content-type') || '')) {
    fail(appPath + ' is not JS');
  } else {
    ok(appPath + ' is JS');
  }

  if (!isObfuscated && (app.body.includes('k1PrivateKey') || app.body.includes('deployerPrivateKey'))) {
    fail(appPath + ' contains private key fields');
  } else if (isObfuscated) {
    fail(appPath + ' obfuscated — literal scan skipped; runtime-network-check required before gate closure');
  } else {
    ok(appPath + ' no private key fields');
  }

  if (!isObfuscated && app.body.includes('/api/deploy/') && app.body.includes('JSON.stringify') && app.body.includes('privateKey')) {
    fail(appPath + ' posts private keys to /api/deploy');
  } else if (isObfuscated) {
    fail(appPath + ' obfuscated — deploy-poster literal scan skipped; runtime-network-check required before gate closure');
  } else {
    ok(appPath + ' no private key posts to /api/deploy');
  }

  if (app.body.includes('sg_bypass_hash') && app.body.includes('localStorage.setItem')) {
    fail(appPath + ' uses localStorage bypass');
  } else {
    ok(appPath + ' no localStorage bypass hash set');
  }

  if (app.body.includes('api.etherscan.io') && app.body.includes('fetch')) {
    fail(appPath + ' calls etherscan.io directly');
  } else {
    ok(appPath + ' no direct etherscan calls');
  }

  if (app.body.includes('api.coingecko.com') && app.body.includes('fetch')) {
    fail(appPath + ' calls coingecko.com directly');
  } else {
    ok(appPath + ' no direct coingecko calls');
  }

  if (app.body.includes("k3Addr || '0x0000000000000000000000000000000000000000'")) {
    fail(appPath + ' has zero-address fallback');
  } else {
    ok(appPath + ' no zero-address fallback');
  }

  // Stale test file should not serve JS
  const stale = await head('/js/gate_test.js?livecheck=' + Date.now());
  if (stale.ok && /javascript/.test(stale.headers.get('content-type') || '')) {
    fail('/js/gate_test.js still serves JavaScript');
  } else {
    ok('/js/gate_test.js not serving JS');
  }

  // genesis-verification.js must not be referenced in home HTML
  if (home.body.includes('js/genesis-verification.js')) {
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

  // CSP
  await checkCsp();

  // API endpoints
  const relay = await fetch(BASE + '/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  const relayBody = await relay.text();
  relayBody.includes('Expected { chainId:int, signedTxs:[0x...] }')
    ? ok('/api/relay shape')
    : fail('/api/relay unexpected: ' + relayBody);

  const bypass = await fetch(BASE + '/api/bypass-verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  const bypassBody = await bypass.text();
  bypassBody.includes('Expected { k1Addr, token }') || bypassBody.includes('Expected { token }')
    ? ok('/api/bypass-verify shape')
    : fail('/api/bypass-verify unexpected: ' + bypassBody);

  if (failures) process.exit(1);

  console.log('\nlive-check passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
