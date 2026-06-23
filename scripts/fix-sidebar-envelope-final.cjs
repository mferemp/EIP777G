#!/usr/bin/env node

const fs = require('fs');

const FILE = 'index.html';
let html = fs.readFileSync(FILE, 'utf8');

function stripOldBlock(start, end) {
  const re = new RegExp(
    `\\n?\\s*${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n?`,
    'g'
  );
  html = html.replace(re, '\n');
}

stripOldBlock('/* === SG FINAL SIDEBAR + ENVELOPE FIX START === */', '/* === SG FINAL SIDEBAR + ENVELOPE FIX END === */');
html = html.replace(/<script id="sg-final-sidebar-envelope-fix">[\s\S]*?<\/script>\s*/g, '');

const css = `
  /* === SG FINAL SIDEBAR + ENVELOPE FIX START === */

  /* Sidebar must remain a vertical ordered column */
  .sidebar {
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    height: calc(100vh - 48px) !important;
    max-height: calc(100vh - 48px) !important;
    padding-bottom: 42px !important;
  }

  .sidebar .scan-wrap {
    order: 1 !important;
    flex: 0 0 auto !important;
  }

  .sidebar .auth-mechanism-block {
    order: 2 !important;
    flex: 0 0 auto !important;
  }

  .sidebar #genesis-k1-verify-panel,
  .sidebar .genesis-k1-verify-panel {
    order: 3 !important;
    flex: 0 0 auto !important;
  }

  .sidebar .session-termination-block {
    order: 4 !important;
    flex: 0 0 auto !important;
  }

  .sidebar .standalone-operation-box {
    display: none !important;
  }

  .sidebar .caution-block {
    order: 998 !important;
    flex: 0 0 auto !important;
  }

  .sidebar .sidebar-version-badge {
    order: 999 !important;
    position: sticky !important;
    bottom: 0 !important;
    margin-top: 10px !important;
    padding: 8px 0 5px !important;
    background: linear-gradient(to top, #000 70%, rgba(0,0,0,0)) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
    color: var(--faint) !important;
    font-size: 8px !important;
    letter-spacing: 0.12em !important;
    line-height: 1 !important;
    text-align: center !important;
    white-space: nowrap !important;
    z-index: 999 !important;
  }

  #scan-status.verify-link-copy {
    display: block !important;
    margin-top: 9px !important;
    color: var(--teal) !important;
    font-size: 9.5px !important;
    font-weight: 800 !important;
    letter-spacing: 0.08em !important;
    line-height: 1.35 !important;
    text-transform: uppercase !important;
    text-align: center !important;
  }

  /* Envelope click repair */
  .sg-envelope-root {
    position: fixed !important;
    right: 18px !important;
    bottom: 14px !important;
    z-index: 2147483647 !important;
    pointer-events: auto !important;
    cursor: pointer !important;
  }

  .sg-envelope-root,
  .sg-envelope-root * {
    pointer-events: auto !important;
  }

  .sg-envelope-root .thank-you-popover {
    position: absolute !important;
    right: 0 !important;
    bottom: calc(100% + 12px) !important;
    min-width: 220px !important;
    max-width: 280px !important;
    padding: 12px 14px !important;
    border: 1px solid var(--teal) !important;
    background: rgba(0, 0, 0, 0.94) !important;
    color: var(--text) !important;
    font-size: 11px !important;
    line-height: 1.45 !important;
    text-align: center !important;
    box-shadow: 0 0 24px rgba(0, 229, 209, 0.35) !important;
    opacity: 0 !important;
    visibility: hidden !important;
    transform: translateY(8px) !important;
    transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease !important;
  }

  .sg-envelope-root.sg-envelope-open .thank-you-popover {
    opacity: 1 !important;
    visibility: visible !important;
    transform: translateY(0) !important;
  }

  /* === SG FINAL SIDEBAR + ENVELOPE FIX END === */
`;

if (!html.includes('</style>')) {
  throw new Error('No </style> found in index.html');
}
html = html.replace('</style>', css + '\n</style>');

