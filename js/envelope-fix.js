(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function after(ref, node) {
    if (ref && node && ref.parentNode) {
      ref.parentNode.insertBefore(node, ref.nextSibling);
    }
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
