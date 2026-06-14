/**
 * Crypto & Cloaking Utilities
 * Handles encryption, session management, device fingerprinting
 * All keys wiped after use - session only
 */

export class SessionVault {
  constructor() {
    this.store = new Map();
    this.idleTimer = null;
    this.idleMs = 5 * 60 * 1000; // 5 min default
    this._setupIdle();
    this._setupVisibility();
    this._setupKeys();
  }

  _setupIdle() {
    const reset = () => this.resetIdle();
    ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach(evt =>
      document.addEventListener(evt, reset, { passive: true })
    );
  }

  _setupVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.wipe();
    });
  }

  _setupKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.wipe();
    });
  }

  set(key, value) { this.store.set(key, value); this.resetIdle(); }
  get(key) { this.resetIdle(); return this.store.get(key) ?? null; }
  has(key) { return this.store.has(key); }
  delete(key) { this.store.delete(key); }
  clear() { this.store.clear(); }

  resetIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.wipe(), this.idleMs);
  }

  wipe() {
    this.store.clear();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    console.log('[Vault] Session purged');
    window.dispatchEvent(new CustomEvent('vault:wiped'));
  }

  setIdleMs(ms) { this.idleMs = ms; this.resetIdle(); }
}

export class DeviceFingerprinter {
  static async collect() {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px system-ui';
    ctx.fillText('777G Fingerprint ' + Date.now(), 2, 2);
    const canvasFp = canvas.toDataURL();

    const nav = navigator;
    const screen = window.screen;

    const components = [
      nav.userAgent,
      nav.language,
      nav.languages?.join(','),
      nav.hardwareConcurrency,
      nav.deviceMemory,
      nav.platform,
      nav.vendor,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      `${screen.availWidth}x${screen.availHeight}`,
      new Date().getTimezoneOffset(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasFp.slice(0, 100),
      await this._webglFingerprint(),
      await this._audioFingerprint()
    ];

    const raw = components.join('###');
    const msg = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
    const fp = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    const keccak = (data) => {
      if (window.ethers?.keccak256) return window.ethers.keccak256(data).slice(2);
      // Fallback
      let h = 0;
      for (let i = 0; i < data.length; i++) {
        h = (h * 31 + data.charCodeAt(i)) >>> 0;
      }
      return h.toString(16).padStart(64, '0');
    };

    return {
      sessionFingerprint: '0x' + keccak(fp + saltHex),
      rawFingerprint: fp,
      salt: saltHex,
      timestamp: Date.now()
    };
  }

  static async _webglFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';
      const renderer = gl.getParameter(gl.RENDERER) || '';
      const vendor = gl.getParameter(gl.VENDOR) || '';
      return `${renderer}|${vendor}`;
    } catch { return 'webgl-error'; }
  }

  static async _audioFingerprint() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const actx = new AudioContext();
      const osc = actx.createOscillator();
      const ana = actx.createAnalyser();
      osc.connect(ana);
      osc.start(0);
      osc.stop(0.01);
      await actx.close();
      return ana.frequencyBinCount.toString();
    } catch { return 'audio-error'; }
  }

  static async bindSession(privilegeLevel = 'operator') {
    const fp = await this.collect();
    const ip = await this._getIpCommitment();
    return { deviceFingerprint: fp.sessionFingerprint, ipCommitment: ip, privilegeLevel, timestamp: Date.now(), nonce: this._nonce() };
  }

  static async _getIpCommitment() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return this._commit(data.ip);
    } catch { return '0x' + '0'.repeat(64); }
  }

  static _commit(ip) {
    const keccak = (data) => {
      if (window.ethers?.keccak256) return window.ethers.keccak256(data).slice(2);
      let h = 0;
      for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) >>> 0;
      return h.toString(16).padStart(64, '0');
    };
    const salt = this._nonce();
    return '0x' + keccak(ip + '|' + salt);
  }

  static _nonce() {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export class CryptoUtils {
  static async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  }

  static async encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(ciphertext)) };
  }

  static async decrypt(encrypted, key) {
    const iv = new Uint8Array(encrypted.iv);
    const data = new Uint8Array(encrypted.data);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  }

  static randomHex(bytes = 32) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async hash(data) {
    const msg = new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export class GenesisKeyGenerator {
  static generateMasterKey() {
    const prefix = 'g3n_';
    const entropy = CryptoUtils.randomHex(32);
    return prefix + entropy;
  }

  static bindToDevice(key, deviceFingerprint) {
    return CryptoUtils.hash(key + '|' + deviceFingerprint);
  }

  static verifyBinding(key, deviceFingerprint, storedBinding) {
    return this.bindToDevice(key, deviceFingerprint) === storedBinding;
  }
}