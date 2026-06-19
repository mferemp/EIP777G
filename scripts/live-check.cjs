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

(async () => {
  const app = await text('/js/app.js?livecheck=' + Date.now());

  if (!app.r.ok || !/javascript/.test(app.r.headers.get('content-type') || '')) {
    fail('/js/app.js is not JS');
  } else {
    ok('/js/app.js is JS');
  }

  for (const p of [
    'deployerPrivateKey',
    'k1PrivateKey',
    '/api/deploy',
    'sg_bypass_hash',
    'api.etherscan.io',
    'api.coingecko.com',
    '0x0000000000000000000000000000000000000000'
  ]) {
    app.body.includes(p) ? fail('/js/app.js contains ' + p) : ok('/js/app.js no ' + p);
  }

  const art = await head('/artifacts/EIP777G.json?livecheck=' + Date.now());

  if (!art.ok || !/json/.test(art.headers.get('content-type') || '')) {
    fail('/artifacts/EIP777G.json is not JSON');
  } else {
    ok('/artifacts/EIP777G.json is JSON');
  }

  const stale = await head('/js/gate_test.js?livecheck=' + Date.now());

  if (stale.ok && /javascript/.test(stale.headers.get('content-type') || '')) {
    fail('/js/gate_test.js still serves JavaScript');
  } else {
    ok('/js/gate_test.js not serving JS');
  }

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

  console.log('
live-check passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
