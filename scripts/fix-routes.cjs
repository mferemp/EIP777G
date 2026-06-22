const fs = require('fs');
const p = '.vercel/output/config.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

// Add /js/genesis-verification.js exclusion if missing
if (!data.routes.some(r => r.src === '^/js/genesis-verification\\.js$')) {
  const insertBefore = data.routes.findIndex(r => r.src === '^/genesis-verification\\.js$');
  const rule = { src: '^/js/genesis-verification\\.js$', status: 404, dest: '/404.html' };
  if (insertBefore >= 0) data.routes.splice(insertBefore, 0, rule);
  else data.routes.push(rule);
}

// Add headers route if missing
if (!data.routes.some(r => r.headers)) {
  const insertBefore = data.routes.findIndex(r => r.handle === 'filesystem');
  if (insertBefore >= 0) {
    data.routes.splice(insertBefore, 0, {
      src: '^(?:/(.*))$',
      headers: {
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store'
      },
      continue: false
    });
  }
}

fs.writeFileSync(p, JSON.stringify(data, null, 2));
console.log('patched config.json: added /js/genesis-verification.js rule and headers');
