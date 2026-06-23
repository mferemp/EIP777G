#!/usr/bin/env node

const fs = require('fs');

const FILE = 'index.html';
let html = fs.readFileSync(FILE, 'utf8');

function die(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function getAttr(openTag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i');
  const m = openTag.match(re);
  return m ? m[2] : '';
}

function hasClass(openTag, cls) {
  const c = getAttr(openTag, 'class');
  return c.split(/\s+/).includes(cls);
}

function hasId(openTag, id) {
  return getAttr(openTag, 'id') === id;
}

function findMatchingDiv(s, start) {
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;

  while ((m = re.exec(s))) {
    if (/^<\/div/i.test(m[0])) depth--;
    else depth++;

    if (depth === 0) return re.lastIndex;
  }

  die(`unclosed <div> at ${start}`);
}

function findDiv(pred, from = 0, until = Infinity) {
  const re = /<div\b[^>]*>/gi;
  re.lastIndex = from;
  let m;

  while ((m = re.exec(html))) {
    if (m.index >= until) return null;

    if (pred(m[0])) {
      return {
        start: m.index,
        open: m[0],
        openEnd: re.lastIndex,
        end: findMatchingDiv(html, m.index),
      };
    }
  }

  return null;
}

function findDivByClass(cls, from = 0, until = Infinity) {
  return findDiv((open) => hasClass(open, cls), from, until);
}

function findDivById(id, from = 0, until = Infinity) {
  return findDiv((open) => hasId(open, id), from, until);
}

function removeBlock(block) {
  const out = html.slice(block.start, block.end);
  html = html.slice(0, block.start) + html.slice(block.end);
  return out.trim();
}

function removeAllByClass(cls) {
  let count = 0;
  let first = null;

  while (true) {
    const b = findDivByClass(cls);
    if (!b) break;
    const removed = removeBlock(b);
    if (!first) first = removed;
    count++;
  }

  return { count, first };
}

function removeAllById(id) {
  let count = 0;
  let first = null;

  while (true) {
    const b = findDivById(id);
    if (!b) break;
    const removed = removeBlock(b);
    if (!first) first = removed;
    count++;
  }

  return { count, first };
}

function insertAt(pos, text) {
  html = html.slice(0, pos) + text + html.slice(pos);
}

function countDivsWithClass(cls) {
  const re = /<div\b[^>]*class=(['"])(.*?)\1[^>]*>/gi;
  let n = 0;
  let m;

  while ((m = re.exec(html))) {
    if (m[2].split(/\s+/).includes(cls)) n++;
  }

  return n;
}

const AUTH_BLOCK = `
      <div class="sidebar-section auth-mechanism-block">
        <div class="sidebar-section-title">Authentication Mechanism</div>
        <div class="sidebar-body">
          Enter Genesis K1 public address.<br>
          Run <strong>SCAN</strong> or <strong>LINK DEVICE</strong>. Keys stay local. Session-bound until SCRUB.
        </div>
      </div>`;

const SCAN_STATUS = `
          <div class="verify-link-copy scan-sublabel" id="scan-status">
            Genesis ownership scan<br>
            initiates authentication
          </div>`;

const CENTER_STANDALONE = `
    <div class="center-notice-box standalone-operation-box">
      <div class="center-notice-title">STANDALONE OPERATION</div>
      <div class="center-notice-body">
        This dashboard executes the authentication flow client-side. You are not submitting K1 authentication data to any operator, server, or third party. Cryptographic checks run in your browser. Chain reads use the server-supplied RPC configuration. RPC is not part of the auth gate.
      </div>
    </div>`;

const CENTER_ACK = `
    <div class="center-notice-box securegate-ack-box">
      <div class="center-notice-body">
        BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE.
        PLUS, YOU ARE CONSENTING TO NOT BLAME ME FOR ANYTHING. NFA. I'M JUST A STICK FIGURE.
      </div>
    </div>`;

const VERSION_BADGE = `
      <div class="sidebar-version-badge">
        <span class="status-dot dot-secure"></span>
        <span id="status-text">777G v1.0 · SECURE</span>
      </div>`;

const SESSION_FALLBACK = `
      <div class="session-termination-block">
        <div class="sidebar-section-title">Session Termination</div>
        <div class="sidebar-body">
          The <span class="mag">SCRUB</span> button terminates the authenticated link and <strong>immediately deletes</strong> all verification data from memory.<br><br>
          On session end — by SCRUB, ESC, idle timeout (5 min), or tab close — <strong>all operator input is purged</strong>. No keys, addresses, or credentials are ever stored, logged, or transmitted to any server.
        </div>
      </div>`;

// -----------------------------------------------------------------------------
// 1. Remove unstable/duplicated layout blocks.
// -----------------------------------------------------------------------------

removeAllByClass('auth-mechanism-block');

const sessionRemoved = removeAllByClass('session-termination-block');
const sessionBlock = sessionRemoved.first || SESSION_FALLBACK;

removeAllById('scan-status');

removeAllByClass('standalone-operation-box');
removeAllByClass('securegate-ack-box');

removeAllByClass('sidebar-version-badge');

// Remove any lingering status badge from statusbar or bad parent.
while (html.includes('id="status-text"')) {
  const idx = html.indexOf('id="status-text"');
  const start = html.lastIndexOf('<div', idx);
  if (start === -1) die('status-text exists but parent div not found');
  const end = findMatchingDiv(html, start);
  html = html.slice(0, start) + html.slice(end);
}

// -----------------------------------------------------------------------------
// 2. Rebuild the sidebar order.
// -----------------------------------------------------------------------------

let scanWrap = findDivByClass('scan-wrap');
if (!scanWrap) die('missing .scan-wrap');

insertAt(scanWrap.end, '\n' + AUTH_BLOCK + '\n');

let k1Panel =
  findDivById('genesis-k1-verify-panel') ||
  findDivByClass('genesis-k1-verify-panel');

if (!k1Panel) die('missing #genesis-k1-verify-panel');

let verifyActions = findDivByClass('verify-actions', k1Panel.start, k1Panel.end);
if (!verifyActions) die('missing .verify-actions inside K1 panel');

insertAt(verifyActions.end, SCAN_STATUS + '\n');

// Re-find after insertion.
k1Panel =
  findDivById('genesis-k1-verify-panel') ||
  findDivByClass('genesis-k1-verify-panel');

insertAt(k1Panel.end, '\n' + sessionBlock + '\n');

// Add version badge as final sidebar child.
let sidebar = findDivByClass('sidebar');
if (!sidebar) die('missing .sidebar');

const sidebarClose = html.lastIndexOf('</div>', sidebar.end - 1);
if (sidebarClose < sidebar.start) die('could not find closing </div> for sidebar');

insertAt(sidebarClose, '\n' + VERSION_BADGE + '\n');

// -----------------------------------------------------------------------------
// 3. Rebuild center notices and lock-overlay placement.
// -----------------------------------------------------------------------------

let mainPanel = findDivByClass('main-panel');
if (!mainPanel) die('missing .main-panel');

// Remove orphan lock overlay comment immediately before the old lock div.
html = html.replace(/\n\s*<!-- LOCK OVERLAY -->\s*(?=<div\b[^>]*id=["']lock-overlay["'])/i, '\n');

const lock = findDivById('lock-overlay');
if (!lock) die('missing #lock-overlay');

const lockBlock = removeBlock(lock);

mainPanel = findDivByClass('main-panel');
insertAt(mainPanel.openEnd, '\n' + CENTER_STANDALONE + '\n' + CENTER_ACK + '\n');

let dashboard = findDivById('dashboard');
if (!dashboard) die('missing #dashboard');

insertAt(dashboard.openEnd, '\n\n    <!-- LOCK OVERLAY -->\n' + lockBlock + '\n');

// -----------------------------------------------------------------------------
// 4. Patch checkAuthState so dashboard is never hidden.
// -----------------------------------------------------------------------------

const checkAuth = `function checkAuthState() {
    const authPassed = sessionStorage.getItem('sg_auth_passed') === '1';
    const lock = document.getElementById('lock-overlay');
    if (!lock) return;
    if (authPassed) {
      lock.classList.add('unlocked');
      if (typeof validateDeployBtn === 'function') validateDeployBtn();
    } else {
      lock.classList.remove('unlocked');
    }
  }`;

if (!/function\s+checkAuthState\s*\(\)/.test(html)) {
  die('missing checkAuthState()');
}

html = html.replace(
  /function\s+checkAuthState\s*\(\)\s*\{[\s\S]*?\n\s*\}/,
  checkAuth
);

// Remove accidental dashboard hidden class.
html = html.replace(
  /class=(["'])([^"']*\bdashboard\b[^"']*)\bhidden\b([^"']*)\1/gi,
  (_, q, a, b) => `class=${q}${(a + b).replace(/\s+/g, ' ').trim()}${q}`
);

// -----------------------------------------------------------------------------
// 5. Add final CSS safety block.
// -----------------------------------------------------------------------------

html = html.replace(
  /\s*\/\* === SECUREGATE UI REPAIR START === \*\/[\s\S]*?\/\* === SECUREGATE UI REPAIR END === \*\/\s*/g,
  '\n'
);

const repairCss = `
  /* === SECUREGATE UI REPAIR START === */
  .sidebar {
    display: flex !important;
    flex-direction: column !important;
  }

  .sidebar .scan-wrap {
    order: 1 !important;
  }

  .sidebar .auth-mechanism-block {
    order: 2 !important;
  }

  .sidebar #genesis-k1-verify-panel,
  .sidebar .genesis-k1-verify-panel {
    order: 3 !important;
  }

  .sidebar .session-termination-block {
    order: 4 !important;
  }

  .sidebar .caution-block {
    order: 998 !important;
  }

  .sidebar .sidebar-version-badge {
    order: 999 !important;
    margin-top: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
    color: var(--faint) !important;
    font-size: 8px !important;
    letter-spacing: 0.12em !important;
    line-height: 1 !important;
    padding-top: 8px !important;
    padding-bottom: 4px !important;
    text-align: center !important;
    white-space: nowrap !important;
  }

  .dashboard {
    position: relative !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
  }

  .center-notice-box {
    position: relative !important;
    z-index: 10 !important;
    pointer-events: auto !important;
  }

  .verify-link-copy#scan-status {
    margin-top: 7px !important;
    color: var(--teal) !important;
    font-size: 9.5px !important;
    font-weight: 800 !important;
    letter-spacing: 0.08em !important;
    line-height: 1.35 !important;
    text-transform: uppercase !important;
    text-align: center !important;
  }

  .sidebar .standalone-operation-box {
    order: unset !important;
  }
  /* === SECUREGATE UI REPAIR END === */
`;

if (!html.includes('</style>')) die('missing </style>');
html = html.replace('</style>', repairCss + '\n</style>');

// -----------------------------------------------------------------------------
// 6. Verification before write.
// -----------------------------------------------------------------------------

function indexOfNeedle(needle) {
  const i = html.indexOf(needle);
  if (i === -1) die(`missing ${needle}`);
  return i;
}

const mainI = indexOfNeedle('<div class="main-panel">');
const standI = indexOfNeedle('class="center-notice-box standalone-operation-box"');
const ackI = indexOfNeedle('class="center-notice-box securegate-ack-box"');
const dashI = indexOfNeedle('id="dashboard"');
const lockI = indexOfNeedle('id="lock-overlay"');
const sidebarI = indexOfNeedle('class="sidebar');
const versionI = indexOfNeedle('id="status-text"');
const scanStatusI = indexOfNeedle('id="scan-status"');
const linkDeviceI = indexOfNeedle('id="verify-qr-btn"');
const verifyDirectionsI = indexOfNeedle('class="verify-directions');

if (!(mainI < standI && standI < ackI && ackI < dashI)) {
  die('center notices are not direct-before-dashboard order');
}

if (!(dashI < lockI)) {
  die('#lock-overlay is not inside/after #dashboard');
}

if (!(sidebarI < versionI && sidebarI < scanStatusI)) {
  die('sidebar badge or scan-status not after sidebar start');
}

if (!(linkDeviceI < scanStatusI && scanStatusI < verifyDirectionsI)) {
  die('#scan-status is not under LINK DEVICE and before verify-directions');
}

if (countDivsWithClass('standalone-operation-box') !== 1) {
  die('expected exactly one standalone-operation-box div');
}

if (countDivsWithClass('securegate-ack-box') !== 1) {
  die('expected exactly one securegate-ack-box div');
}

const scanStatusCount = (html.match(/id=["']scan-status["']/g) || []).length;
if (scanStatusCount !== 1) die(`expected one #scan-status, got ${scanStatusCount}`);

if (html.includes('The RPC endpoint you supply is your sole network contact')) {
  die('old bad RPC wording came back');
}

fs.writeFileSync(FILE, html);
console.log('OK: repaired index.html');
console.log('OK: center notices above dashboard');
console.log('OK: lock overlay inside dashboard');
console.log('OK: scan-status under LINK DEVICE');
console.log('OK: version badge at sidebar bottom');
