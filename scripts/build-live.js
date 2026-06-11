#!/usr/bin/env node
/**
 * SecureGate v1 — live dashboard build
 * Strips source-export UI, minifies/obfuscates served HTML.
 * Owner: Empress (@Hope_ology)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'operator', 'source', 'index.html');
const OUT_DIR = path.join(ROOT, 'live');
const OUT = path.join(OUT_DIR, 'index.html');

function stripLiveSections(html) {
  let out = html;
  let prev;
  do {
    prev = out;
    out = out.replace(
      /(?:<!--\s*SG_LIVE_REMOVE_START\s*-->|\s*\/\*\s*SG_LIVE_REMOVE_START\s*\*\/)[\s\S]*?(?:<!--\s*SG_LIVE_REMOVE_END\s*-->|\s*\/\*\s*SG_LIVE_REMOVE_END\s*\*\/)/g,
      ''
    );
  } while (out !== prev);
  return out;
}

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function stripScriptComments(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function minifyInlineScripts(html) {
  return html.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if ((attrs || '').includes('src=')) return full;
    let js = stripScriptComments(body);
    js = js.replace(/\s+/g, ' ').trim();
    return `<script${attrs || ''}>${js}</script>`;
  });
}

function minifyHtml(html) {
  return html
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function build() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing operator/source/index.html');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let html = fs.readFileSync(SRC, 'utf8');
  html = stripLiveSections(html);
  html = stripHtmlComments(html);
  html = minifyInlineScripts(html);
  html = minifyHtml(html);
  html = html.replace(/LIVE_PUBLIC_ACCESS\s*=\s*!?0|LIVE_PUBLIC_ACCESS\s*=\s*false/g, 'LIVE_PUBLIC_ACCESS=!0');

  const forbidden = [
    'owner-code-panel',
    'exportDashboardBox',
    'ownerCodeBox',
    'exportManifestBox',
    'exportAckBox',
    'CodePanel',
    'ExportBundle',
    'showSourceUnlock',
    'id="identity-overlay"',
    'id="idSecret"',
    'id="idFingerprint"',
    'placeholder="Origin vector"',
    'placeholder="Epoch marker"',
    'id="veilPassphrase"',
    'Load wired defaults',
    'id="guide-overlay"',
    'id="ownership-overlay"',
    'Who owns this?',
    'BEGIN FILE:',
    'operator/source',
    'SG_LIVE_REMOVE',
  ];
  for (const token of forbidden) {
    if (html.includes(token)) {
      console.error(`Live build validation failed — forbidden token present: ${token}`);
      process.exit(1);
    }
  }
  if (!html.includes('SECUREGATE') && !html.includes('SecureGate')) {
    console.error('Live build validation failed — SecureGate branding missing');
    process.exit(1);
  }
  if (!html.includes('PUBLIC_WIRING')) {
    console.error('Live build validation failed — PUBLIC_WIRING missing');
    process.exit(1);
  }
  if (!html.includes('LIVE_PUBLIC_ACCESS=!0') && !html.includes('LIVE_PUBLIC_ACCESS=true')) {
    console.error('Live build validation failed — LIVE_PUBLIC_ACCESS not enabled');
    process.exit(1);
  }

  fs.writeFileSync(OUT, html, 'utf8');
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`Live dashboard built → live/index.html (${kb} KB)`);
}

build();