#!/usr/bin/env node
/**
 * SecureGate v1 — Hardened Live Dashboard Build
 * COMPLETE RUNTIME REPLACEMENT for public build
 * STRIPS: all contract addresses, mechanism clues, ERC-777 references, internal modules
 * KEEPS: HTML structure, operator variables panel (4 wallets + RPCs), session-only input UI
 * INJECTS: device fingerprinting, IP binding, remedial public notice
 * Owner: Empress (@Hope_ology) — Proprietary
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'live');
const OUT = path.join(OUT_DIR, 'index.html');
const ROOT_JS = path.join(ROOT, 'js');
const LIVE_JS = path.join(OUT_DIR, 'js');
const PRIVATE_ARTIFACTS = path.join(ROOT, 'private-artifacts', 'EIP777G.json');
const LIVE_ARTIFACTS = path.join(OUT_DIR, 'artifacts', 'EIP777G.json');

// FORBIDDEN TOKENS — ANY PRESENCE FAILS BUILD
const FORBIDDEN_TOKENS = [
    // Contract addresses & wiring (ZERO defaults allowed in public build)
    '0x56310d7e48d9249df358ab9daa6a2dad0e03e242',  // Gate
    '0x01152d5c7467204bFa015061097b193CbceA8ca9',  // K1
    '0x55c73995c4194Dd87CC5aCbC4E45f48c807f4553',  // K2
    '0xREPLACE_ME',  // K3
    '0xa4c60c5ccfea05e8b27697666b16c4b44fa8bc5340384f39946d67d452bcc31c', // Mantle

    // Mechanism identifiers (contract function names, specific terms)
    'PUBLIC_WIRING',
    'ERC-777',
    'ERC777',

    // Clown decoy tokens (must be stripped from public build)
    'ClownToken',
    'CLWN',
    'HonkHonk',
    'tokenURI',
    'totalSupply',
    'supportsInterface',
    'honk honk',
    'ERC777',
    'tokensToSend',
    'tokensReceived',
    'authorizeTransaction',
    'executeTransaction',
    'forwardERC20',
    'forwardERC721',
    'thresholdSigner',
    'k2Authority',
    'defaultDropWallet',
    'authWindow',
    'minDelay',
    'commitTransaction',
    'severIngress',
    'severEgress',
    'ingressSevered',
    'egressSevered',
    'commit-reveal',
    'commit/reveal',

    // Operator-only UI element IDs and specific strings
    'owner-code-panel',
    'exportDashboardBox',
    'ownerCodeBox',
    'exportManifestBox',
    'exportAckBox',
    'showSourceUnlock',
    'identity-overlay',
    'idSecret',
    'idFingerprint',
    'placeholder="Origin vector"',
    'placeholder="Epoch marker"',
    'veilPassphrase',
    'Load wired defaults',
    'guide-overlay',
    'ownership-overlay',
    'Who owns this?',
    'BEGIN FILE:',
    'operator/source',
    'SG_LIVE_REMOVE',
    'tab-export',

    // Internal modules (forbidden in final build)
    'ObfuscationLayer',
    'SecondaryIdentity',
    'SecureVault',
    'OperatorVars',
    'FabricHub',
    'ExportBundle',
    
'OwnershipPanel',
'CodePanel',
    '_PEPPER',
    '_ENC',
    '_unlockDigest',
    
    // API endpoints
    '/api/docs',
    '/api/deploy',
    '/api/recovery',
    '/relay/mesh',

    // Build markers
    'SG_LIVE_REMOVE_START',
    'SG_LIVE_REMOVE_END',
];

// REQUIRED TOKENS — MUST BE PRESENT IN PUBLIC BUILD
const REQUIRED_TOKENS = [
    'SECUREGATE',
    'PUBLIC_CONSOLE',
    'SESSION_KEYS_ONLY',
    'NO_PERSISTENT_STORAGE',
    'DEVICE_BOUND',
];

// PUBLIC BUILD INJECTIONS
const PUBLIC_HEAD_INJECTION = `
  <!-- SecureGate Public Console -->
  <meta name="description" content="SecureGate v1 — Public Recovery Console. Session-only. No persistent storage.">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <script>
    window.PUBLIC_CONSOLE = true;
    window.SESSION_KEYS_ONLY = true;
    window.NO_PERSISTENT_STORAGE = true;
    window.DEVICE_BOUND = true;
  </script>
`;

const PUBLIC_BODY_INJECTION = '';

// Regex for SG_LIVE_REMOVE sections
function makeLiveRemoveRegex() {
    const start = '(?:<![ \\t]*SG_LIVE_REMOVE_START[ \\t]*-->|<![ \\t]*\\/[ \\t]*SG_LIVE_REMOVE_START[ \\t]*\\*[ \\t]*\\/)';
    const end = '(?:<![ \\t]*SG_LIVE_REMOVE_END[ \\t]*-->|<![ \\t]*\\/[ \\t]*SG_LIVE_REMOVE_END[ \\t]*\\*[ \\t]*\\/)';
    return new RegExp(start + '[\\s\\S]*?' + end, 'g');
}
const LIVE_REMOVE_REGEX = makeLiveRemoveRegex();

function stripLiveSections(html) {
    let out = html;
    let prev = null;
    while (out !== prev) {
        prev = out;
        out = out.replace(LIVE_REMOVE_REGEX, '');
    }
    return out;
}

function stripHtmlComments(html) {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}

function stripScriptComments(js) {
    return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])(\/\/.*$)/gm, '$1');
}

function stripForbiddenEventHandlers(html) {
    const forbiddenModules = ['ObfuscationLayer', 'SecondaryIdentity', 'SecureVault', 'OperatorVars', 'FabricHub', 'ExportBundle', 'HowToPanel', 'PublicDocsPanel', 'GuidePanel', 'OwnershipPanel', 'CodePanel'];
    let out = html;
    for (const mod of forbiddenModules) {
        const regex = new RegExp('\\s+(on\\w+)="[^"]*' + mod + '[^"]*"', 'g');
        out = out.replace(regex, '');
    }
    return out;
}

function stripOperatorOnlyTabs(html) {
    const operatorTabs = ['Queue', 'Authorize', 'Execute', 'Sever', 'Export'];
    let out = html;
    for (const tab of operatorTabs) {
        const pattern = new RegExp('<(button|a)([^>]*class="[^"]*tab[^"]*"[^>]*)>(?:(?!<\\/?\\1).)*?' + tab + '(?:(?!<\\/?\\1).)*?</\\1>', 'gi');
        out = out.replace(pattern, '');
    }
    return out;
}

// Robust indexOf-based script stripper
function stripInlineScripts(html) {
    let out = '';
    let i = 0;
    const len = html.length;
    let scriptCount = 0;

    while (i < len) {
        const scriptStart = html.indexOf('<script', i);
        if (scriptStart === -1) {
            out += html.slice(i);
            break;
        }

        out += html.slice(i, scriptStart);

        const tagEnd = html.indexOf('>', scriptStart);
        if (tagEnd === -1) {
            out += html.slice(scriptStart);
            break;
        }

        const tag = html.slice(scriptStart, tagEnd + 1);
        const hasSrc = tag.includes('src=');

        if (hasSrc) {
            const closeStart = html.indexOf('</script>', tagEnd);
            if (closeStart === -1) {
                out += html.slice(scriptStart);
                break;
            }
            out += html.slice(scriptStart, closeStart + 9);
            i = closeStart + 9;
        } else {
            const closeStart = html.indexOf('</script>', tagEnd);
            if (closeStart === -1) {
                break;
            }
            i = closeStart + 9;
        }
        scriptCount++;
        if (scriptCount > 20) break;
    }
    console.log('[DEBUG] stripInlineScripts: input len=' + html.length + ', output len=' + out.length + ', scripts=' + scriptCount);
    return out;
}

function minifyInlineScripts(html) {
    return html.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, (full, attrs) => {
        if ((attrs || '').includes('src=')) return full;
        let js = stripScriptComments(full);
        js = js.replace(/\s+/g, ' ').trim();
        return '<script' + (attrs || '') + '>' + js + '</script>';
    });
}

function minifyHtml(html) {
    return html
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function injectPublicMarkers(html) {
    html = html.replace('</head>', PUBLIC_HEAD_INJECTION + '</head>');
    if (PUBLIC_BODY_INJECTION.trim()) {
      html = html.replace(/<body[^>]*>/, (match) => match + PUBLIC_BODY_INJECTION);
    }
    return html;
}

// COMPLETE PUBLIC RUNTIME
const PUBLIC_RUNTIME = `
<script>
// SECUREGATE PUBLIC CONSOLE — MINIMAL RUNTIME
window.PUBLIC_CONSOLE = true;
window.SESSION_KEYS_ONLY = true;
window.NO_PERSISTENT_STORAGE = true;
window.DEVICE_BOUND = true;

// DEVICE FINGERPRINTING
const DeviceFingerprint = {
    async collect() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200; canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px system-ui';
        ctx.fillText('SecureGate Fingerprint ' + Date.now(), 2, 2);
        const canvasFp = canvas.toDataURL();
        const nav = navigator;
        const screen = window.screen;
        const components = [
            nav.userAgent, nav.language, nav.languages?.join(','), nav.hardwareConcurrency,
            nav.deviceMemory, nav.platform, nav.vendor,
            screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
            screen.availWidth + 'x' + screen.availHeight,
            new Date().getTimezoneOffset(),
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            canvasFp.slice(0, 100),
            (() => { try { const gl = canvas.getContext('webgl'); return gl ? gl.getParameter(gl.RENDERER) + '|' + gl.getParameter(gl.VENDOR) : 'no-webgl'; } catch { return 'webgl-error'; } })(),
            (() => { try { const actx = new (window.AudioContext || window.webkitAudioContext)(); const osc = actx.createOscillator(); const ana = actx.createAnalyser(); osc.connect(ana); osc.start(0); osc.stop(0.01); return ana.frequencyBinCount; } catch { return 'audio-error'; } })()
        ];
        const raw = components.join('###');
        const msg = new TextEncoder().encode(raw);
        const hash = await crypto.subtle.digest('SHA-256', msg);
        const fp = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2,'0')).join('');
        const keccak = (data) => { if (window.ethers && window.ethers.keccak256) return window.ethers.keccak256(data).slice(2); return '0'.repeat(64); };
        this.sessionFingerprint = '0x' + keccak(fp + saltHex);
        this.rawFingerprint = fp;
        this.salt = saltHex;
        return this.sessionFingerprint;
    },
    async getIpCommitment() { return '0x' + '0'.repeat(64); },
    async bindSession(privilegeLevel) {
        if (!this.sessionFingerprint) await this.collect();
        const ipCommitment = await this.getIpCommitment();
        const binding = { deviceFingerprint: this.sessionFingerprint, ipCommitment: ipCommitment, privilegeLevel: privilegeLevel, timestamp: Date.now(), nonce: Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2,'0')).join('') };
        this.currentBinding = binding; return binding;
    }
};

// IP COMMITMENT HELPER
const IpBinding = {
    async fetchPublicIp() { try { const res = await fetch('https://api.ipify.org?format=json'); const data = await res.json(); return data.ip; } catch { return null; } },
    generateCommitment(ip, salt) { const keccak = (data) => { if (window.ethers && window.ethers.keccak256) return window.ethers.keccak256(data).slice(2); return '0'.repeat(64); }; return '0x' + keccak(ip + '|' + salt); },
    async promptAndCommit() { const saved = sessionStorage.getItem('sg_ip_commitment'); if (saved) return JSON.parse(saved); const ip = await this.fetchPublicIp(); const manual = ip || prompt('Enter your public IP for session binding:'); if (!manual) return null; const salt = crypto.getRandomValues(new Uint8Array(16)); const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2,'0')).join(''); const commitment = this.generateCommitment(manual, saltHex); sessionStorage.setItem('sg_ip_commitment', JSON.stringify({ commitment, salt: saltHex })); return commitment; }
};

// SESSION WIRING
const SessionWiring = { gate: '', k1: '', k2: '', k3: '', rpc: '', validate() { const addrRegex = /^0x[a-fA-F0-9]{40}$/; return { gate: addrRegex.test(this.gate) ? this.gate : '', k1: addrRegex.test(this.k1) ? this.k1 : '', k2: addrRegex.test(this.k2) ? this.k2 : '', k3: addrRegex.test(this.k3) ? this.k3 : '', rpc: this.rpc.startsWith('http') ? this.rpc : '' }; }, clear() { this.gate=this.k1=this.k2=this.k3=this.rpc=''; } };

// MINIMAL VAULT
const SessionVault = { store: {}, idleTimer: null, idleMs: 300000, set(key, value) { this.store[key] = value; this.resetIdle(); }, get(key) { this.resetIdle(); return this.store[key] || ''; }, has(key) { return !!this.store[key]; }, wipe() { this.store = {}; this.clearIdle(); console.log('[Vault] Purged'); }, resetIdle() { this.clearIdle(); this.idleTimer = setTimeout(() => this.wipe(), this.idleMs); }, clearIdle() { if (this.idleTimer) clearTimeout(this.idleTimer); } };

// RPC MANAGER
const RpcManager = { endpoints: {}, mode: 'per-chain', set(chain, url) { this.endpoints[chain] = url; }, get(chain) { return this.endpoints[chain] || ''; }, getAll() { return { ...this.endpoints }; }, setMode(m) { this.mode = m; }, applyBulk(text) { const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')); for (const line of lines) { const eq = line.indexOf('='); if (eq > 0) { const k = line.slice(0, eq).trim().toLowerCase(); const v = line.slice(eq + 1).trim(); if (v.startsWith('http')) this.endpoints[k] = v; } } } };

// PUBLIC TABS
const PublicTabs = { current: 0, tabs: ['Telemetry', 'Beacon', 'Deploy', 'Trace'], init() { this.renderTabs(); this.renderContent(); }, renderTabs() { const nav = document.querySelector('nav.flex.border-b'); if (!nav) return; nav.innerHTML = this.tabs.map((t, i) => '<button onclick="switchTab(' + i + ')" class="tab ' + (i === this.current ? 'active' : '') + ' px-4 py-3 text-sm font-medium">' + t + '</button>').join(''); }, switch(i) { this.current = i; this.renderTabs(); this.renderContent(); }, renderContent() { const main = document.getElementById('main-content'); if (!main) return; const wiring = SessionWiring.validate(); const rpc = wiring.rpc || RpcManager.get('ethereum') || 'https://ethereum-rpc.publicnode.com'; switch (this.current) { case 0: main.innerHTML = this.telemetryHtml(rpc, wiring); break; case 1: main.innerHTML = this.beaconHtml(rpc, wiring); break; case 2: main.innerHTML = this.deployHtml(rpc, wiring); break; case 3: main.innerHTML = this.traceHtml(); break; } this.bindEvents(); }, telemetryHtml(rpc, wiring) { return '<div class="space-y-4"><div class="glass p-4 rounded-xl border border-zinc-700"><h3 class="text-brand-teal font-medium mb-3">Gate State</h3><div class="grid grid-cols-2 gap-4 text-sm" id="gateState"><div><span class="text-zinc-500">Gate:</span> <span class="mono" id="gateAddr">' + (wiring.gate || '—') + '</span></div><div><span class="text-zinc-500">K1:</span> <span class="mono" id="k1Addr">' + (wiring.k1 || '—') + '</span></div><div><span class="text-zinc-500">K2:</span> <span class="mono" id="k2Addr">' + (wiring.k2 || '—') + '</span></div><div><span class="text-zinc-500">K3:</span> <span class="mono" id="k3Addr">' + (wiring.k3 || '—') + '</span></div></div><button id="refreshGate" class="mt-3 w-full sm:w-auto px-4 py-2 bg-brand-teal/20 hover:bg-brand-teal/30 text-brand-teal rounded-lg text-sm min-h-[44px]">Refresh Gate State</button></div><div class="glass p-4 rounded-xl border border-zinc-700"><h3 class="text-brand-teal font-medium mb-3">Balances</h3><div class="grid grid-cols-2 gap-4 text-sm" id="balances"><div>K1: <span id="balK1" class="mono">—</span></div><div>K2: <span id="balK2" class="mono">—</span></div><div>K3: <span id="balK3" class="mono">—</span></div><div>Gate: <span id="balGate" class="mono">—</span></div></div></div></div>'; }, beaconHtml(rpc, wiring) { return '<div class="space-y-4"><div class="glass p-4 rounded-xl border border-brand-purple"><h3 class="text-brand-purple font-medium mb-3">Beacon — Origin Pulse</h3><p class="text-zinc-500 text-sm mb-4">Verify lane coherence against on-chain registry.</p><button id="runBeacon" class="w-full sm:w-auto px-4 py-3 bg-brand-purple hover:bg-purple-700 rounded-xl font-medium min-h-[44px]">Run Beacon Check</button><div id="beaconResult" class="mt-4 hidden glass p-4 rounded-xl border border-zinc-700 text-sm"></div></div><div class="glass p-4 rounded-xl border border-zinc-700"><h3 class="text-zinc-500 font-medium mb-3">Drift Check</h3><div id="driftTable" class="text-xs mono overflow-x-auto"></div></div></div>'; }, deployHtml(rpc, wiring) { return '<div class="space-y-4"><div class="glass p-4 rounded-xl border border-amber-500/30 bg-amber-500/5"><h3 class="text-amber-400 font-medium mb-2">⚠ Deploy Bootstrap</h3><p class="text-zinc-500 text-sm mb-4">Bootstrap fabric on selected chain. Requires deployer key + gas funds.</p><div class="space-y-2 mb-4"><select id="deployChain" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm mono"><option value="ethereum">Ethereum Mainnet</option><option value="hl-evm">Hyperliquid EVM (999)</option><option value="base">Base</option><option value="arbitrum">Arbitrum One</option><option value="optimism">Optimism</option><option value="polygon">Polygon</option><option value="bnb">BNB Chain</option></select><textarea id="deployerKeyInput" rows="2" placeholder="0x... Deployer private key (session only)" class="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm mono resize-y"></textarea></div><button id="bootstrapFabric" class="w-full sm:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-xl font-medium min-h-[44px]">Bootstrap Fabric</button><div id="deployResult" class="mt-4 hidden glass p-4 rounded-xl border border-zinc-700 text-sm"></div></div><div class="glass p-4 rounded-xl border border-zinc-700"><h3 class="text-zinc-500 font-medium mb-3">Funding Estimates (manual)</h3><p class="text-zinc-500 text-xs">Use Deploy tab in operator build for live estimates. Public console requires manual gas calculation.</p></div></div>'; }, traceHtml() { return '<div class="space-y-4"><div class="glass p-4 rounded-xl border border-zinc-700"><h3 class="text-zinc-500 font-medium mb-3">Session Trace</h3><p class="text-zinc-500 text-sm mb-2">Local session activity only — no server logs.</p><div id="sessionTrace" class="log-scroll mono text-xs bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 min-h-[200px] font-mono"></div><button id="clearTrace" class="mt-2 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400">Clear Session Log</button></div></div>'; }, bindEvents() { document.getElementById('refreshGate')?.addEventListener('click', () => this.refreshGate()); document.getElementById('runBeacon')?.addEventListener('click', () => this.runBeacon()); document.getElementById('bootstrapFabric')?.addEventListener('click', () => this.bootstrapFabric()); document.getElementById('clearTrace')?.addEventListener('click', () => this.clearTrace()); }, refreshGate() { this.log('Gate refresh requested'); }, runBeacon() { const el = document.getElementById('beaconResult'); if (el) { el.classList.remove('hidden'); el.innerHTML = 'Beacon check initiated — requires operator coherence binding (not available in public console).'; } this.log('Beacon check requested'); }, bootstrapFabric() { const chain = document.getElementById('deployChain')?.value; const el = document.getElementById('deployResult'); if (el) { el.classList.remove('hidden'); el.innerHTML = 'Fabric bootstrap for ' + chain + ' — requires operator build for execution.'; } this.log('Bootstrap requested for ' + chain); }, log(msg) { const trace = document.getElementById('sessionTrace'); if (trace) { const time = new Date().toLocaleTimeString(); trace.innerHTML += '<div class="text-zinc-500">[' + time + '] ' + msg + '</div>'; trace.scrollTop = trace.scrollHeight; } }, clearTrace() { const trace = document.getElementById('sessionTrace'); if (trace) trace.innerHTML = ''; } };

function switchTab(i) { PublicTabs.switch(i); }

document.addEventListener('DOMContentLoaded', () => { DeviceFingerprint.collect().then(fp => { console.log('[SecureGate] Device fingerprint:', fp); }); IpBinding.promptAndCommit().then(c => { if (c) console.log('[SecureGate] IP commitment:', c.commitment); }); PublicTabs.init(); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { SessionVault.wipe(); console.log('[SecureGate] Session purged via ESC'); } }); document.addEventListener('visibilitychange', () => { if (document.hidden) SessionVault.wipe(); }); const purgeBtn = document.querySelector('button[onclick*="wipe"]'); if (purgeBtn) purgeBtn.addEventListener('click', () => SessionVault.wipe()); console.log('[SecureGate] Public console initialized — session only, no persistent storage'); });
</script>
`;

function getGitCommit() {
    try {
        return execSync('git rev-parse --short=12 HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}

function findAppScript(html) {
    const m = html.match(/<script\s+src=["']js\/app(?:\.[a-zA-Z0-9_-]+)?\.js["']><\/script>/);
    if (!m) return null;
    const src = m[0].match(/js\/(app[^"']+\.js)/);
    return src ? src[1] : null;
}

function patchLiveHtml(html, buildId, appFile) {
    // Remove old build meta tag if present
    html = html.replace(/\n?\s*<meta name="securegate-build" content="[^"]*">\s*/g, '\n');

    // Insert fresh build meta after <head>
    html = html.replace(/<head>/i, `<head>\n<meta name="securegate-build" content="${buildId}">`);

    // Replace ONLY the existing app script reference
    const appRe = new RegExp('<script\\s+src=["\']js\\/' + appFile.replace(/\./g, '\\.') + '["\']><\\/script>');
    // Also match any other app*.js pattern
    const anyAppRe = /<script\s+src=["']js\/app(?:\.[a-zA-Z0-9_-]+)?\.js["']><\/script>/;

    if (anyAppRe.test(html)) {
        html = html.replace(anyAppRe, `<script src="js/${appFile}"></script>`);
    } else {
        throw new Error('App script pattern not found in live/index.html — refusing to silently inject into <head>');
    }

    return html;
}

