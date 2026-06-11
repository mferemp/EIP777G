#!/usr/bin/env node
/**
 * Generate local self-signed TLS cert for numerical HTTPS (IP:PORT).
 * Crypto users verify the IP you sent — not a random tunnel hostname.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CERT_DIR = path.join(ROOT, 'certs');
const KEY = path.join(CERT_DIR, 'securegate.key');
const CRT = path.join(CERT_DIR, 'securegate.crt');
const META = path.join(CERT_DIR, 'san-ips.json');

function lanIps() {
  const ips = ['127.0.0.1'];
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const cfg of iface || []) {
      if (cfg.family === 'IPv4' && !cfg.internal && !ips.includes(cfg.address)) {
        ips.push(cfg.address);
      }
    }
  }
  const pub = String(process.env.PUBLIC_IP || '').trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(pub) && !ips.includes(pub)) ips.push(pub);
  return ips;
}

function needsRegen(ips) {
  if (!fs.existsSync(KEY) || !fs.existsSync(CRT)) return true;
  try {
    const prev = JSON.parse(fs.readFileSync(META, 'utf8'));
    const a = [...ips].sort().join(',');
    const b = [...(prev.ips || [])].sort().join(',');
    return a !== b;
  } catch {
    return true;
  }
}

function ensureTlsCert(extraIps = []) {
  const ips = [...new Set([...lanIps(), ...extraIps.filter((x) => /^\d{1,3}(\.\d{1,3}){3}$/.test(x))])];
  if (!needsRegen(ips)) return { key: KEY, cert: CRT, ips };

  fs.mkdirSync(CERT_DIR, { recursive: true });
  const san = ips.map((ip) => `IP:${ip}`).join(',');
  const openssl = process.env.OPENSSL_BIN || 'openssl';

  execFileSync(openssl, [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', KEY, '-out', CRT,
    '-days', '3650', '-nodes',
    '-subj', '/CN=SecureGate-EIP777G/O=Empress/C=US',
    '-addext', `subjectAltName=${san}`,
  ], { stdio: 'pipe' });

  fs.writeFileSync(META, JSON.stringify({ ips, generated: new Date().toISOString() }, null, 2));
  return { key: KEY, cert: CRT, ips };
}

if (require.main === module) {
  const r = ensureTlsCert();
  console.log(`TLS cert ready → ${r.cert} (SAN: ${r.ips.join(', ')})`);
}

module.exports = { ensureTlsCert, CERT_DIR, KEY, CRT };