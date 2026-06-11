#!/usr/bin/env node
/**
 * One-time setup for stable global friend link.
 * Owner: Empress (@Hope_ology)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env');
const NGROK = path.join(__dirname, 'bin', 'ngrok');

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function parseAuthtoken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('get-started/')) {
    const m = s.match(/get-started\/([A-Za-z0-9_]+)/);
    if (m) return m[1];
  }
  if (s.startsWith('http')) {
    const last = s.split('/').filter(Boolean).pop();
    if (last && last.length > 20) return last;
  }
  return s;
}

function parseDomain(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (s.includes('ngrok.com') || s.includes('/')) return '';
  if (!/^[a-z0-9-]+\.ngrok-free\.(dev|app)$/.test(s) && !/^[a-z0-9-]+\.ngrok\.app$/.test(s)) {
    return '';
  }
  return s;
}

async function main() {
  console.log('');
  console.log('  SecureGate — stable global friend link setup');
  console.log('  ─────────────────────────────────────────────');
  console.log('');
  console.log('  AUTHTOKEN — open this page, click Copy:');
  console.log('    https://dashboard.ngrok.com/get-started/your-authtoken');
  console.log('    (long string ~40+ chars — NOT "2", NOT a URL you type)');
  console.log('');
  console.log('  DOMAIN — open this page, copy the dev domain only:');
  console.log('    https://dashboard.ngrok.com/domains');
  console.log('    (example: hip-robin-123.ngrok-free.dev — no https://, no paths)');
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const tokenRaw = (await ask(rl, '  Paste authtoken (Copy from dashboard): ')).trim();
  const domainRaw = (await ask(rl, '  Paste dev domain (e.g. name.ngrok-free.dev): ')).trim();
  rl.close();

  const token = parseAuthtoken(tokenRaw);
  const domain = parseDomain(domainRaw);

  if (!token || token.length < 20) {
    console.log('');
    console.log('  ✗ Authtoken invalid — must be the long Copy string from ngrok dashboard.');
    console.log('    You pasted:', JSON.stringify(tokenRaw.slice(0, 40)));
    console.log('');
    return;
  }
  if (!domain) {
    console.log('');
    console.log('  ✗ Domain invalid — must be ONLY like: something.ngrok-free.dev');
    console.log('    From: https://dashboard.ngrok.com/domains');
    console.log('    You pasted:', JSON.stringify(domainRaw.slice(0, 60)));
    console.log('');
    return;
  }

  let env = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  const set = (key, val) => {
    const line = `${key}=${val}`;
    if (new RegExp(`^${key}=`, 'm').test(env)) {
      env = env.replace(new RegExp(`^${key}=.*$`, 'm'), line);
    } else {
      env += (env.endsWith('\n') || !env ? '' : '\n') + line + '\n';
    }
  };
  set('NGROK_AUTHTOKEN', token);
  set('NGROK_DOMAIN', domain);
  set('SHARE_TUNNEL', 'ngrok');
  fs.writeFileSync(ENV, env);

  if (fs.existsSync(NGROK)) {
    const { spawnSync } = require('child_process');
    spawnSync(NGROK, ['config', 'add-authtoken', token], { stdio: 'inherit' });
  }

  console.log('');
  console.log('  ✓ Saved. Friend link:');
  console.log(`    https://${domain}/`);
  console.log('  Run: npm run share');
  console.log('');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});