const js = `
<script id="sg-final-sidebar-envelope-fix">
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function after(ref, node) {
    if (ref && node && ref.parentNode) ref.parentNode.insertBefore(node, ref.nextSibling);
  }

  function makeAuthBlock() {
    var d = document.createElement('div');
    d.className = 'sidebar-section auth-mechanism-block';
    d.innerHTML =
      '<div class="sidebar-section-title">Authentication Mechanism</div>' +
      '<div class="sidebar-body">' +
      'Enter Genesis K1 public address.<br>' +
      'Run <strong>SCAN</strong> or <strong>LINK DEVICE</strong>. Keys stay local. Session-bound until SCRUB.' +
      '</div>';
    return d;
  }

  function makeScanStatus() {
    var d = document.createElement('div');
    d.className = 'verify-link-copy scan-sublabel';
    d.id = 'scan-status';
    d.innerHTML = 'Genesis ownership scan<br>initiates authentication';
    return d;
  }

  function makeBadge() {
    var d = document.createElement('div');
    d.className = 'sidebar-version-badge';
    d.innerHTML =
      '<span class="status-dot dot-secure"></span>' +
      '<span id="status-text">777G v1.0 · SECURE</span>';
    return d;
  }

  function enforceSidebar() {
    var sidebar = qs('.sidebar');
    if (!sidebar) return;

    var scanWrap = qs('.scan-wrap', sidebar);
    var k1Panel = qs('#genesis-k1-verify-panel', sidebar) || qs('.genesis-k1-verify-panel', sidebar);
    var caution = qs('.caution-block', sidebar) || qs('.caution-block');
    var session = qs('.session-termination-block', sidebar) || qs('.session-termination-block');

    // Remove standalone from sidebar only. Center standalone remains untouched.
    qsa('.sidebar .standalone-operation-box').forEach(function (el) {
      el.remove();
    });

    // Auth block directly after scan.
    var auth = qs('.auth-mechanism-block', sidebar) || qs('.auth-mechanism-block') || makeAuthBlock();
    if (scanWrap) after(scanWrap, auth);
    else sidebar.insertBefore(auth, sidebar.firstChild);

    // K1 panel after auth.
    if (k1Panel) after(auth, k1Panel);

    // One scan-status only, under LINK DEVICE.
    qsa('#scan-status').forEach(function (el, i) {
      if (i > 0) el.remove();
    });

    var scanStatus = qs('#scan-status') || makeScanStatus();
    scanStatus.className = 'verify-link-copy scan-sublabel';
    scanStatus.id = 'scan-status';
    scanStatus.innerHTML = 'Genesis ownership scan<br>initiates authentication';

    if (k1Panel) {
      var actions =
        qs('.verify-actions', k1Panel) ||
        qs('.verify-actions-link-only', k1Panel) ||
        (qs('#verify-qr-btn', k1Panel) && qs('#verify-qr-btn', k1Panel).parentElement);

      if (actions) after(actions, scanStatus);

      var directions = qs('.verify-directions', k1Panel);
      if (directions && scanStatus.compareDocumentPosition(directions) & Node.DOCUMENT_POSITION_PRECEDING) {
        scanStatus.after(directions);
      }
    }

    // Session termination after K1 panel, not inside it.
    if (session && k1Panel) after(k1Panel, session);

    // Caution after session.
    if (caution && session) after(session, caution);

    // Badge last in sidebar.
    var badge = qs('.sidebar-version-badge', sidebar);
    if (!badge) {
      var statusText = qs('#status-text');
      if (statusText) {
        badge = statusText.closest('.sidebar-version-badge') || statusText.parentElement;
        if (badge) badge.className = 'sidebar-version-badge';
      }
    }
    if (!badge) badge = makeBadge();
    sidebar.appendChild(badge);
  }

  function bindEnvelope() {
    var root =
      qs('.built-by') ||
      qs('.footer-built-by') ||
      qs('.status-right') ||
      qsa('div,footer,span').reverse().find(function (el) {
        return /BUILT BY EMP|hope_ology|THANK YOU/i.test(el.textContent || '');
      });

    if (!root) return;

    root.classList.add('sg-envelope-root');

    var trigger =
      qs('[data-thank-envelope]', root) ||
      qs('.thank-you-envelope', root) ||
      qs('.thankyou-envelope', root) ||
      qs('.envelope', root) ||
      qs('.envelope-icon', root) ||
      qs('svg', root) ||
      qs('img', root) ||
      root;

    var pop =
      qs('.thank-you-popover', root) ||
      qs('.thankyou-popover', root) ||
      qs('.thanks-popover', root) ||
      qs('[data-thank-popover]', root);

    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'thank-you-popover';
      pop.innerHTML =
        '<strong style="color:var(--teal);letter-spacing:.12em;">THANK YOU</strong><br>' +
        'Built by EMP<br>' +
        '<span style="color:var(--magenta);">@hope_ology</span>';
      root.appendChild(pop);
    } else {
      pop.classList.add('thank-you-popover');
    }

    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');

    function toggle(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      root.classList.toggle('sg-envelope-open');
    }

    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
    });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) root.classList.remove('sg-envelope-open');
    });
  }

  ready(function () {
    enforceSidebar();
    bindEnvelope();

    // Re-run once after other scripts initialize.
    setTimeout(function () {
      enforceSidebar();
      bindEnvelope();
    }, 250);
  });
})();
</script>
`;

if (!html.includes('</body>')) {
  throw new Error('No </body> found in index.html');
}
html = html.replace('</body>', js + '\n</body>');

fs.writeFileSync(FILE, html);
console.log('OK: sidebar + envelope repair injected');
