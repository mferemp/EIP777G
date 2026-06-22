#!/usr/bin/env node
// runtime-network-check.cjs
// Validates that no outgoing network request from the SecureGate dashboard
// leaks secrets, private keys, or third-party destinations.
//
// Run against live:
//   LIVE_URL=https://securegate-777g.vercel.app node scripts/runtime-network-check.cjs
// Run against local preview:
//   LIVE_URL=http://localhost:3000 node scripts/runtime-network-check.cjs
//
// Requires: playwright (already installed in this workspace)

const { chromium } = require('playwright');

const BASE = (process.env.LIVE_URL || 'https://securegate-777g.vercel.app').replace(/\/+$/, '');

const ALLOWED_ONLY = {
  '/api/relay': { method: 'POST', shape: (body) => {
    try {
      const obj = JSON.parse(body);
      return obj.chainId !== undefined &&
             Array.isArray(obj.signedTxs) &&
             Object.keys(obj).every(k => ['chainId','signedTxs'].includes(k));
    } catch { return false; }
  }}
};

let captured = [];
let failures = 0;
const fail = m => { failures++; console.error('FAIL:', m); };
const ok = m => console.log('ok:', m);

// This script is injected BEFORE any app code runs.
const preload = () => {
  const forbidden = ["privateKey","k1PrivateKey","deployerPrivateKey","mnemonic","seedPhrase","seed","secret","alchemy.com/v2/","rpc"];

  function sniff(body, url, method) {
    const text = (typeof body === 'string' ? body : JSON.stringify(body)).toLowerCase();
    for (const token of forbidden) {
      if (text.includes(token.toLowerCase())) {
        console.error('[RUNTIME LEAK]', method, url, 'contains', token);
      }
    }
    if (!captured) captured = [];
    captured.push({ url, method, size: (text || '').length });
  }

  window._sg_network_capture = captured;

  // fetch
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const [resource, init] = args;
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = (init && init.method) || 'GET';
    const body = init && init.body;
    sniff(body, url, method);
    return origFetch.apply(window, args);
  };

  // XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._sg_method = method;
    this._sg_url = url;
    return origOpen.apply(this, arguments);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    sniff(body, this._sg_url, this._sg_method);
    return origSend.apply(this, arguments);
  };

  // navigator.sendBeacon
  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function(url, body) {
      sniff(body, url, 'BEACON');
      return origBeacon.apply(this, arguments);
    };
  }

  // WebSocket
  const OrigWS = window.WebSocket;
  window.WebSocket = class extends OrigWS {
    constructor(url, protocols) {
      super(url, protocols);
      this._sg_url = url;
    }
    send(data) {
      sniff(data, this._sg_url, 'WS');
      return super.send(data);
    }
  };

  console.log('[RUNTIME] network interception active');
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en',
  });

  console.log('Checking:', BASE);
  await page.addInitScript(preload);

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    fail('page load failed: ' + e.message);
  }

  // Let idle settle
  await page.waitForTimeout(5000);

  // Check captured requests
  const leaks = [];
  const all = await page.evaluate(() => window._sg_network_capture || []);
  for (const req of all) {
    const bodyText = (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '')).toLowerCase();
    for (const token of FORBIDDEN_BODY) {
      if (bodyText.includes(token.toLowerCase())) {
        leaks.push({ url: req.url, method: req.method, token });
      }
    }
  }

  if (leaks.length) {
    for (const l of leaks) fail('secret leak in request: ' + l.method + ' ' + l.url + ' [' + l.token + ']');
  } else {
    ok('no secret leak in outgoing requests');
  }

  // Verify allowed-only endpoints match expected shape
  // (relay is the only known POST target in the public console stub)
  for (const req of all) {
    if (req.url.endsWith('/api/relay') && req.method === 'POST') {
      try {
        const obj = JSON.parse(req.body);
        if (obj.chainId === undefined || !Array.isArray(obj.signedTxs)) {
          fail('/api/relay body mismatch: ' + JSON.stringify(obj));
        } else {
          ok('/api/relay body shape');
        }
      } catch {
        fail('/api/relay body not JSON');
      }
    }
  }

  await browser.close();

  if (failures) {
    console.error('\n' + failures + ' runtime network check failure(s).');
    process.exit(1);
  }

  console.log('\nruntime-network-check passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
