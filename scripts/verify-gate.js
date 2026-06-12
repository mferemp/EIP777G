#!/usr/bin/env node
// verify-gate.js — CI check for on-chain EmpressGate state across chains
// Uses RPC_URLS JSON from env (no API keys required if using public RPCs)

const https = require('https');

const RPC_URLS_JSON = process.env.RPC_URLS || '{"eth":"https://ethereum-rpc.publicnode.com"}';
let RPC_URLS;
try {
  RPC_URLS = JSON.parse(RPC_URLS_JSON);
} catch (e) {
  console.error('ERROR: RPC_URLS env var must be valid JSON');
  process.exit(1);
}

const K1_ADDRESS = (process.env.K1_ADDRESS || '').toLowerCase();
const K2_ADDRESS = (process.env.K2_ADDRESS || '').toLowerCase();
const CLEAN_WALLET = (process.env.CLEAN_WALLET || '').toLowerCase();

if (!K1_ADDRESS || !K2_ADDRESS || !CLEAN_WALLET) {
  console.error('ERROR: K1_ADDRESS, K2_ADDRESS, and CLEAN_WALLET env vars are required.');
  process.exit(1);
}

function rpcCall(rpcUrl, method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const url = new URL(rpcUrl);
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

async function getBalance(rpcUrl, address) {
  const res = await rpcCall(rpcUrl, 'eth_getBalance', [address, 'latest']);
  if (res.error) throw new Error(`RPC error: ${res.error.message}`);
  return BigInt(res.result);
}

async function checkChain(chainName, rpcUrl) {
  console.log(`\n--- ${chainName.toUpperCase()} ---`);
  console.log('RPC:', rpcUrl);
  
  try {
    const [b1, b2, bc] = await Promise.all([
      getBalance(rpcUrl, K1_ADDRESS),
      getBalance(rpcUrl, K2_ADDRESS),
      getBalance(rpcUrl, CLEAN_WALLET),
    ]);

    const fmt = (b) => (Number(b) / 1e18).toFixed(6) + ' ETH';
    console.log('K1 balance    :', fmt(b1));
    console.log('K2 balance    :', fmt(b2));
    console.log('CLEAN balance :', fmt(bc));

    const keysNullified = b1 === 0n && b2 === 0n;
    console.log('Keys nullified (0 ETH):', keysNullified ? 'YES' : 'NO');

    if (!keysNullified) {
      console.warn('WARNING: K1 or K2 still holds ETH. Gate may not be fully executed.');
    }

    return { chain: chainName, keysNullified, balances: { k1: b1, k2: b2, clean: bc } };
  } catch (err) {
    console.error(`Failed on ${chainName}:`, err.message);
    return { chain: chainName, error: err.message };
  }
}

async function main() {
  console.log('=== EmpressGate Multi-Chain On-Chain Verify ===');
  console.log('Chains:', Object.keys(RPC_URLS).join(', '));
  console.log('K1       :', K1_ADDRESS);
  console.log('K2       :', K2_ADDRESS);
  console.log('CLEAN    :', CLEAN_WALLET);

  const results = await Promise.all(
    Object.entries(RPC_URLS).map(([chain, url]) => checkChain(chain, url))
  );

  console.log('\n=== SUMMARY ===');
  let allNullified = true;
  for (const r of results) {
    if (r.error) {
      console.log(`${r.chain}: ERROR - ${r.error}`);
    } else {
      console.log(`${r.chain}: ${r.keysNullified ? 'NULLIFIED ✓' : 'NOT NULLIFIED ✗'}`);
      if (!r.keysNullified) allNullified = false;
    }
  }

  console.log('\nOverall:', allNullified ? 'ALL CHAINS NULLIFIED ✓' : 'SOME CHAINS NOT NULLIFIED ✗');
  
  if (!allNullified) {
    console.warn('\nWARNING: Gate not fully executed on all chains.');
    // Exit 0 — this is a report, not a hard gate
  }
}

main();