const fs = require('fs');
const p = '.vercel/output/config.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
const routes = data.routes || [];
if (!routes.some(r => r.src === '^/js/genesis-verification\\.js$')) {
  const insertBefore = routes.findIndex(r => r.src === '^/(.*)$' && r.dest === '/index.html');
  const rule = { src: '^/js/genesis-verification\\.js$', dest: '/404', continue: true };
  if (insertBefore >= 0) routes.splice(insertBefore, 0, rule);
  else routes.push(rule);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log('added /js/genesis-verification.js -> /404');
} else {
  console.log('/js/genesis-verification.js rule already present');
}
