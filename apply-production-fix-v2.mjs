import fs from 'node:fs';

const strictCsp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests`;

const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => fs.writeFileSync(f, s);
const rm = f => fs.existsSync(f) && fs.rmSync(f, { recursive: true, force: true });

function hardenHtml(file) {
  if (!fs.existsSync(file)) return;
  let s = read(file);

  s = s.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/i, `<meta http-equiv="Content-Security-Policy" content="${strictCsp}">`);

  s = s.replace(/\n?\s*@import url\('https:\/\/api\.fontshare\.com\/[^']+'\);\s*/g, '\n');

  s = s.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/ethers@6\/dist\/ethers\.min\.js"><\/script>/g, '<script src="vendor/ethers.min.js"></script>');

  s = s.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js"><\/script>/g, '<script src="vendor/qrcode.min.js"></script>');

  write(file, s);
}

function hardenApp() {
  const file = 'live/js/app.js';
  let s = read(file);

  s = s.replace(`// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE\n// CLIENT-SIDE SIGNING ONLY — Private keys never leave the browser\n// Server receives only signed transactions (0x...)\n`, `// Client-side signing only.\n// Server receives only signed raw transactions (0x...).\n`);

  s = s.replaceAll(`fetch('/api/deploy/artifact.json')`, `fetch('/artifacts/artifact.json')`);

  s = s.replaceAll(`k3Addr || '0x0000000000000000000000000000000000000000'`, `k3Addr`);

  s = s.replace(/\n\s*localStorage\.removeItem\('sg_bypass_hash'\);/g, '');

  s = s.replace(/\n\s*let fiatStr = '';\n\s*try \{\n\s*const pr = await fetch\('https:\/\/api\.coingecko\.com\/api\/v3\/simple\/price\?ids=ethereum&vs_currencies=usd'\);\n\s*const pd = await pr\.json\(\);\n\s*fiatStr = ' \(~\$' \+ \(parseFloat\(totalEth\) \* pd\.ethereum\.usd\)\.toFixed\(2\) \+ ' USD\)';\n\s*\}\n\s*catch \(e\) \{ fiatStr = ''; \}/, `\n          const fiatStr = '';`);

  if (s.includes('https://api.etherscan.io/api')) {
    s = s.replace(/\n\s*const BASE = 'https:\/\/api\.etherscan\.io\/api';[\s\S]*?\n\s*\(r721\.result \|\| \[\]\)\.forEach\(log => \{\n\s*if \(log\.topics && log\.topics\[2\]\) addRow\(log\.address, '0x' \+ log\.topics\[2\]\.slice\(26\), 'ERC721'\);\n\s*\}\);\n/, '\n');

    s = s.replace(`if (revokeStatus) revokeStatus.textContent = 'Crawling Etherscan…';`, `if (revokeStatus) revokeStatus.textContent = 'Checking same-origin-safe revoke targets…';`);
  }

  if (!s.includes(`if (!isAddr(k1Addr)) throw new Error('K1 address required');`)) {
    s = s.replace(`  function buildDeployTx(chainId, k1Addr, k2Addr, k3Addr, deployerAddr) {\n    if (!ARTIFACT) throw new Error('Artifact not loaded');`, `  function buildDeployTx(chainId, k1Addr, k2Addr, k3Addr, deployerAddr) {\n    if (!ARTIFACT) throw new Error('Artifact not loaded');\n    if (!isAddr(k1Addr)) throw new Error('K1 address required');\n    if (!isAddr(k2Addr)) throw new Error('K2 address required');\n    if (!isAddr(k3Addr)) throw new Error('K3 drop address required');`);
  }

  write(file, s);
}

hardenApp();
hardenHtml('live/index.html');
hardenHtml('index.html');

rm('api/deploy');
rm('live/api');
rm('live/js/gate_test.js');
rm('live/js/gate.js.bak');
rm('live/js/genesis-verification.js');

const pkg = JSON.parse(read('package.json'));

pkg.scripts.check = 'node --check live/js/app.js && node --check live/js/gate.js && node --check api/relay.js && node --check api/bypass-verify.js';
pkg.scripts.obfuscate = 'node scripts/obfuscate.js';
pkg.scripts['vercel-build'] = 'npm run obfuscate';
pkg.scripts['final-check'] = 'node scripts/final-check.cjs';
pkg.scripts['live-check'] = 'node scripts/live-check.cjs';

write('package.json', JSON.stringify(pkg, null, 2) + '\n');

write('scripts/live-check.cjs', `#!/usr/bin/env node
const BASE = process.env.LIVE_URL || 'https://securegate-777g.vercel.app';

let failures = 0;
const fail = m => { failures++; console.error('FAIL:', m); };
const ok = m => console.log('ok:', m);

async function text(path) {
  const r = await fetch(BASE + path, { cache: 'no-store' });
  return { r, body: await r.text() };
}

async function head(path) {
  return fetch(BASE + path, { method: 'HEAD', cache: 'no-store' });
}

(async () => {
  const app = await text('/js/app.js?livecheck=' + Date.now());

  if (!app.r.ok || !/javascript/.test(app.r.headers.get('content-type') || '')) {
    fail('/js/app.js is not JS');
  } else {
    ok('/js/app.js is JS');
  }

  for (const p of [
    'deployerPrivateKey',
    'k1PrivateKey',
    '/api/deploy',
    'sg_bypass_hash',
    'api.etherscan.io',
    'api.coingecko.com',
    '0x0000000000000000000000000000000000000000'
  ]) {
    app.body.includes(p) ? fail('/js/app.js contains ' + p) : ok('/js/app.js no ' + p);
  }

  for (const path of [
    '/artifacts/EIP777G.json',
    '/EIP777G.json',
    '/abi.json',
    '/bytecode.txt',
    '/contracts/EIP777G.sol',
    '/contracts/AuroraGate.sol',
    '/uploads/',
    '/contracts/',
    '/js/app.js.map'
  ]) {
    const headR = await head(path);
    if (headR.ok) {
      fail(path + ' is still reachable');
    } else {
      ok(path + ' blocked');
    }
  }

  const relay = await fetch(BASE + '/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  const relayBody = await relay.text();
  relayBody.includes('Expected { chainId:int, signedTxs:[0x...] }') ? ok('/api/relay shape') : fail('/api/relay unexpected: ' + relayBody);

  const bypass = await fetch(BASE + '/api/bypass-verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  const bypassBody = await bypass.text();
  bypassBody.includes('Expected { k1Addr, token }') ? ok('/api/bypass-verify shape') : fail('/api/bypass-verify unexpected: ' + bypassBody);

  if (failures) process.exit(1);

  console.log('\nlive-check passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
`);

console.log('production fix v2 applied');
