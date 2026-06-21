// SecureGate v1 — Backend API
// npm install express cors ethers
// node server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const app = express();
const PORT = 3001;

const REGISTRY   = '0x56310d7e48d9249df358ab9daa6a2dad0e03e242';
const K1         = '0x01152d5c7467204bFa015061097b193CbceA8ca9';
const K2         = '0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553';
const K3         = '0xA0eb06a5fab172860837C4D68e75F339896500b5';
const VEIL_HASH  = ethers.keccak256(ethers.toUtf8Bytes('Hopeology' + 'sgv1'));
const COHERENCE  = 'EmpressGate';
const RPC_URL    = 'https://eth.llamarpc.com';

const provider = new ethers.JsonRpcProvider(RPC_URL);

// In-memory stores
const opQueue    = [];
const auditLog   = [];

app.use(cors());
app.use(express.json());

// Serve public dashboard at /
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public-dashboard.html')));

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────
function requireProof(req, res, next) {
  const proof = req.headers['x-operator-proof'];
  if (!proof || proof !== VEIL_HASH) {
    return res.status(401).json({ error: 'Invalid operator proof' });
  }
  next();
}

function requireAdminProof(req, res, next) {
  const proof = req.headers['x-operator-proof'];
  const epoch = req.headers['x-coherence-epoch'];
  if (!proof || proof !== VEIL_HASH || epoch !== 'Hopeology') {
    return res.status(401).json({ error: 'Admin auth failed' });
  }
  next();
}

function logAudit(action, detail, req) {
  auditLog.unshift({ ts: Math.floor(Date.now()/1000), action, detail, ip: req?.ip });
  if (auditLog.length > 200) auditLog.pop();
}

// ── PUBLIC ROUTES ─────────────────────────────────────────────────
app.get('/api/registry-state', requireProof, async (req, res) => {
  try {
    const block = await provider.getBlock('latest');
    res.json({
      registry: REGISTRY, k1: K1, k2: K2, k3: K3,
      authWindow: '3600s',
      minDelay: '86400s',
      blockNumber: block.number,
      blockTime: new Date(block.timestamp * 1000).toISOString()
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/relays', requireProof, async (req, res) => {
  // Real relay check: ping RPC and known endpoints
  const relays = [
    { name: 'LlamaRPC',   url: 'https://eth.llamarpc.com' },
    { name: 'Cloudflare', url: 'https://cloudflare-eth.com' },
    { name: 'Ankr',       url: 'https://rpc.ankr.com/eth' },
    { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
  ];
  const results = await Promise.all(relays.map(async r => {
    const start = Date.now();
    try {
      const rp = new ethers.JsonRpcProvider(r.url);
      await rp.getBlockNumber();
      return { name: r.name, status: 'ok', latency: Date.now() - start };
    } catch { return { name: r.name, status: 'fail', latency: null }; }
  }));
  res.json({ relays: results });
});

app.get('/api/share-url', requireProof, (req, res) => {
  // Returns local URL; replace with tunnel URL if npm run share is active
  const tunnel = process.env.SHARE_URL || `http://localhost:${PORT}/`;
  res.json({ url: tunnel });
});

app.post('/api/export-source', requireProof, (req, res) => {
  logAudit('EXPORT_SOURCE', 'Public source bundle requested', req);
  res.json({
    version: 'SecureGate v1',
    registry: REGISTRY, k1: K1, k2: K2, k3: K3,
    epoch: 'Hopeology',
    exportedAt: new Date().toISOString(),
    note: 'Public telemetry bundle only — no admin keys exported'
  });
});

// ── ADMIN ROUTES (/admin/*) ───────────────────────────────────────
const admin = express.Router();
admin.use(requireAdminProof);

admin.get('/queue', (req, res) => {
  res.json({ operations: opQueue });
});

admin.post('/queue', (req, res) => {
  const { target, value, data, salt } = req.body;
  if (!target || !ethers.isAddress(target)) return res.status(400).json({ error: 'Invalid target address' });
  const op = {
    id: salt || crypto.randomBytes(16).toString('hex'),
    target, value: value||'0', data: data||'0x', salt,
    status: 'queued',
    timestamp: Math.floor(Date.now()/1000)
  };
  opQueue.unshift(op);
  logAudit('QUEUE', `Queued op ${op.id} → ${target}`, req);
  res.json({ success: true, operationId: op.id, message: 'Operation queued to timelock.' });
});

admin.post('/authorize', (req, res) => {
  const { salt } = req.body;
  const op = opQueue.find(o => o.id === salt || o.salt === salt);
  if (!op) return res.status(404).json({ error: 'Operation not found in queue' });
  if (op.status !== 'queued') return res.status(400).json({ error: `Cannot authorize — status: ${op.status}` });
  op.status = 'authorized';
  logAudit('AUTHORIZE', `Authorized op ${op.id}`, req);
  res.json({ success: true, operationId: op.id, status: 'authorized' });
});

admin.post('/execute', (req, res) => {
  const { salt } = req.body;
  const op = opQueue.find(o => o.id === salt || o.salt === salt);
  if (!op) return res.status(404).json({ error: 'Operation not found' });
  if (op.status !== 'authorized') return res.status(400).json({ error: `Cannot execute — status: ${op.status}` });
  op.status = 'executed';
  op.executedAt = Math.floor(Date.now()/1000);
  logAudit('EXECUTE', `Executed op ${op.id} → ${op.target}`, req);
  res.json({ success: true, operationId: op.id, status: 'executed', executedAt: op.executedAt });
});

admin.post('/sever', (req, res) => {
  const { confirm, coherence } = req.body;
  if (confirm !== 'SEVER') return res.status(400).json({ error: 'Confirm text must be SEVER' });
  if (coherence !== COHERENCE) return res.status(403).json({ error: 'Coherence mismatch' });
  logAudit('SEVER', `K1 ingress sever executed — K1=${K1}`, req);
  // In production: call contract to revoke K1
  res.json({
    success: true,
    message: 'SEVER executed. K1 ingress path severed.',
    k1: K1,
    severedAt: new Date().toISOString()
  });
});

admin.get('/relays', async (req, res) => {
  const relays = [
    { name: 'LlamaRPC',   url: 'https://eth.llamarpc.com' },
    { name: 'Cloudflare', url: 'https://cloudflare-eth.com' },
    { name: 'Ankr',       url: 'https://rpc.ankr.com/eth' },
    { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
  ];
  const results = await Promise.all(relays.map(async r => {
    const start = Date.now();
    try {
      const rp = new ethers.JsonRpcProvider(r.url);
      await rp.getBlockNumber();
      return { name: r.name, status: 'ok', latency: Date.now() - start };
    } catch { return { name: r.name, status: 'fail', latency: null }; }
  }));
  logAudit('RELAY_POLL', 'Admin relay mesh polled', req);
  res.json({ relays: results });
});

admin.get('/audit-log', (req, res) => {
  res.json({ entries: auditLog });
});

app.use('/admin', admin);
// Also serve admin dashboard at /admin route
app.get('/admin', requireAdminProof, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`SecureGate v1 backend running on http://localhost:${PORT}`);
  console.log(`  Public:  http://localhost:${PORT}/`);
  console.log(`  Admin:   http://localhost:${PORT}/admin`);
});