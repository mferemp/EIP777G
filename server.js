import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// The v0 preview harness waits for the dev server on port 8080. Honor an
// injected PORT if present, otherwise default to 8080 (NOT 3000) so the
// preview can detect the server and stop timing out.
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'live')));

// API routes
import('./api/relay.js').then(module => {
  app.use('/api/relay', module.default);
}).catch(err => console.log('[server] relay import optional:', err.message));

import('./api/bypass-verify.js').then(module => {
  app.use('/api/bypass-verify', module.default);
}).catch(err => console.log('[server] bypass-verify import optional:', err.message));

import('./api/generate-user-key.js').then(module => {
  app.use('/api/generate-user-key', module.default);
}).catch(err => console.log('[server] generate-user-key import optional:', err.message));

// Serve live/index.html as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'live', 'index.html'));
});

// 404 for sensitive files (prevent information disclosure)
const sensitivePatterns = [
  /^\/contracts\//,
  /^\/private-artifacts\//,
  /EIP777G\.json/,
  /\.sol$/,
  /\.env/
];

app.use((req, res, next) => {
  if (sensitivePatterns.some(pattern => pattern.test(req.path))) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`[SecureGate] Dashboard live at http://localhost:${PORT}`);
  console.log(`[SecureGate] Auth-Gate locked, waiting for verification`);
  console.log(`[SecureGate] Press Ctrl+C to stop`);
});

// Surface bind failures (e.g. EADDRINUSE) instead of exiting silently, which
// would otherwise read as "process exited before port became available".
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[SecureGate] Port ${PORT} is already in use. Is another dev server running?`);
  } else {
    console.error('[SecureGate] Server error:', err);
  }
  process.exit(1);
});
