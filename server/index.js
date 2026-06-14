// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE
// SecureGate v1 — unified backend + dashboard host
// Owner: Empress (@Hope_ology)
// Public recovery console: /
// Admin operator console:   /admin

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const ROOT = path.join(__dirname, '..');

function buildApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: false,
  }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));
  app.use(rateLimit({
    windowMs: 10 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.use('/api', require('../routes/index'));
  app.use('/relay', require('./relay'));

  const PUBLIC_DASHBOARD = path.join(ROOT, 'live', 'index.html');
  const ADMIN_DASHBOARD = path.join(ROOT, 'operator', 'source', 'index.html');

  const sendPublic = (req, res) => res.sendFile(PUBLIC_DASHBOARD);
  const sendAdmin = (req, res) => res.sendFile(ADMIN_DASHBOARD);

  app.get('/', sendPublic);
  app.get('/admin', sendAdmin);
  app.get('/admin/', sendAdmin);
  app.get('/admin/export', sendAdmin);
  app.get('/export', (req, res) => res.redirect('/admin/export'));

  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'securegate-777g',
      publicDashboard: '/',
      adminDashboard: '/admin',
      tls: Boolean(req.socket.encrypted),
    });
  });

  return app;
}

function lanIps() {
  const os = require('os');
  const nets = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(nets)) {
    for (const cfg of iface || []) {
      if (cfg.family === 'IPv4' && !cfg.internal) ips.push(cfg.address);
    }
  }
  return ips;
}

function printListenUrls({ httpPort, httpsPort, httpsOn }) {
  const ips = lanIps();
  console.log('');
  console.log('  SecureGate v1 — dashboards ready');
  console.log('  ─────────────────────────────────');
  console.log(`  PUBLIC (share):       http://127.0.0.1:${httpPort}/`);
  if (ips.length) {
    ips.forEach((ip) => {
      console.log(`  PUBLIC LAN (share):   http://${ip}:${httpPort}/`);
    });
  }
  console.log(`  ADMIN (you only):     http://127.0.0.1:${httpPort}/admin`);
  if (ips.length) {
    ips.forEach((ip) => {
      console.log(`  ADMIN LAN:            http://${ip}:${httpPort}/admin`);
    });
  }
  if (httpsOn) {
    console.log(`  (HTTPS :${httpsPort} is self-signed — use HTTP :${httpPort} for public share)`);
  }
  console.log(`  Share:                npm run share`);
  console.log('');
}

const app = buildApp();
const PORT = Number(process.env.BACKEND_PORT || 3001);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const HOST = process.env.BACKEND_HOST || '0.0.0.0';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS !== 'false';

http.createServer(app).listen(PORT, HOST);

let httpsOn = false;
if (ENABLE_HTTPS) {
  const { ensureTlsCert, KEY, CRT } = require('../scripts/ensure-tls-cert');
  ensureTlsCert();
  if (fs.existsSync(KEY) && fs.existsSync(CRT)) {
    const creds = {
      key: fs.readFileSync(KEY),
      cert: fs.readFileSync(CRT),
    };
    https.createServer(creds, app).listen(HTTPS_PORT, HOST);
    httpsOn = true;
  }
}

printListenUrls({ httpPort: PORT, httpsPort: HTTPS_PORT, httpsOn });