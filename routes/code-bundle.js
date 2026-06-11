const path = require('path');
const fsSync = require('fs');
const express = require('express');
const { execSync } = require('child_process');
const os = require('os');
const { requireOperatorGate } = require('./operator-gate');

const router = express.Router();
const ROOT = path.join(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.git']);
const SKIP_NAMES = new Set(['.env', 'acknowledgement.log', 'recovery.log', 'package-lock.json']);

function walk(dir, rel = '') {
  const out = [];
  for (const name of fsSync.readdirSync(dir)) {
    if (SKIP_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    const stat = fsSync.statSync(full);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      out.push(...walk(full, relPath));
    } else {
      out.push(relPath);
    }
  }
  return out.sort();
}

function buildFullSourceText() {
  const files = walk(ROOT);
  const header = [
    '################################################################################',
    '# SecureGate v1 — COMPLETE SOURCE BUILD (all project files)',
    '# Owner: Empress (@Hope_ology) — sole author',
    `# Generated: ${new Date().toISOString()}`,
    `# Files: ${files.length}`,
    '################################################################################',
    '',
  ].join('\n');

  const chunks = [header];
  for (const relPath of files) {
    const full = path.join(ROOT, relPath);
    let body;
    try {
      body = fsSync.readFileSync(full, 'utf8');
    } catch (_) {
      body = '[binary or unreadable — see tar download]';
    }
    chunks.push(
      '',
      '═'.repeat(80),
      `BEGIN FILE: ${relPath}`,
      '═'.repeat(80),
      body,
      '',
      `END FILE: ${relPath}`,
    );
  }
  return { text: chunks.join('\n'), files, fileCount: files.length };
}

router.get('/full', requireOperatorGate, (req, res) => {
  const { text, files, fileCount } = buildFullSourceText();
  const download = req.query.download === '1';
  if (download) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="securegate-v1-COMPLETE-SOURCE.txt"');
    return res.send(text);
  }
  res.json({
    ok: true,
    project: 'securegate-v1',
    fileCount,
    bytes: text.length,
    files,
    content: text,
  });
});

router.get('/tar', requireOperatorGate, (req, res) => {
  const tmp = path.join(os.tmpdir(), `securegate-v1-${Date.now()}.tar.gz`);
  try {
    execSync(
      `tar -czf "${tmp}" --exclude=node_modules --exclude=.env --exclude='*.log' -C "${ROOT}" .`,
      { timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const buf = fsSync.readFileSync(tmp);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="securegate-v1-COMPLETE-SOURCE.tar.gz"');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ ok: false, error: 'tar_failed', message: err.message });
  } finally {
    try { fsSync.unlinkSync(tmp); } catch (_) {}
  }
});

module.exports = router;