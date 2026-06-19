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
  const app = await text('/js/app.js?livecheck=' + Date.now());

  if (!app.r.ok || !/javascript/.test(app.r.headers.get('content-type') || '')) {
    fail('/js/app.js is not JS');
  } else {
    ok('/js/app.js is JS');
  }

  // Check for private-key posting patterns - more specific checks
  // These would be in request bodies, not just string presence
  if (app.body.includes('k1PrivateKey') || app.body.includes('deployerPrivateKey')) {
    fail('/js/app.js contains private key fields');
  } else {
    ok('/js/app.js no private key fields');
  }

  // Check for /api/deploy POST usage (OLD DEPRECATED ENDPOINT)
  if (app.body.includes('/api/deploy/') && app.body.includes('JSON.stringify') && app.body.includes('privateKey')) {
    fail('/js/app.js posts private keys to /api/deploy');
  } else {
    ok('/js/app.js no private key posts to /api/deploy');
  }

  // Check for old localStorage bypass
  if (app.body.includes('sg_bypass_hash') && app.body.includes('localStorage.setItem')) {
    fail('/js/app.js uses localStorage bypass');
  } else {
    ok('/js/app.js no localStorage bypass hash set');
  }

  // Check for third-party egress in fetch calls
  if (app.body.includes('api.etherscan.io') && app.body.includes('fetch')) {
    fail('/js/app.js calls etherscan.io directly');
  } else {
    ok('/js/app.js no direct etherscan calls');
  }

  if (app.body.includes('api.coingecko.com') && app.body.includes('fetch')) {
    fail('/js/app.js calls coingecko.com directly');
  } else {
    ok('/js/app.js no direct coingecko calls');
  }

  // Check for zero-address fallback
  if (app.body.includes("k3Addr || '0x0000000000000000000000000000000000000000'")) {
    fail('/js/app.js has zero-address fallback');
  } else {
    ok('/js/app.js no zero-address fallback');
  }

  // Artifact endpoint
  const art = await head('/artifacts/EIP777G.json?livecheck=' + Date.now());
  if (!art.ok || !/json/.test(art.headers.get('content-type') || '')) {
    fail('/artifacts/EIP777G.json is not JSON');
  } else {
    ok('/artifacts/EIP777G.json is JSON');
  }

  // Stale test file should not serve JS
  const stale = await head('/js/gate_test.js?livecheck=' + Date.now());
  if (stale.ok && /javascript/.test(stale.headers.get('content-type') || '')) {
    fail('/js/gate_test.js still serves JavaScript');
  } else {
    ok('/js/gate_test.js not serving JS');
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
  bypassBody.includes('Expected { k1Addr, token }')
    ? ok('/api/bypass-verify shape')
    : fail('/api/bypass-verify unexpected: ' + bypassBody);

  if (failures) process.exit(1);

  console.log('\nlive-check passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});