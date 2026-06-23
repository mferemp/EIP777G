with open('C:/Users/mfere/EIP777G/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the problematic media query start
mq_start = content.find('@media (max-width: 760px), (max-height: 760px) {')
mq_end = content.find('}', mq_start) + 1

if mq_start == -1:
    print('media query start not found')
    exit(1)

# Clean media query - just the responsive footer rules
new_media_query = '''@media (max-width: 760px), (max-height: 760px) {
  .securegate-footer-branding,
  .status-right {
    right: 14px !important;
    bottom: 14px !important;
    width: 220px !important;
    transform: scale(0.86) !important;
    transform-origin: bottom right !important;
  }

  .securegate-footer-branding .thank-you-popover,
#thank-you-popover {
  bottom: 108px !important;
  }
}'''

# Replace bad media query with clean one
content = content[:mq_start] + new_media_query + content[mq_end:]

# Insert new global CSS before </style>
style_end = content.find('</style>')
if style_end == -1:
    print('</style> not found')
    exit(1)

new_css = '''

/* =========================================================
   CENTER NOTICE BOXES
   ========================================================= */

.center-notice-box {
  width: 100%;
  max-width: 760px;
  margin: 0 auto 14px auto;
  padding: 12px 16px;
  border-radius: 10px;
  text-align: center;
  box-sizing: border-box;
}

.standalone-operation-box {
  border: 1px solid rgba(0, 220, 210, 0.45);
  background: rgba(0, 220, 210, 0.08);
  box-shadow: 0 0 18px rgba(0, 220, 210, 0.12);
}

.standalone-operation-box .center-notice-title {
  color: var(--magenta);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.standalone-operation-box .center-notice-body {
  color: var(--text);
  font-size: 11px;
  line-height: 1.55;
}

.securegate-ack-box {
  border: 1px solid rgba(255, 215, 0, 0.45);
  background: rgba(255, 215, 0, 0.10);
  box-shadow: 0 0 18px rgba(255, 215, 0, 0.12);
}

.securegate-ack-box .center-notice-body {
  color: var(--gold);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.55;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* =========================================================
   LEFT COLUMN ORDER ONLY — DO NOT TOUCH BOTTOM-RIGHT
   ========================================================= */

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

.sidebar .standalone-operation-box {
  order: 4 !important;
}

.sidebar .caution-block {
  order: 5 !important;
}

/* K1 panel: only LINK DEVICE visible under K1 address */
.verify-actions-link-only .verify-scan-btn,
.verify-scan-btn.hidden {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

.verify-link-copy {
  margin-top: 7px !important;
  color: var(--teal) !important;
  font-size: 9.5px !important;
  font-weight: 800 !important;
  letter-spacing: 0.08em !important;
  line-height: 1.35 !important;
  text-transform: uppercase !important;
  text-align: center !important;
}

.artifact-sweep-list {
  margin-top: 7px !important;
  margin-bottom: 7px !important;
  color: var(--text) !important;
  font-size: 10.5px !important;
  line-height: 1.55 !important;
}

.verify-directions-copy {
  color: var(--muted) !important;
  font-size: 10.5px !important;
  line-height: 1.45 !important;
}

.session-termination-block {
  margin-top: 10px !important;
}

/* =========================================================
   FINAL BOTTOM-RIGHT FOOTER OVERRIDE
   Fixes envelope visibility, size, angle, and footer line.
   UI ONLY.
   DO NOT TOUCH BOTTOM-RIGHT. OVERRIDE ONLY.
   ========================================================= */

/* Stop the old statusbar from clipping the bottom-right branding */
.statusbar {
  position: static !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  overflow: visible !important;
  z-index: auto !important;
  pointer-events: none !important;
}

/* The actual bottom-right branding group */
.status-right.securegate-footer-branding,
.securegate-footer-branding {
  position: fixed !important;
  right: 28px !important;
  bottom: 26px !important;
  width: 250px !important;
  max-width: calc(100vw - 56px) !important;
  height: auto !important;
  min-height: 116px !important;
  z-index: 9999 !important;

  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  justify-content: flex-end !important;
  gap: 8px !important;

  overflow: visible !important;
  pointer-events: auto !important;
  transform: none !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* BIG teal envelope angled to the RIGHT */
.securegate-footer-branding .thank-you-envelope,
#thank-you-envelope.thank-you-envelope {
  position: relative !important;
  display: block !important;

  width: 142px !important;
  height: 92px !important;
  min-width: 142px !important;
  min-height: 92px !important;

  margin: 0 0 2px auto !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;

  color: var(--teal) !important;
  cursor: pointer !important;

  transform: rotate(8deg) !important;
  transform-origin: center center !important;

  opacity: 1 !important;
  visibility: visible !important;
  overflow: visible !important;
  z-index: 10000 !important;

  filter: drop-shadow(0 0 12px rgba(0, 220, 210, 0.55)) !important;
}

.securegate-footer-branding .thank-you-envelope:hover,
#thank-you-envelope.thank-you-envelope:hover {
  transform: rotate(8deg) scale(1.04) !important;
}

/* Envelope drawing */
.securegate-footer-branding .envelope-icon,
#thank-you-envelope .envelope-icon {
  position: absolute !important;
  inset: 0 !important;

  width: 142px !important;
  height: 92px !important;
  max-width: none !important;
  max-height: none !important;

  display: block !important;
  overflow: visible !important;

  stroke: var(--teal) !important;
  fill: rgba(0, 220, 210, 0.10) !important;
  stroke-width: 4 !important;
}

/* Envelope flap lines */
.securegate-footer-branding .envelope-flap,
#thank-you-envelope .envelope-flap {
  stroke: var(--teal) !important;
  stroke-width: 2.5 !important;
  fill: none !important;
  opacity: 0.5 !important;
}

/* Envelope highlight */
.securegate-footer-branding .envelope-highlight,
#thank-you-envelope .envelope-highlight {
  stroke: var(--teal) !important;
  stroke-width: 1.5 !important;
  fill: none !important;
  opacity: 0.25 !important;
}

/* =========================================================
   THANK-YOU POPOVER
   ========================================================= */

.thank-you-popover {
  position: absolute !important;
  right: 0 !important;
  bottom: 110px !important;
  width: 260px !important;
  background: rgba(255, 79, 216, 0.92) !important;
  border: 1px solid rgba(255, 79, 216, 0.9) !important;
  border-radius: 6px !important;
  padding: 10px 12px !important;
  box-shadow: 0 0 18px rgba(255, 79, 216, 0.25) !important;
  z-index: 99999 !important;
  text-align: center !important;
}

.thank-you-popover::before {
  content: '' !important;
  position: absolute !important;
  bottom: -6px !important;
  right: 20px !important;
  width: 0 !important;
  height: 0 !important;
  border-left: 6px solid transparent !important;
  border-right: 6px solid transparent !important;
  border-top: 6px solid rgba(255, 79, 216, 0.92) !important;
}

.thank-you-address {
  display: block !important;
  word-break: break-all !important;
  color: var(--magenta) !important;
  font-family: monospace !important;
  font-size: 10px !important;
  line-height: 1.35 !important;
  padding: 4px 6px !important;
  margin-bottom: 6px !important;
  background: rgba(0, 0, 0, 0.4) !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  text-align: left !important;
}

.thank-you-address:hover {
  background: rgba(255, 79, 216, 0.14) !important;
}

.thank-you-popover-hint {
  color: rgba(255, 79, 216, 0.76) !important;
  font-size: 9px !important;
  margin-top: 6px !important;
}
'''

content = content[:style_end] + new_css + content[style_end:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed CSS structure successfully')
