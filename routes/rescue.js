const path = require('path');
const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const { requireRelayAuth } = require('./operator-gate');

const deployBundlePath = path.join(__dirname, '../deploy-bundle.js');

// Manual rescue trigger — SAFE, MANUAL ONLY
router.post('/', requireRelayAuth, async (req, res) => {
  const chain = req.body.chain;

  try {
    const output = execSync(`node ${deployBundlePath} ${chain}`, {
      encoding: 'utf8'
    });
    res.json({ ok: true, output });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

module.exports = router;