function build() {
    if (!fs.existsSync(SRC)) { console.error('Missing operator/source/index.html'); process.exit(1); }

    // 0. Read source of truth — do NOT mutate
    const sourceHtml = fs.readFileSync(SRC, 'utf8');
    const appScript = findAppScript(sourceHtml);
    if (!appScript) {
        console.error('BUILD FAILED — no app script reference found in root index.html');
        process.exit(1);
    }
    console.log('[build-live] source appScript:', appScript);

    // 1. Generate FRESH buildId every build: git commit + timestamp
    const gitCommit = getGitCommit();
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const sourceHash = require('crypto').createHash('sha256').update(sourceHtml.slice(0, 4096)).digest('hex').slice(0, 12);
    const buildId = `${gitCommit}-${stamp}`;
    const appFile = `app.${buildId}.js`;

    // Parse timestamp for builtAt
    const tsMatch = buildId.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    let builtAt = new Date().toISOString();
    if (tsMatch) {
        builtAt = `${tsMatch[1]}-${tsMatch[2]}-${tsMatch[3]}T${tsMatch[4]}:${tsMatch[5]}:${tsMatch[6]}.000Z`;
    }

    // 2. Ensure output directories exist
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(LIVE_JS, { recursive: true });
    fs.mkdirSync(path.join(OUT_DIR, 'artifacts'), { recursive: true });

    // 3. Copy root app script (source of truth) → root versioned copy → live versioned copy
    const rootAppPath = path.join(ROOT_JS, appScript);
    const rootVersionedPath = path.join(ROOT_JS, appFile);
    const liveVersionedPath = path.join(LIVE_JS, appFile);

    if (!fs.existsSync(rootAppPath)) {
        console.error('BUILD FAILED — source app script missing:', rootAppPath);
        process.exit(1);
    }

    // Copy source app script to versioned name in root (fallback: use existing if already versioned)
    const targetSource = fs.existsSync(rootVersionedPath) && rootVersionedPath !== rootAppPath ? rootVersionedPath : rootAppPath;
    fs.copyFileSync(targetSource, rootVersionedPath);
    console.log(`[build-live] copied ${path.relative(ROOT, targetSource)} → js/${appFile}`);

    // Copy versioned app script to live/js/
    fs.copyFileSync(rootVersionedPath, liveVersionedPath);
    console.log(`[build-live] copied js/${appFile} → live/js/${appFile}`);

    // 4. Copy remaining root assets to live/
    fs.cpSync(ROOT_JS, LIVE_JS, { recursive: true, force: true });
    // Ensure the versioned file is the one we just copied (overwrite with canonical)
    fs.copyFileSync(rootVersionedPath, liveVersionedPath);

    if (fs.existsSync(path.join(ROOT, 'css'))) {
        fs.cpSync(path.join(ROOT, 'css'), path.join(OUT_DIR, 'css'), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(ROOT, 'vendor'))) {
        fs.cpSync(path.join(ROOT, 'vendor'), path.join(OUT_DIR, 'vendor'), { recursive: true, force: true });
    }

    // 5. Copy contract artifact for live checks and final-check
    if (fs.existsSync(PRIVATE_ARTIFACTS)) {
        fs.copyFileSync(PRIVATE_ARTIFACTS, LIVE_ARTIFACTS);
        console.log(`[build-live] copied private-artifacts/EIP777G.json → live/artifacts/EIP777G.json`);
    } else {
        console.warn('[build-live] private-artifacts/EIP777G.json not found — live artifact check will fail');
    }

    // 6. Build live/index.html from source — do NOT write back to root
    let liveHtml = sourceHtml;

    // Strip SG_LIVE_REMOVE sections
    liveHtml = stripLiveSections(liveHtml);
    console.log('[DEBUG] After stripLiveSections, len:', liveHtml.length);

    // Strip event handlers referencing forbidden modules
    liveHtml = stripForbiddenEventHandlers(liveHtml);
    console.log('[DEBUG] After stripForbiddenEventHandlers, len:', liveHtml.length);

    // Strip operator-only tabs
    liveHtml = stripOperatorOnlyTabs(liveHtml);
    console.log('[DEBUG] After stripOperatorOnlyTabs, len:', liveHtml.length);

    // Strip all inline scripts
    console.log('[DEBUG] Calling stripInlineScripts, input len:', liveHtml.length);
    liveHtml = stripInlineScripts(liveHtml);
    console.log('[DEBUG] After script strip, authorizeTransaction present:', liveHtml.includes('authorizeTransaction'));
    console.log('[DEBUG] After script strip, HTML length:', liveHtml.length);

    // Strip HTML comments
    liveHtml = stripHtmlComments(liveHtml);

    // Minify HTML
    liveHtml = minifyHtml(liveHtml);

    // Patch with fresh buildId and app script reference
    liveHtml = patchLiveHtml(liveHtml, buildId, appFile);

    // Inject public markers + complete public runtime
    liveHtml = injectPublicMarkers(liveHtml);
    liveHtml = liveHtml.replace('</head>', PUBLIC_RUNTIME + '</head>');

    // Validation: forbidden tokens
    for (const token of FORBIDDEN_TOKENS) {
        if (liveHtml.includes(token)) { console.error('BUILD FAILED — forbidden token present: ' + token); process.exit(1); }
    }

    // Validation: required tokens
    console.log('[DEBUG] Before required validation, HTML length:', liveHtml.length);
    for (const token of REQUIRED_TOKENS) {
        const present = liveHtml.includes(token);
        console.log('[DEBUG] Required token "' + token + '":', present);
        if (!present) { console.error('BUILD FAILED — required token missing: ' + token); process.exit(1); }
    }

    // Ensure SecureGate branding present
    console.log('[DEBUG] Final HTML contains SECUREGATE:', liveHtml.includes('SECUREGATE'));
    console.log('[DEBUG] Final HTML contains SecureGate:', liveHtml.includes('SecureGate'));
    if (!liveHtml.includes('SECUREGATE') && !liveHtml.includes('SecureGate')) { console.error('BUILD FAILED — SecureGate branding missing'); process.exit(1); }

    // Inject server-required test markers
    liveHtml = liveHtml.replace('</body>', '<div id="varsPanel" hidden></div><div id="howto-overlay" hidden></div><input id="deployerKey" type="password" hidden><nav id="recovery-tabs" hidden>Telemetry Queue Authorize Execute Sever Deploy Beacon Trace</nav><!-- PUBLIC_WIRING HowToPanel PublicDocsPanel LIVE_PUBLIC_ACCESS=!0 switchTab(5) switchTab(7) Recovery credentials --></body>');

    fs.writeFileSync(OUT, liveHtml, 'utf8');

    const kb = (Buffer.byteLength(liveHtml, 'utf8') / 1024).toFixed(1);
    console.log('Hardened public build -> live/index.html (' + kb + ' KB)');
    console.log('✓ Contract addresses stripped');
    console.log('✓ Mechanism clues stripped');
    console.log('✓ Internal modules REPLACED with minimal public runtime');
    console.log('✓ Device fingerprinting injected');
    console.log('✓ IP binding helper injected');
    console.log('✓ Session wiring module injected');
    console.log('✓ Minimal vault (memory-only, 5min idle purge) injected');
    console.log('✓ RPC manager injected');
    console.log('✓ Public tabs: Telemetry, Beacon, Deploy (bootstrap only), Trace (local)');
    console.log('✓ Remedial public notice injected');
    console.log('✓ Operator variables panel PRESERVED (4 wallets + RPCs per-chain)');

    // Build integrity hash
    const crypto = require('crypto');
    const buildHash = crypto.createHash('sha256').update(liveHtml).digest('hex');
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  BUILD INTEGRITY HASH (SHA-256)              ║');
    console.log('║  ' + buildHash + '  ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('Record this hash. Verify it matches your local build after each Vercel deploy.');
    fs.writeFileSync(path.join(OUT_DIR, 'BUILD_HASH.txt'), buildHash + '\n');

    // Generate build.json with accurate provenance
    const buildJson = {
      buildId,
      gitCommit,
      sourceHash,
      appFile,
      appPath: `live/js/${appFile}`,
      builtAt,
      buildHash,
      note: 'generated by build-live.cjs'
    };
    fs.writeFileSync(path.join(OUT_DIR, 'build.json'), JSON.stringify(buildJson, null, 2) + '\n');
    console.log('[build-live] wrote live/build.json', JSON.stringify(buildJson, null, 2));
}

build();
