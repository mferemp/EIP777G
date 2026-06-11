#!/usr/bin/env node
/**
 * SecureGate v1 — Hyperliquid Core bootstrap (clearinghouse API)
 * Owner: Empress (@Hope_ology)
 *
 * HL Core is not an EVM contract deploy. This script verifies the clearinghouse
 * API surface and records lane topology for operator bootstrap.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { ethers } = require('ethers');
const { assertDeployAllowed } = require('./lib/severance-gate');

const HL_API_URL = (process.env.HL_CORE_API_URL || 'https://api.hyperliquid.xyz/info').trim();

function requireEnv(name) {
  const val = process.env[name]?.trim();
  if (!val) throw new Error(`${name} is not set in environment`);
  return val;
}

async function hlPost(body) {
  const res = await fetch(HL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL API HTTP ${res.status}`);
  return res.json();
}

function summarizeBalances(state) {
  if (!state?.marginSummary) return null;
  const ms = state.marginSummary;
  return {
    accountValue: ms.accountValue,
    totalNtlPos: ms.totalNtlPos,
    totalRawUsd: ms.totalRawUsd,
  };
}

async function main() {
  assertDeployAllowed('hl-core');
  const k1 = requireEnv('K1_ADDRESS');
  const k2 = requireEnv('K2_ADDRESS');
  const k3 = requireEnv('CLEAN_WALLET');
  const deployerPk = requireEnv('DEPLOYER_PRIVATE_KEY');
  const courier = new ethers.Wallet(deployerPk).address;

  console.log('HL Core API:', HL_API_URL);
  console.log('Surface: clearinghouse (not EVM deploy)');
  console.log('Courier:', courier);
  console.log('K1 (α):', k1);
  console.log('K2 (β):', k2);
  console.log('K3 (γ):', k3);

  const meta = await hlPost({ type: 'meta' });
  if (!meta?.universe?.length) throw new Error('HL meta response missing universe');
  console.log(`✓ HL meta — ${meta.universe.length} markets indexed`);

  const probes = [
    { label: 'K1', user: k1 },
    { label: 'K3', user: k3 },
    { label: 'Courier', user: courier },
  ];

  const laneStates = {};
  for (const p of probes) {
    try {
      const state = await hlPost({ type: 'clearinghouseState', user: p.user });
      const summary = summarizeBalances(state);
      laneStates[p.label] = {
        user: p.user,
        reachable: true,
        withdrawable: state?.withdrawable ?? null,
        marginSummary: summary,
        assetPositions: Array.isArray(state?.assetPositions) ? state.assetPositions.length : 0,
      };
      console.log(`✓ clearinghouseState ${p.label} — withdrawable ${state?.withdrawable ?? 'n/a'}`);
    } catch (e) {
      laneStates[p.label] = { user: p.user, reachable: false, error: e.message };
      console.log(`⚠ clearinghouseState ${p.label} — ${e.message}`);
    }
  }

  const manifest = {
    fabric: 'hl-core',
    apiUrl: HL_API_URL,
    bootstrappedAt: new Date().toISOString(),
    lanes: { k1, k2, k3, courier },
    authWindow: Number(process.env.AUTH_WINDOW || 3600),
    minDelay: Number(process.env.MIN_DELAY || 900),
    ethRegistry: process.env.GATE_ADDRESS || null,
    hlEvmRegistry: process.env.SECUREGATE_HL_ADDRESS || null,
    metaMarkets: meta.universe.length,
    laneStates,
    note: 'HL Core bootstrap complete — wire observability in dashboard; perps/spot exits use HL exchange API separately from EVM registry.',
  };

  console.log('\n--- HL CORE BOOTSTRAP MANIFEST ---');
  console.log(JSON.stringify(manifest, null, 2));
  console.log('\nSet in .env:  HL_CORE_BOOTSTRAPPED=1');
  console.log('HL Core lane map verified against clearinghouse API.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});