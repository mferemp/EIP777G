#!/usr/bin/env node
/**
 * SecureGate v1 — numerical dashboard links (no ngrok)
 * PUBLIC: http://IP:3001/  |  ADMIN: http://IP:3001/admin
 * Owner: Empress (@Hope_ology)
 */

const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const HTTP_PORT = Number(process.env.BACKEND_PORT || 3001);

function lanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(nets)) {
    for (const cfg of iface || []) {
      if (cfg.family === 'IPv4' && !cfg.internal) ips.push(cfg.address);
    }
  }
  return ips;
}

function ipToSslip(ip) {
  return ip.replace(/\./g, '-');
}

async function fetchPublicIp() {
  const fromEnv = String(process.env.PUBLIC_IP || '').trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(fromEnv)) return fromEnv;
  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(6000) });
    const j = await res.json();
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(j.ip) ? j.ip : null;
  } catch {
    return null;
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function waitForHealth(port, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() < deadline) setTimeout(tick, 400);
        else reject(new Error(`health check HTTP ${res.statusCode}`));
      });
      req.on('error', () => {
        if (Date.now() < deadline) setTimeout(tick, 400);
        else reject(new Error(`server not listening on port ${port}`));
      });
      req.setTimeout(3000, () => {
        req.destroy();
        if (Date.now() < deadline) setTimeout(tick, 400);
        else reject(new Error('health check timeout'));
      });
    };
    tick();
  });
}

async function checkPublicPort(ip, port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${ip}:${port}/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
  });
}

function printLinks({ lan, publicIp, portOpen }) {
  console.log('');
  console.log('  ═══════════════════════════════════════════════════════════════');
  console.log('  SECUREGATE v1 — NUMERICAL LINKS (ngrok off)');
  console.log('  ═══════════════════════════════════════════════════════════════');

  if (lan.length) {
    console.log('');
    console.log('  SAME Wi‑Fi:');
    console.log(`    PUBLIC:  http://${lan[0]}:${HTTP_PORT}/`);
    console.log(`    ADMIN:   http://${lan[0]}:${HTTP_PORT}/admin`);
  }

  if (publicIp && portOpen) {
    console.log('');
    console.log('  INTERNET (port forward active):');
    console.log(`    PUBLIC:  http://${publicIp}:${HTTP_PORT}/`);
    console.log(`    ADMIN:   http://${publicIp}:${HTTP_PORT}/admin`);
    console.log(`    PUBLIC:  http://${ipToSslip(publicIp)}.sslip.io:${HTTP_PORT}/`);
  } else if (publicIp) {
    console.log('');
    console.log(`  INTERNET: http://${publicIp}:${HTTP_PORT}/ — needs router port-forward ${HTTP_PORT}`);
  }

  console.log('');
  console.log('  THIS PC:');
  console.log(`    PUBLIC:  http://127.0.0.1:${HTTP_PORT}/`);
  console.log(`    ADMIN:   http://127.0.0.1:${HTTP_PORT}/admin`);
  console.log('');
  console.log('  Keep this terminal open.');
  console.log('');
}

async function main() {
  const publicIp = await fetchPublicIp();
  await run('node', ['scripts/build-live.js'], { cwd: ROOT });

  const server = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ENABLE_HTTPS: 'false', BACKEND_PORT: String(HTTP_PORT) },
  });

  const shutdown = () => {
    if (server && !server.killed) server.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await waitForHealth(HTTP_PORT);
  printLinks({
    lan: lanIps(),
    publicIp,
    portOpen: publicIp ? await checkPublicPort(publicIp, HTTP_PORT) : false,
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});