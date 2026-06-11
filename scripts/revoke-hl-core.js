#!/usr/bin/env node
/**
 * SecureGate v1 — Hyperliquid Core agent / delegate severance
 * Owner: Empress (@Hope_ology)
 *
 * Revokes HL trading agents assigned to K1 via signed exchange action.
 * Not EVM — uses api.hyperliquid.xyz/exchange
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { ethers } = require('ethers');

const HL_EXCHANGE_URL = (process.env.HL_EXCHANGE_URL || 'https://api.hyperliquid.xyz/exchange').trim();
const HL_INFO_URL = (process.env.HL_CORE_API_URL || 'https://api.hyperliquid.xyz/info').trim();
const ZERO_AGENT = '0x0000000000000000000000000000000000000000';

function requireEnv(name) {
  const val = process.env[name]?.trim();
  if (!val) throw new Error(`${name} is not set`);
  return val;
}

async function hlPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`HL HTTP ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

async function main() {
  const k1Pk = requireEnv('K1_PRIVATE_KEY');
  const k1Addr = requireEnv('K1_ADDRESS');
  const k1 = new ethers.Wallet(k1Pk);
  if (k1.address.toLowerCase() !== k1Addr.toLowerCase()) {
    throw new Error(`K1_PRIVATE_KEY does not match K1_ADDRESS`);
  }

  const agentsToRevoke = [];
  if (process.env.HL_AGENTS_TO_REVOKE_JSON) {
    const parsed = JSON.parse(process.env.HL_AGENTS_TO_REVOKE_JSON);
    for (const a of parsed) {
      agentsToRevoke.push({
        agentAddress: (a.agentAddress || a.agent || ZERO_AGENT).toLowerCase(),
        agentName: a.agentName || a.name || '',
      });
    }
  } else if (process.env.HL_AGENT_TO_REVOKE) {
    agentsToRevoke.push({
      agentAddress: process.env.HL_AGENT_TO_REVOKE.toLowerCase(),
      agentName: process.env.HL_AGENT_NAME || '',
    });
  } else {
    agentsToRevoke.push({ agentAddress: ZERO_AGENT, agentName: '' });
  }

  console.log('HL Core severance — exchange API');
  console.log('K1 (α):', k1.address);
  console.log('Exchange:', HL_EXCHANGE_URL);

  const state = await hlPost(HL_INFO_URL, { type: 'clearinghouseState', user: k1.address });
  const agentAddr = state?.agentAddress || state?.agent?.address;
  if (agentAddr && agentAddr !== ZERO_AGENT) {
    console.log(`On-chain agent registered: ${agentAddr}`);
    if (!process.env.HL_AGENT_TO_REVOKE && !process.env.HL_AGENTS_TO_REVOKE_JSON) {
      agentsToRevoke[0].agentAddress = agentAddr.toLowerCase();
    }
  }

  const chainId = 421614;
  const nonce = Date.now();
  const results = [];

  for (const agent of agentsToRevoke) {
    const action = {
      type: 'approveAgent',
      hyperliquidChain: 'Mainnet',
      signatureChainId: `0x${chainId.toString(16)}`,
      agentAddress: agent.agentAddress,
      agentName: agent.agentName || 'revoke',
    };

    const domain = {
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    };
    const types = {
      'HyperliquidTransaction:ApproveAgent': [
        { name: 'hyperliquidChain', type: 'string' },
        { name: 'agentAddress', type: 'address' },
        { name: 'agentName', type: 'string' },
        { name: 'nonce', type: 'uint64' },
      ],
    };
    const value = {
      hyperliquidChain: action.hyperliquidChain,
      agentAddress: action.agentAddress,
      agentName: action.agentName,
      nonce,
    };

    const signature = await k1.signTypedData(domain, types, value);
    const payload = { action, nonce, signature };

    console.log(`→ approveAgent sever ${agent.agentAddress} (${agent.agentName || 'unnamed'})`);
    const resp = await hlPost(HL_EXCHANGE_URL, payload);
    results.push({ agent: agent.agentAddress, response: resp });
    console.log('  ✓ exchange accepted:', JSON.stringify(resp).slice(0, 160));
  }

  console.log(`\n✓ HL Core severance submitted — ${results.length} agent action(s)`);
  console.log(JSON.stringify({ fabric: 'hl-core', k1: k1.address, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});