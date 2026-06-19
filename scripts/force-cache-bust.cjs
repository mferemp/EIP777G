#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

function sh(cmd) {
  return cp.execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

function write(p, s) {
  fs.writeFileSync(path.join(ROOT, p), s);
}

function upsertJsonFile(p, fn) {
  const full = path.join(ROOT, p);
  const obj = JSON.parse(fs.readFileSync(full, 'utf8'));
  fn(obj);
  fs.writeFileSync(full, JSON.stringify(obj, null, 2) + '\n');
}

function upsertHeader(headers, key, value) {
  const found = headers.find(h => h.key.toLowerCase() === key.toLowerCase());
  if (found) found.value = value;
  else headers.push({ key, value });
}

function patchHtml(file, buildId, appFile) {
  if (!exists(file)) return;

  let html = read(file);

  // Remove old build meta if present.
  html = html.replace(/\n?\s*<meta name="securegate-build" content="[^"]*">\s*/g, '\n');

  // Add fresh build marker.
  html = html.replace(
    /<head>/i,
    `<head>\n<meta name="securegate-build" content="${buildId}">`
  );

  // Remove externally blocked font import if it somehow exists.
  html = html.replace(/\n?\s*@import url\('https:\/\/api\.fontshare\.com\/[^']+'\);\s*/g, '\n');

  // Replace CDN scripts if root index still has them.
  html = html.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/ethers@6\/dist\/ethers\.min\.js"><\/script>/g,
    '<script src="vendor/ethers.min.js"></script>'
  );

  html = html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js"><\/script>/g,
    '<script src="vendor/qrcode.min.js"></script>'
  );

  // Replace any app.js/app.<id>.js reference with this unique cache-busted file.
  const appScriptRe = /<script\s+src=["']js\/app(?:\.[a-zA-Z0-9_-]+)?\.js["']><\/script>/;

  if (appScriptRe.test(html)) {
    html = html.replace(appScriptRe, `<script src="js/${appFile}"></script>`);
  } else {
    html = html.replace(/<\/body>/i, `  <script src="js/${appFile}"></script>\n</body>`);
  }

  write(file, html);
}

function patchVercelHeaders() {
  if (!exists('vercel.json')) return;

  const strictCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests";

  upsertJsonFile('vercel.json', v => {
    v.headers = Array.isArray(v.headers) ? v.headers : [];

    let global = v.headers.find(h => h.source === '/(.*)');
    if (!global) {
      global = { source: '/(.*)', headers: [] };
      v.headers.push(global);
    }

    global.headers = Array.isArray(global.headers) ? global.headers : [];

    upsertHeader(global.headers, 'Content-Security-Policy', strictCsp);
    upsertHeader(global.headers, 'Cache-Control', 'no-store, max-age=0, must-revalidate');
    upsertHeader(global.headers, 'CDN-Cache-Control', 'no-store');
    upsertHeader(global.headers, 'Vercel-CDN-Cache-Control', 'no-store');
    upsertHeader(global.headers, 'X-Frame-Options', 'DENY');
    upsertHeader(global.headers, 'X-Content-Type-Options', 'nosniff');
    upsertHeader(global.headers, 'Referrer-Policy', 'no-referrer');
    upsertHeader(global.headers, 'Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');

    delete v.routes;
    v.outputDirectory = 'live';
  });
}

function patchPackageScripts() {
  upsertJsonFile('package.json', p => {
    p.scripts = p.scripts || {};
    p.scripts.check = 'node --check live/js/app.js && node --check live/js/gate.js && node --check api/relay.js && node --check api/bypass-verify.js';
    p.scripts.test = p.scripts.test || 'npm run check';
    p.scripts.obfuscate = 'node scripts/obfuscate.js';
    p.scripts['vercel-build'] = 'npm run obfuscate';
    p.scripts['final-check'] = 'node scripts/final-check.cjs';
    p.scripts['live-stale-check'] = 'node scripts/live-stale-check.cjs';
  });
}

function main() {
  const sha = sh('git rev-parse --short=12 HEAD');
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const buildId = `${sha}-${stamp}`;

  if (!exists('live/js/app.js')) {
    throw new Error('Missing live/js/app.js');
  }

  fs.mkdirSync(path.join(ROOT, 'live/js'), { recursive: true });

  const appFile = `app.${buildId}.js`;
  fs.copyFileSync(path.join(ROOT, 'live/js/app.js'), path.join(ROOT, 'live/js', appFile));

  patchHtml('live/index.html', buildId, appFile);
  patchHtml('index.html', buildId, appFile);

  fs.mkdirSync(path.join(ROOT, 'live'), { recursive: true });

  write('live/build.json', JSON.stringify({
    buildId,
    commit: sha,
    appFile,
    builtAt: new Date().toISOString(),
    note: 'cache-busted production deployment marker'
  }, null, 2) + '\n');

  patchVercelHeaders();
  patchPackageScripts();

  // Remove stale deploy-output/cache if present, but keep Vercel project link.
  if (exists('.vercel/output')) {
    fs.rmSync(path.join(ROOT, '.vercel/output'), { recursive: true, force: true });
  }

  console.log('cache-bust build marker created');
  console.log('buildId:', buildId);
  console.log('appFile:', appFile);
}

main();
