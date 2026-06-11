const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const { execSync } = require('child_process');
const { requireOperatorGate } = require('./operator-gate');

const router = express.Router();
const ROOT = path.join(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dashboard']);
const SKIP_NAMES = new Set(['.env', 'acknowledgement.log', 'recovery.log']);

function walk(dir, rel = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...walk(full, relPath));
    } else {
      out.push({ path: relPath, bytes: stat.size });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

router.get('/manifest', requireOperatorGate, (req, res) => {
  const files = walk(ROOT);
  res.json({
    ok: true,
    project: 'securegate-v1',
    fileCount: files.length,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
    files,
  });
});

router.get('/build', requireOperatorGate, (req, res) => {
  const tmpZip = path.join(os.tmpdir(), `helix-fabric-build-${Date.now()}.zip`);
  try {
    execSync(
      `zip -r -q "${tmpZip}" . -x "node_modules/*" -x ".git/*" -x ".env" -x "*/*.log" -x "acknowledgement.log" -x "recovery.log"`,
      { cwd: ROOT, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const buf = fs.readFileSync(tmpZip);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="securegate-v1-build.zip"');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ ok: false, error: 'zip_failed', message: err.message });
  } finally {
    try { fs.unlinkSync(tmpZip); } catch (_) {}
  }
});

module.exports = router;