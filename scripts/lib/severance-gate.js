/**
 * SecureGate v1 — per-fabric severance gate (revokes before deploy)
 * Owner: Empress (@Hope_ology)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const STATE_PATH = path.join(ROOT, 'operator', 'severance-state.json');

const EVM_FABRICS = ['ethereum', 'hl-evm', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb'];
const ALL_FABRICS = [...EVM_FABRICS, 'hl-core'];

function readState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { fabrics: {} };
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { fabrics: {} };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function markSevered(chain, meta = {}) {
  const state = readState();
  state.fabrics[chain] = {
    severed: true,
    at: new Date().toISOString(),
    ...meta,
  };
  writeState(state);
  return state.fabrics[chain];
}

function isSevered(chain) {
  return !!readState().fabrics[chain]?.severed;
}

function getStatus() {
  const state = readState();
  const fabrics = {};
  for (const id of ALL_FABRICS) {
    fabrics[id] = state.fabrics[id] || { severed: false };
  }
  const pending = ALL_FABRICS.filter(id => !fabrics[id].severed);
  return { fabrics, allSevered: pending.length === 0, pending };
}

function assertDeployAllowed(chain) {
  if (process.env.SKIP_SEVERANCE_GATE === '1') return;
  if (!ALL_FABRICS.includes(chain)) return;
  if (!isSevered(chain)) {
    throw new Error(
      `Severance required on ${chain} before gate deploy — run delegate/approval revokes first (POST /api/deploy/${chain}/revoke)`,
    );
  }
}

module.exports = {
  STATE_PATH,
  ALL_FABRICS,
  EVM_FABRICS,
  readState,
  markSevered,
  isSevered,
  getStatus,
  assertDeployAllowed,
};