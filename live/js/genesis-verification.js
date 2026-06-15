// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE
(function() {
    'use strict';

    // 1. All storage keys and constants
    const SG_GENESIS_ORIGIN_KEY = 'sg_genesis_origin';
    const SG_GENESIS_FP_KEY = 'sg_genesis_fp';
    const SG_FIRST_VISIT_KEY = 'sg_first_visit';
    const SG_VISIT_COUNT_KEY = 'sg_visit_count';
    const SG_AUTH_PASSED_KEY='***';
    const BYPASS_HASH = 'TODO_BYPASS_HASH_REPLACE_WITH_SHA256_OF_YOUR_SECRET';

    // 2. Module-level state
    let authOverlay = null;
    let qrInterval = null;

    // 3. Utility functions
    function getK1Address() {
        const el = document.getElementById('k1-addr') || 
                   document.getElementById('k1-address') || 
                   document.getElementById('genesis-k1') ||
                   document.querySelector('[data-field="k1-addr"]') ||
                   document.querySelector('input[id*="k1"]');
        if (!el) return '';
        return (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.value?.trim() : el.textContent?.trim() || '';
    }

    async function getFingerprint() {
        const parts = [
            navigator.hardwareConcurrency || 0,
            screen.width,
            screen.height,
            screen.colorDepth,
            navigator.language,
            Intl.DateTimeFormat().resolvedOptions().timeZone
        ];
        const raw = parts.join('|');
        const msg = new TextEncoder().encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function generateNonce() {
        return Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 4. QR functions
    function renderQR() {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas || !window.QRCode) return;
        const payload = JSON.stringify({
            challenge: generateNonce(),
            origin: window.location.origin,
            ts: Date.now(),
            v: '777g-v1'
        });
        try {
            window.QRCode.toCanvas(document.getElementById('qr-canvas'), payload, { width: 256, margin: 2 });
        } catch (e) { console.error('QR generation failed:', e); }
    }

    function startQRRotation() {
        if (qrInterval) clearInterval(qrInterval);
        qrInterval = setInterval(renderQR, 5000);
        renderQR();
    }

    function stopQRRotation() {
        if (qrInterval) clearInterval(qrInterval);
    }

    // 5. Auth overlay render functions
    function renderSameDevice(overlay) {
        overlay.innerHTML = `
            <div class="auth-modal">
                <div class="auth-bypass-trigger" id="auth-bypass-trigger" title="Admin bypass">
                    <span class="bypass-symbol">O-'</span>
                </div>
                <div class="auth-content">
                    <h2>GENESIS OWNER AUTHENTICATION</h2>
                    <p class="auth-subtitle">VERIFY OWNERSHIP</p>
                    <p class="auth-hint">Verifying device origin...</p>
                    <button id="auth-scan-btn" class="btn primary btn-lg">SCAN</button>
                    <div id="auth-status" class="auth-status"></div>
                </div>
                <div id="auth-bypass-panel" class="auth-bypass-panel hidden">
                    <h3>ADMIN BYPASS</h3>
                    <input type="password" id="bypass-key-input" placeholder="Enter bypass key" autocomplete="off">
                    <div id="bypass-error" class="auth-error hidden"></div>
                    <div class="bypass-actions">
                        <button id="bypass-submit" class="btn primary">UNLOCK</button>
                        <button id="bypass-cancel" class="btn secondary">CANCEL</button>
                    </div>
                </div>
            </div>
        `;
        overlay.classList.remove('hidden');
        bindSameDeviceEvents();
    }

    function renderSeparateDevice(overlay) {
        overlay.innerHTML = `
            <div class="auth-modal">
                <div class="auth-bypass-trigger" id="auth-bypass-trigger" title="Admin bypass">
                    <span class="bypass-symbol">O-'</span>
                </div>
                <div class="auth-content">
                    <h2>SCAN FOR GENESIS OWNER AUTHENTICATION</h2>
                    <div id="qr-canvas-container" style="margin:20px auto;">
                        <canvas id="qr-canvas" width="256" height="256"></canvas>
                    </div>
                    <p id="qr-status" class="auth-hint">Waiting for device sweep...</p>
                    <button id="auth-use-device-btn" class="btn secondary">Use this device instead</button>
                    <div id="auth-status" class="auth-status"></div>
                </div>
                <div id="auth-bypass-panel" class="auth-bypass-panel hidden">
                    <h3>ADMIN BYPASS</h3>
                    <input type="password" id="bypass-key-input" placeholder="Enter bypass key" autocomplete="off">
                    <div id="bypass-error" class="auth-error hidden"></div>
                    <div class="bypass-actions">
                        <button id="bypass-submit" class="btn primary">UNLOCK</button>
                        <button id="bypass-cancel" class="btn secondary">CANCEL</button>
                    </div>
                </div>
            </div>
        `;
        overlay.classList.remove('hidden');
        bindSeparateDeviceEvents();
    }

    // 6. Event binders
    function bindSameDeviceEvents() {
        const btn = document.getElementById('auth-scan-btn');
        const trigger = document.getElementById('auth-bypass-trigger');
        const panel = document.getElementById('auth-bypass-panel');
        const input = document.getElementById('bypass-key-input');
        const submit = document.getElementById('bypass-submit');
        const cancel = document.getElementById('bypass-cancel');
        const error = document.getElementById('bypass-error');

        btn?.addEventListener('click', runArtifactSweep);
        trigger?.addEventListener('click', () => panel.classList.toggle('hidden'));
        submit?.addEventListener('click', handleBypassSubmit);
        cancel?.addEventListener('click', () => { panel.classList.add('hidden'); input.value = ''; });
    }

    function bindSeparateDeviceEvents() {
        const useDeviceBtn = document.getElementById('auth-use-device-btn');
        const trigger = document.getElementById('auth-bypass-trigger');
        const panel = document.getElementById('auth-bypass-panel');
        const input = document.getElementById('bypass-key-input');
        const submit = document.getElementById('bypass-submit');
        const cancel = document.getElementById('bypass-cancel');

        useDeviceBtn?.addEventListener('click', () => {
            initAuthOverlay();
        });
        trigger?.addEventListener('click', () => {
            document.getElementById('auth-bypass-panel').classList.toggle('hidden');
            document.getElementById('bypass-key-input')?.focus();
        });
        document.getElementById('bypass-submit')?.addEventListener('click', handleBypassSubmit);
        cancel?.addEventListener('click', () => { panel.classList.add('hidden'); input.value = ''; });
    }

    // 7. Bypass handler
    async function handleBypassSubmit() {
        const input = document.getElementById('bypass-key-input');
        const error = document.getElementById('bypass-error');
        const val = input.value;
        const msg = new TextEncoder().encode(val);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
        const hash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        if (hash === BYPASS_HASH) {
            sessionStorage.setItem(SG_AUTH_PASSED_KEY, '1');
            document.getElementById('auth-overlay').classList.add('hidden');
            startSessionEnforcement();
        } else {
            error.textContent = 'Invalid bypass key';
            error.classList.remove('hidden');
        }
    }

    // 8. Artifact checks
    async function checkArtifact1_FirstVisit() {
        const val = localStorage.getItem(SG_FIRST_VISIT_KEY);
        if (!val) {
            localStorage.setItem(SG_FIRST_VISIT_KEY, Date.now().toString());
            return false;
        }
        const age = Date.now() - parseInt(val, 10);
        return age > 604800000; // 7 days
    }

    async function checkArtifact2_Fingerprint() {
        const fp = await getFingerprint();
        const stored = localStorage.getItem(SG_GENESIS_FP_KEY);
        if (!stored) {
            localStorage.setItem(SG_GENESIS_FP_KEY, fp);
            return true;
        }
        return stored === fp;
    }

    async function checkArtifact3_FirstK1Tx() {
        const k1Addr = getK1Address();
        if (!k1Addr || !/^0x[0-9a-fA-F]{40}$/.test(k1Addr)) return false;
        try {
            const resp = await fetch('https://api.etherscan.io/api?module=account&action=txlist&address=' + k1Addr + '&startblock=0&endblock=99999999&page=1&offset=1&sort=asc');
            const data = await resp.json();
            if (data.status === '1' && data.result.length > 0) {
                if (data.result[0].from.toLowerCase() === k1Addr.toLowerCase()) {
                    window._sg_k1_first_tx = data.result[0].hash;
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    async function checkArtifact4_VisitCount() {
        let count = parseInt(localStorage.getItem(SG_VISIT_COUNT_KEY) || '0', 10);
        count++;
        localStorage.setItem(SG_VISIT_COUNT_KEY, count.toString());
        return count >= 2;
    }

    // 9. Sweep orchestrator
    async function runArtifactSweep() {
        const btn = document.getElementById('auth-scan-btn');
        const statusEl = document.getElementById('auth-status');
        const k1Addr = getK1Address();

        if (!btn || !statusEl) return;
        btn.disabled = true;
        statusEl.textContent = 'Sweeping device for genesis artifacts...';
        statusEl.className = 'auth-status info';

        const results = await Promise.allSettled([
            checkArtifact1_FirstVisit(),
            checkArtifact2_Fingerprint(),
            checkArtifact3_FirstK1Tx(),
            checkArtifact4_VisitCount()
        ]);

        const scores = results.map((r, i) => ({
            name: ['First visit age', 'Device fingerprint', 'First K1 transaction', 'Visit count'][i],
            pass: r.status === 'fulfilled' && r.value === true
        }));

        const passCount = scores.filter(s => s.pass).length;

        if (scores.some(s => s.name === 'First K1 transaction' && !s.pass)) {
            statusEl.textContent = 'K1 address required in deploy tab before scanning.';
            statusEl.className = 'auth-status error';
            document.getElementById('auth-scan-btn').disabled = false;
            return;
        }

        if (passCount >= 3) {
            sessionStorage.setItem(SG_AUTH_PASSED_KEY, '1');
            localStorage.setItem(SG_GENESIS_ORIGIN_KEY, window.location.hostname);
            stopQRRotation();
            hideOverlay();
            startSessionEnforcement();
        } else {
            const missing = scores.filter(s => !s.pass).map(s => s.name).join(', ');
            statusEl.textContent = 'Insufficient genesis artifacts (' + scores.filter(s=>s.pass).length + '/4). Missing: ' + missing;
            statusEl.className = 'auth-status error';
            setTimeout(() => { document.getElementById('auth-scan-btn').disabled = false; }, 8000);
        }
    }

    // 10. Session functions
    function hideOverlay() {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.3s ease';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    }

    function startSessionEnforcement() {
        document.addEventListener('keydown', e => { if (e.key === 'Escape') wipeSession(); });
        
        let visibilityTimer;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                visibilityTimer = setTimeout(wipeSession, 30000);
            } else {
                clearTimeout(visibilityTimer);
            }
        });
        
        let idleTimer = setTimeout(wipeSession, 300000);
        ['mousemove', 'keydown', 'touchstart'].forEach(ev => {
            document.addEventListener(ev, () => {
                clearTimeout(idleTimer);
                idleTimer = setTimeout(wipeSession, 300000);
            }, { passive: true });
        });
    }

    function wipeSession() {
        sessionStorage.clear();
        document.querySelectorAll('input[type="password"], input[data-sensitive]').forEach(el => el.value = '');
        window.location.reload();
    }

    // 11. Init
    async function initAuthOverlay() {
        const overlay = document.getElementById('auth-overlay');
        if (!overlay) return;

        const sameDevice = localStorage.getItem(SG_GENESIS_ORIGIN_KEY) === window.location.hostname ||
                           localStorage.getItem(SG_GENESIS_FP_KEY) !== null;

        if (!localStorage.getItem(SG_FIRST_VISIT_KEY)) localStorage.setItem(SG_FIRST_VISIT_KEY, Date.now().toString());

        if (sameDevice) {
            renderSameDevice(overlay);
        } else {
            renderSeparateDevice(overlay);
            if (!window.QRCode) {
                const s = document.createElement('script');
                s.src = '/vendor/qrcode.min.js';
                s.onload = () => startQRRotation();
                document.head.appendChild(s);
            } else {
                startQRRotation();
            }
        }

        overlay.classList.remove('hidden');
    }

    // Expose simplified bypass for admin-dot panel in index.html
    window._sg_adminBypass = async function(key) {
      document.getElementById('bypass-key-input').value = key;
      await handleBypassSubmit();
    };

    // 12. Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuthOverlay);
    } else {
        initAuthOverlay();
    }
})();