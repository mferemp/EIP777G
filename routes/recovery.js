const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { requireRelayAuth } = require('./operator-gate');

const router = express.Router();
const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'recovery.log');

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}

router.get('/logs', (req, res) => {
  try {
    const logs = fs.readFileSync(LOG_FILE, 'utf8');
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'log_read_error', message: err.message });
  }
});

router.post('/plan', (req, res) => {
  const notes = req.body.notes || '';
  const plan = {
    timestamp: Date.now(),
    steps: [
      'Courier funds mesh fees',
      'Blitz — ETH builder mesh (Flashbots-class relays)',
      'Atomic link severance — revoke approvals batch',
      'Registry snap — α/β/γ lanes wired immutably',
      'α queue → β attest → commit → γ terminus',
    ],
    notes,
  };
  fs.appendFileSync(LOG_FILE, `[PLAN BUILT] ${JSON.stringify(plan)}\n`);
  res.json(plan);
});

router.post('/execute', requireRelayAuth, (req, res) => {
  const notes = req.body.notes || '';
  const fabric = (req.body.fabric || req.body.chain || 'ethereum').trim();
  const scriptMap = {
    ethereum: 'scripts/revoke-approvals.js',
    'hl-core': 'scripts/revoke-hl-core.js',
  };
  const rel = scriptMap[fabric] || 'scripts/revoke-fabric.js';
  const script = path.join(ROOT, rel);
  const env = { ...process.env };
  if (fabric !== 'ethereum' && fabric !== 'hl-core') env.REVOKE_FABRIC = fabric;
  if (req.body.approvals?.length) env.REVOKE_APPROVALS_JSON = JSON.stringify(req.body.approvals);
  if (req.body.k1PrivateKey) env.K1_PRIVATE_KEY = req.body.k1PrivateKey;
  if (req.body.rpcUrl) env.RPC_URL = req.body.rpcUrl;

  try {
    const output = execSync(`node "${script}"`, {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 180000,
      env,
    });

    const result = {
      timestamp: Date.now(),
      status: 'revoke_script_completed',
      message: 'Link severance script finished — see output for bundle inclusion.',
      notes,
      output: output.trim(),
    };

    fs.appendFileSync(LOG_FILE, `[EXECUTED] ${JSON.stringify(result)}\n`);
    res.json(result);
  } catch (err) {
    const result = {
      timestamp: Date.now(),
      status: 'revoke_script_failed',
      message: err.message,
      notes,
      output: (err.stdout || err.stderr || '').trim(),
    };
    fs.appendFileSync(LOG_FILE, `[EXECUTE ERROR] ${JSON.stringify(result)}\n`);
    res.status(500).json(result);
  }
});

module.exports = router;