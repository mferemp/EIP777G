// gate.js — Auth Gate Module
// Runs ENTIRELY in browser. No network egress (CSP: connect-src 'self').
// Advisor: heuristic risk score. Never a hard lock. Opt-in, consensual.

(function() {
  'use strict';

  const SG_AUTH_KEY='***';
  
  const SG_VERIFIED_K1 = 'sg_verified_k1_addr';
  const SG_GENESIS_ORIGIN = 'sg_genesis_origin';
  const SG_GENESIS_FP = 'sg_genesis_fp';
  const SG_FIRST_VISIT = 'sg_first_visit';
  const SG_VISIT_COUNT = 'sg_visit_count';
  const SG_DISCLAIMER = 'disclaimer_shown';

  // ── Heuristic Artifacts ──────────────────────────────────────────────
  async function getFingerprint() {
    const parts = [
      navigator.hardwareConcurrency || 0,
      screen.width,
      screen.height,
      screen.colorDepth,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ];
    const raw = parts.join('|');
    const msg = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function checkArtifact1_FirstVisit() {
    const val = localStorage.getItem(SG_FIRST_VISIT);
    if (!val) {
      localStorage.setItem(SG_FIRST_VISIT, Date.now().toString());
      return { pass: false, detail: 'First visit recorded' };
    }
    const age = Date.now() - parseInt(val, 10);
    return { pass: age > 604800000, detail: 'First visit age: ' + Math.floor(age/86400000) + 'd' };
  }

  async function checkArtifact2_Fingerprint() {
    const fp = await getFingerprint();
    const stored = localStorage.getItem(SG_GENESIS_FP);
    if (!stored) {
      localStorage.setItem(SG_GENESIS_FP, fp);
      return { pass: true, detail: 'Fingerprint recorded (first visit)' };
    }
    return { pass: stored === fp, detail: stored === fp ? 'Fingerprint matches' : 'Fingerprint mismatch' };
  }

  async function checkArtifact3_K1Tx(k1Addr) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(k1Addr || '')) {
      return { pass: false, detail: 'No valid K1 address' };
    }
    try {
      const resp = await fetch(
        'https://api.etherscan.io/api?module=account&action=txlist&address=' + k1Addr + '&startblock=0&endblock=99999999&page=1&offset=1&sort=asc'
      );
      const data = await resp.json();
      if (data.status === '1' && data.result.length > 0) {
        const firstTx = data.result[0];
        if (firstTx.from.toLowerCase() === k1Addr.toLowerCase()) {
          return { pass: true, detail: 'First K1 tx: ' + firstTx.hash.slice(0,10) + '...' };
        }
      }
      return { pass: false, detail: 'No matching K1 tx found' };
    } catch (e) {
      return { pass: false, detail: 'Etherscan check failed' };
    }
  }

  async function checkArtifact4_VisitCount() {
    let count = parseInt(localStorage.getItem(SG_VISIT_COUNT) || '0', 10);
    count++;
    localStorage.setItem(SG_VISIT_COUNT, count.toString());
    return { pass: count >= 2, detail: 'Visit count: ' + count };
  }

  // ── Auth Gate UI ──────────────────────────────────────────────────────
  function renderGate(k1Addr, onAuthPassed) {
    const overlay = document.createElement('div');
    overlay.id = 'auth-gate-overlay';
    overlay.className = 'auth-overlay';
    overlay.innerHTML = '' +
      '<div class="auth-modal">' +
        '<div class="auth-bypass-trigger" id="auth-bypass-trigger" title="Admin bypass">' +
          '<span class="bypass-symbol">O-\'</span>' +
        '</div>' +
        '<div class="auth-content">' +
          '<h2>GENESIS OWNER AUTHENTICATION</h2>' +
          '<p class="auth-subtitle">VERIFY OWNERSHIP</p>' +
          '<p class="auth-hint">Running device heuristic checks&hellip;</p>' +
          '<div id="artifact-results" style="margin: 16px 0; text-align: left;"></div>' +
          '<button id="auth-scan-btn" class="btn primary btn-lg">RUN GENESIS SWEEP</button>' +
          '<div id="auth-status" class="auth-status"></div>' +
        '</div>' +
        '<div id="auth-bypass-panel" class="auth-bypass-panel hidden">' +
          '<h3>ADMIN BYPASS</h3>' +
          '<input type="password" id="bypass-key-input" placeholder="Enter bypass secret" autocomplete="off">' +
          '<div id="bypass-error" class="auth-error hidden"></div>' +
          '<div class="bypass-actions">' +
            '<button id="bypass-submit" class="btn primary">UNLOCK</button>' +
            '<button id="bypass-cancel" class="btn secondary">CANCEL</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    const resultsEl = overlay.querySelector('#artifact-results');
    const scanBtn = overlay.querySelector('#auth-scan-btn');
    const statusEl = overlay.querySelector('#auth-status');
    const trigger = overlay.querySelector('#auth-bypass-trigger');
    const panel = overlay.querySelector('#auth-bypass-panel');
    const input = overlay.querySelector('#bypass-key-input');
    const submit = overlay.querySelector('#bypass-submit');
    const cancel = overlay.querySelector('#bypass-cancel');
    const error = overlay.querySelector('#bypass-error');

    let artifacts = [];

    async function runSweep() {
      scanBtn.disabled = true;
      statusEl.textContent = 'Sweeping device for genesis artifacts&hellip;';
      statusEl.className = 'auth-status info';
      resultsEl.innerHTML = '';

      artifacts = await Promise.all([
        checkArtifact1_FirstVisit(),
        checkArtifact2_Fingerprint(),
        checkArtifact3_K1Tx(k1Input.value.trim()),
        checkArtifact4_VisitCount(),
      ]);

      resultsEl.innerHTML = artifacts.map(function(a, i) {
        return '<div style="color:' + (a.pass ? 'var(--teal)' : 'var(--magenta)') + '; font-family:monospace; font-size:11px; margin:4px 0;">' +
          (a.pass ? '&#x2705;' : '&#x274c;') + ' Artifact ' + (i+1) + ': ' + a.detail +
        '</div>';
      }).join('');

      const passCount = artifacts.filter(function(a) { return a.pass; }).length;
      const k1Empty = !/^0x[0-9a-fA-F]{40}$/.test(k1Input.value.trim());

      if (k1Empty) {
        statusEl.textContent = 'K1 address required before sweep.';
        statusEl.className = 'auth-status error';
        scanBtn.disabled = false;
        return;
      }

      if (artifacts.some(function(a) { return a.detail.includes('K1') && !a.pass; })) {
        statusEl.textContent = 'First K1 transaction not found on-chain.';
        statusEl.className = 'auth-status error';
        scanBtn.disabled = false;
        return;
      }

      if (passCount >= 3) {
        // Success!
        sessionStorage.setItem(SG_AUTH_KEY, '1');
        sessionStorage.setItem(SG_VERIFIED_K1, k1Input.value.trim());
        localStorage.setItem(SG_GENESIS_ORIGIN, window.location.hostname);
        overlay.remove();
        if (typeof onAuthPassed === 'function') onAuthPassed();
      } else {
        const missing = artifacts.filter(function(a) { return !a.pass; }).map(function(a) { return a.detail; }).join(', ');
        statusEl.textContent = 'Insufficient artifacts (' + passCount + '/4). Missing: ' + missing;
        statusEl.className = 'auth-status error';
        statusEl.innerHTML += '<br><span style="color:var(--gold);font-size:9px;">Proceed to human-assisted lane?</span>';
      }
      scanBtn.disabled = false;
    }

    // K1 Input
    const k1Input = document.createElement('input');
    k1Input.type = 'text';
    k1Input.placeholder = 'Enter K1 address (0x...)';
    k1Input.style.cssText = 'width:100%;padding:8px 12px;background:#050505;border:1px solid #222;color:var(--text);font-family:monospace;border-radius:3px;margin-bottom:16px;';
    k1Input.value = k1Addr || '';
    overlay.querySelector('.auth-content').insertBefore(k1Input, overlay.querySelector('.auth-hint'));

    // Event bindings
    trigger.addEventListener('click', function() { panel.classList.toggle('hidden'); });

    submit.addEventListener('click', async function() {
      const token = input.value.trim();
      const k1Addr = k1Input.value.trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(k1Addr)) {
        error.textContent = 'Enter your K1 address above first';
        error.classList.remove('hidden');
        return;
      }
      error.classList.add('hidden');
      try {
        const res = await fetch('/api/bypass-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ k1Addr, token })
        });
        const data = await res.json();
        if (data.ok) {
          sessionStorage.setItem(SG_AUTH_KEY, '1');
          sessionStorage.setItem(SG_VERIFIED_K1, k1Addr);
          overlay.remove();
          if (typeof onAuthPassed === 'function') onAuthPassed();
        } else {
          error.textContent = data.error || 'Invalid bypass token';
          error.classList.remove('hidden');
        }
      } catch (e) {
        error.textContent = 'Bypass check failed — try again';
        error.classList.remove('hidden');
      }
    });

    cancel.addEventListener('click', function() { panel.classList.add('hidden'); input.value = ''; });

    // Consent check
    var consent = confirm(
      'Genesis verification runs a local device heuristic sweep (canvas fingerprint, visit age, on-chain K1 tx, visit count). ' +
      'No data leaves your device. This is an ADVISORY check &mdash; heuristic only, can be wrong both ways. ' +
      'Results do NOT cryptographically prove ownership. A weak result routes you to a human lane.\n\nProceed?'
    );

    if (!consent) {
      overlay.remove();
      return;
    }

    overlay.querySelector('.auth-hint').textContent = 
      'Heuristic check only. Can be wrong both ways. Does not prove ownership.';
  }

  // ── Public API ────────────────────────────────────────────────────────
  window.initAuthGate = function(k1Addr, onAuthPassed) {
    // Skip if already authed
    if (sessionStorage.getItem(SG_AUTH_KEY) === '1') {
      if (typeof onAuthPassed === 'function') onAuthPassed();
      return;
    }
    renderGate(k1Addr, onAuthPassed);
  };

