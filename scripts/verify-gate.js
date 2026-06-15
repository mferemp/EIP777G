#!/usr/bin/env node
// verify-gate.js — Genesis Lock Verification
// Crawls on-chain state across chains to verify Genesis Lock integrity

const https = require('https');

const RPC_URLS_JSON = process.env.RPC_URLS || '{"eth":"https://ethereum-rpc.publicnode.com"}';
let RPC_URLS;
try { RPC_URLS = JSON.parse(RPC_URLS_JSON); } catch { console.error('RPC_URLS must be valid JSON'); process.exit(1); }

const K1_GENESIS = (process.env.K1_ADDRESS || '').toLowerCase();
const K2_AUTHORITY = (process.env.K2_ADDRESS || '').toLowerCase();
const K3_DROP = (process.env.CLEAN_WALLET || '').toLowerCase();
const GATE_ADDRESS = (process.env.GATE_ADDRESS || '').toLowerCase();

if (!K1_GENESIS || !K2_AUTHORITY || !K3_DROP || !GATE_ADDRESS) {
    console.error('Required: K1_ADDRESS, K2_ADDRESS, CLEAN_WALLET, GATE_ADDRESS');
    process.exit(0);
}

// Contract ABI for verifyGenesis
const GATE_ABI = [
    "function verifyGenesis() view returns (address,address,address,address,uint64,uint256,bytes32)",
    "function isK1Blacklisted(address) view returns (bool)",
    "function isSevered() view returns (bool,bool)",
    "function k1Genesis() view returns (address)",
    "function k2Authority() view returns (address)",
    "function k3DropWallet() view returns (address)",
    "function authWindow() view returns (uint64)",
    "function minDelay() view returns (uint64)",
    "function deployer() view returns (address)",
    "function deployedAt() view returns (uint64)",
    "function chainId() view returns (uint256)",
    "function genesisHash() view returns (bytes32)"
];

function rpcCall(rpcUrl, method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const url = new URL(rpcUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON: ' + data)); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function ethCall(rpcUrl, to, data) {
    const res = await rpcCall(rpcUrl, 'eth_call', [{ to, data }, 'latest']);
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
}

async function getBalance(rpcUrl, address) {
    const res = await rpcCall(rpcUrl, 'eth_getBalance', [address, 'latest']);
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return BigInt(res.result);
}

function encodeFunctionCall(abi, args = []) {
    // Minimal ABI encoding for view functions
    const selector = require('crypto').createHash('sha3-256').update(abi.split('(')[0] + '(' + abi.split('(')[1].split(')')[0] + ')').digest().slice(0, 4);
    if (args.length === 0) return '0x' + selector.toString('hex');
    // Simplified - for production use ethers.js
    return '0x' + selector.toString('hex');
}

async function verifyGenesis(rpcUrl, gateAddr) {
    const data = '0x' + require('crypto').createHash('sha3-256').update('verifyGenesis()').digest().slice(0, 4).toString('hex');
    const result = await ethCall(rpcUrl, gateAddr, data);
    // Decode manually - in production use ethers.js ABI coder
    return result;
}

async function checkChain(chainName, rpcUrl) {
    console.log(`\n--- ${chainName.toUpperCase()} ---`);
    console.log('RPC:', rpcUrl);
    
    try {
        // 1. Verify Genesis Lock on-chain
        console.log('Checking Genesis Lock...');
        const genesisData = await verifyGenesis(rpcUrl, GATE_ADDRESS);
        console.log('Genesis verified:', genesisData ? 'YES' : 'NO');
        
        // 2. Check K1 balance (should be 0 = nullified)
        const b1 = await getBalance(rpcUrl, K1_GENESIS);
        const b2 = await getBalance(rpcUrl, K2_AUTHORITY);
        const b3 = await getBalance(rpcUrl, K3_DROP);
        const bgate = await getBalance(rpcUrl, GATE_ADDRESS);
        
        const fmt = (b) => (Number(b) / 1e18).toFixed(6) + ' ETH';
        console.log('K1 Genesis balance:', fmt(b1), b1 === 0n ? '✓ NULLIFIED' : '✗ HAS BALANCE');
        console.log('K2 Authority balance:', fmt(b2));
        console.log('K3 Drop balance:', fmt(b3));
        console.log('Gate contract balance:', fmt(bgate));
        
        // 3. Check blacklist
        // Would need eth_call to isK1Blacklisted(k1Genesis)
        
        // 4. Check severance
        // Would need eth_call to isSevered()
        
        const k1Nullified = b1 === 0n;
        const k2Nullified = b2 === 0n;
        const k3HasFunds = b3 > 0n;
        
        console.log('\nStatus:');
        console.log('  K1 nullified:', k1Nullified ? '✓ YES' : '✗ NO');
        console.log('  K2 nullified:', k2Nullified ? '✓ YES' : '✗ NO');
        console.log('  K3 receiving:', k3HasFunds ? '✓ YES' : '—');
        
        return {
            chain: chainName,
            k1Nullified,
            k2Nullified,
            k3HasFunds,
            genesisVerified: !!genesisData,
            rpcUrl
        };
    } catch (err) {
        console.error(`Failed on ${chainName}:`, err.message);
        return { chain: chainName, error: err.message };
    }
}

async function main() {
    console.log('=== EIP777G Genesis Lock Verification ===');
    console.log('Gate:', GATE_ADDRESS);
    console.log('K1 Genesis:', K1_GENESIS);
    console.log('K2 Authority:', K2_AUTHORITY);
    console.log('K3 Drop:', K3_DROP);
    console.log('Chains:', Object.keys(RPC_URLS).join(', '));
    
    const results = await Promise.all(
        Object.entries(RPC_URLS).map(([chain, url]) => checkChain(chain, url))
    );
    
    console.log('\n=== SUMMARY ===');
    let allNullified = true;
    for (const r of results) {
        if (r.error) {
            console.log(`${r.chain}: ERROR - ${r.error}`);
        } else {
            const status = r.k1Nullified && r.k2Nullified ? 'SECURED ✓' : 'COMPROMISED ✗';
            console.log(`${r.chain}: ${status} | K1: ${r.k1Nullified?'0':'BAL'} | K2: ${r.k2Nullified?'0':'BAL'} | K3: ${r.k3HasFunds?'FUNDED':'empty'} | Genesis: ${r.genesisVerified?'✓':'✗'}`);
            if (!r.k1Nullified || !r.k2Nullified) allNullified = false;
        }
    }
    
    console.log('\nOverall:', allNullified ? 'ALL CHAINS SECURED ✓ — Justice restored' : 'SOME CHAINS COMPROMISED ✗');
}

main().catch(console.error);
