#!/usr/bin/env node
// verify-gate.js — CI check for on-chain EmpressGate state
// Uses publicnode RPC (no API key required)

const https = require('https');

const RPC_URL    = process.env.RPC_URL    || 'https://ethereum-rpc.publicnode.com';
const K1_ADDRESS = (process.env.K1_ADDRESS || '').toLowerCase();
const K2_ADDRESS = (process.env.K2_ADDRESS || '').toLowerCase();
const CLEAN_WALLET = (process.env.CLEAN_WALLET || '').toLowerCase();

if (!K1_ADDRESS || !K2_ADDRESS || !CLEAN_WALLET) {
  console.error('ERROR: K1_ADDRESS, K2_ADDRESS, and CLEAN_WALLET env vars are required.');
  process.exit(1);
}

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const url = new URL(RPC_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getBalance(address) {
  const res = await rpcCall('eth_getBalance', [address, 'latest']);
  if (res.error) throw new Error(`RPC error: ${res.error.message}`);
  return BigInt(res.result);
}

async function main() {
  console.log('=== EmpressGate On-Chain Verify ===');
  console.log('RPC      :', RPC_URL);
  console.log('K1       :', K1_ADDRESS);
  console.log('K2       :', K2_ADDRESS);
  console.log('CLEAN    :', CLEAN_WALLET);
  console.log('');

  try {
    const [b1, b2, bc] = await Promise.all([
      getBalance(K1_ADDRESS),
      getBalance(K2_ADDRESS),
      getBalance(CLEAN_WALLET),
    ]);

    const fmt = (b) => (Number(b) / 1e18).toFixed(6) + ' ETH';
    console.log('K1 balance    :', fmt(b1));
    console.log('K2 balance    :', fmt(b2));
    console.log('CLEAN balance :', fmt(bc));
    console.log('');

    // Gate check: both compromised keys should have 0 balance (drained / nullified)
    const keysNullified = b1 === 0n && b2 === 0n;
    console.log('Keys nullified (0 ETH):', keysNullified ? 'YES' : 'NO');

    if (!keysNullified) {
      console.warn('WARNING: K1 or K2 still holds ETH. Gate may not be fully executed.');
      // Do not fail CI — this is a report, not a hard gate
    }

    console.log('');
    console.log('Verify complete.');
  } catch (err) {
    console.error('Verify failed:', err.message);
    process.exit(1);
  }
}

main();
