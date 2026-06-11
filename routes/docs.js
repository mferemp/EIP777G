const path = require('path');
const fs = require('fs');
const express = require('express');
const { requireOperatorGate, requireOperatorConsent } = require('./operator-gate');

const router = express.Router();
const ROOT = path.join(__dirname, '..');

const DOCS = {
  acknowledgement: {
    file: 'docs/confidential/ACKNOWLEDGEMENT.md',
    label: 'ACKNOWLEDGEMENT.md (consent-locked)',
    public: true,
    consentLocked: true,
  },
  howto: { file: 'docs/public/HOW-TO.md', label: 'HOW-TO.md (public quick start)', public: true },
  readme: { file: 'docs/public/README.md', label: 'README.md (public misdirection)', public: true },
  protocol: { file: 'docs/public/PROTOCOL.md', label: 'PROTOCOL.md (public misdirection)', public: true },
  license: { file: 'docs/public/LICENSE', label: 'LICENSE (public)', public: true },
  operator: { file: 'docs/confidential/OPERATOR.md', label: 'OPERATOR.md (confidential spec)', public: false },
  dashboard: { file: 'operator/source/index.html', label: 'operator/source/index.html (custody source)', public: false, sourceProtected: true },
};

router.get('/list', (req, res) => {
  res.json({
    docs: Object.entries(DOCS).map(([id, d]) => ({
      id,
      label: d.label,
      filename: d.file,
      public: d.public,
      consentLocked: !!d.consentLocked,
      sourceProtected: !!d.sourceProtected,
    })),
  });
});

router.post('/acknowledgement', requireOperatorGate, requireOperatorConsent, (req, res) => {
  const meta = DOCS.acknowledgement;
  const content = (req.body?.content || '').trim();
  if (!content || content.length < 80) {
    return res.status(400).json({ error: 'content_too_short', message: 'Acknowledgement body required.' });
  }
  if (!content.includes('Empress') || !content.includes('@Hope_ology')) {
    return res.status(400).json({
      error: 'attribution_required',
      message: 'Acknowledgement must retain Empress (@Hope_ology) attribution unless Empress explicitly consents otherwise.',
    });
  }
  const full = path.join(ROOT, meta.file);
  const stamp = new Date().toISOString();
  const body = content.endsWith('\n') ? content : content + '\n';
  fs.writeFileSync(full, body, 'utf8');
  try { fs.writeFileSync(path.join(ROOT, 'ACKNOWLEDGEMENT.md'), body, 'utf8'); } catch (_) {}
  const logLine = `[${stamp}] acknowledgement altered — operator consent verified\n`;
  fs.appendFileSync(path.join(ROOT, 'acknowledgement.log'), logLine);
  res.json({ ok: true, id: 'acknowledgement', bytes: body.length, alteredAt: stamp });
});

router.get('/:id', (req, res, next) => {
  const id = req.params.id.replace(/\.(md|html|txt)$/i, '');
  const meta = DOCS[id];
  if (!meta) {
    return res.status(404).json({ error: 'unknown_doc', id });
  }
  if (!meta.public || meta.sourceProtected) {
    return requireOperatorGate(req, res, () => serveDoc(req, res, id, meta));
  }
  return serveDoc(req, res, id, meta);
});

function serveDoc(req, res, id, meta) {
  const full = path.join(ROOT, meta.file);
  if (!fs.existsSync(full)) {
    return res.status(404).json({ error: 'file_missing', file: meta.file });
  }
  const body = fs.readFileSync(full, 'utf8');
  const download = req.query.download === '1' || req.query.raw === '1';
  const mime = meta.file.endsWith('.html') ? 'text/html' : meta.file.endsWith('LICENSE') ? 'text/plain' : 'text/markdown';
  if (download) {
    res.setHeader('Content-Type', mime + '; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.file}"`);
    return res.send(body);
  }
  res.json({
    id,
    label: meta.label,
    filename: meta.file,
    public: meta.public,
    consentLocked: !!meta.consentLocked,
    content: body,
    bytes: body.length,
  });
}

module.exports = router;