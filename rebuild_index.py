# Complete rebuild of index.html with all fixes
import re

with open('live/index.html', 'r') as f:
    content = f.read()

# Find the actual dashboard content (after the duplicate mess)
# The real content starts after the duplicated blocks
# Look for the actual layout end and statusbar

# Split by the duplicated blocks
# The clean content should start after the duplicated blocks end
# Find the last occurrence of </div><!-- /layout --> before STATUSBAR

parts = content.split('<!-- STATUSBAR -->')
if len(parts) < 2:
    print("Could not find STATUSBAR marker")
    exit(1)

# The part before STATUSBAR contains all the duplicated mess
# We need to extract the actual dashboard HTML from the first part
first_part = parts[0]

# Find the actual layout end
layout_end_marker = '</div><!-- /layout -->'
layout_parts = parts[0].split(layout_end_marker)
if len(layout_parts) < 2:
    print("Could not find layout end marker")
    exit(1)

# The actual dashboard content is in the first part before the duplicated blocks
# We need to reconstruct the file properly

# Let's extract the main content (from <body> to </div><!-- /layout -->)
body_match = re.search(r'<body>.*?</div><!-- /layout -->', content, re.DOTALL)
if not body_match:
    print("Could not find body content")
    exit(1)

# Actually, let's just rewrite the entire file cleanly
print("Rewriting index.html cleanly...")

with open('live/index.html', 'r') as f:
    full_content = f.read()

# Extract the main dashboard content (from <body> to before the duplicated footer mess)
# Find the last occurrence of </div><!-- /layout --> before the duplicate footer blocks
last_layout_end = content.rfind('</div><!-- /layout -->')
if last_layout_end == -1:
    print("Could not find layout end")
    exit(1)

# Get everything up to the last layout end
clean_prefix = content[:last_layout_end + len('</div><!-- /layout -->')]

# Now we need to add the proper footer and scripts
# But first, let's check if the main content has our features (K1-target, QR buttons in form area)
# If not, we need to add them to the form area

# For now, let's just fix the footer properly and deploy
# The main features (K1-target, QR buttons in form area) are already in the main content

# Check if QR buttons are in the form area (they were added to the form-grid area)
# Check if disclaimer/thank-you blocks exist after the layout end

# The file currently has duplicated disclaimer/thank-you blocks at the START
# We need to remove those and add them at the END (after layout, before STATUSBAR)

# Let's reconstruct: take content up to the first duplicated block, then add proper footer

# Find where the duplicated blocks start (first DISCLAIMER OVERLAY at line 1 of the current file)
# The clean content should be everything from <!DOCTYPE html> through the layout end
# Then we add proper footer, then STATUSBAR, then scripts

# Let's extract the clean content from the original backup
print("Restoring from backup and applying clean patches...")

with open('live/index.html.backup', 'r') as f:
    backup = f.read()

# Apply clean patches to backup
print("Applying clean patches to backup...")

# 1. K1-TARGET WALLET after k1-key
old_k1 = '''        <div class="form-group">
          <label class="form-label">K1 Key <span style="color:var(--muted);font-weight:400">(will be nullified)</span></label>
          <div class="input-wrap">
            <input class="form-input" type="password" id="k1-key" placeholder="0x..." autocomplete="off">
            <button class="input-eye" onclick="toggleVis('k1-key',this)" tabindex="-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div id="k1-addr" style="font-size:8px;color:var(--teal);margin-top:2px;font-family:monospace;word-break:break-all;min-height:12px;"></div>
        </div>

        <div class="form-group">'''

new_k1 = '''        <div class="form-group">
          <label class="form-label">K1 Key <span style="color:var(--muted);font-weight:400">(will be nullified)</span></label>
          <div class="input-wrap">
            <input class="form-input" type="password" id="k1-key" placeholder="0x..." autocomplete="off">
            <button class="input-eye" onclick="toggleVis('k1-key',this)" tabindex="-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div id="k1-addr" style="font-size:8px;color:var(--teal);margin-top:2px;font-family:monospace;word-break:break-all;min-height:12px;"></div>
        </div>

        <!-- K1-TARGET WALLET -->
        <div class="form-group" id="k1-target-group" style="transition: opacity 0.3s ease, height 0.3s ease, margin 0.3s ease, padding 0.3s ease; overflow: hidden;">
          <label class="form-label">K1-TARGET WALLET <span style="color:var(--muted);font-weight:400">(auto-filled on K1 entry)</span></label>
          <input class="form-input" type="text" id="k1-target-wallet" placeholder="EVM 0x..." readonly style="color:var(--teal); background: #1a1a1a; font-family: monospace;">
        </div>

        <div class="form-group">'''

backup = backup.replace(old_k1, new_k1)
print("1. K1-TARGET WALLET added to backup")

# 2. Add SCAN + QR CODE buttons in sidebar (Genesis Verification area)
# Find the scan-wrap in sidebar and add QR button there
old_sidebar_scan = '''    <!-- SCAN BUTTON -->
    <div class="scan-wrap">
      <div class="scan-btn-outer" id="scan-btn-outer" onclick="startScan()">
        <div class="scan-ring" id="scan-ring"></div>
        <div class="scan-ring2"></div>
        <div class="scan-inner" id="scan-inner">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          <span>SCAN</span>
        </div>
      </div>
      <div class="scan-label">OWNER VERIFICATION</div>
      <div class="scan-sublabel" id="scan-status">Genesis ownership scan<br>initiates authentication</div>
    </div>'''

new_sidebar_scan = '''    <!-- SCAN BUTTON -->
    <div class="scan-wrap">
      <div class="scan-btn-outer" id="scan-btn-outer" onclick="startScan()">
        <div class="scan-ring" id="scan-ring"></div>
        <div class="scan-ring2"></div>
        <div class="scan-inner" id="scan-inner">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          <span>SCAN</span>
        </div>
      </div>
      <div class="scan-label">OWNER VERIFICATION</div>
      <div class="scan-sublabel" id="scan-status">Genesis ownership scan<br>initiates authentication</div>
    </div>

    <!-- QR CODE BUTTON (in sidebar) -->
    <div style="margin-top: 8px;">
      <button class="btn" id="qr-code-btn-sidebar" onclick="toggleQRCircle()" style="width:100%; padding:10px 16px; font-size:10px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; clip-path:polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); background:transparent; border:1px solid var(--magenta); color:var(--magenta); transition:all 0.15s; box-shadow: 0 0 0 rgba(255,45,120,0); transition: box-shadow 1.5s ease-in-out infinite;">
        QR CODE
      </button>
    </div>'''

if old_sidebar_scan in backup:
    backup = backup.replace(old_sidebar_scan, new_sidebar_scan)
    print("Sidebar QR button added")
else:
    print("Sidebar scan block not found")

# Add CSS animations
old_css = '''  .scanning .scan-ring { animation: spin-ring 0.5s linear infinite; }
  .scanning .scan-inner { background: radial-gradient(circle, #003d38 0%, #000 100%) !important; }
</style>'''

new_css = '''  .scanning .scan-ring { animation: spin-ring 0.5s linear infinite; }
  .scanning .scan-inner { background: radial-gradient(circle, #003d38 0%, #000 100%) !important; }

  @keyframes qrPulse {
    0%, 100% { box-shadow: 0 0 16px 2px rgba(255,45,120,0.3); border-color: var(--magenta); }
    50% { box-shadow: 0 0 32px 8px rgba(255,45,120,0.6); border-color: var(--magenta2); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>'''

if old_css in backup:
    backup = backup.replace(old_css, new_css)
    print("CSS animations added")
else:
    print("CSS block not found")

# Replace footer
old_footer = '''<!-- STATUSBAR -->
<div class="statusbar">
  <div>
    <span class="status-dot dot-secure"></span>
    <span id="status-text">777G v1.0 · SECURE</span>
  </div>
  <div id="status-right" style="color:var(--faint);">STANDALONE MODE · NO SERVER CONTACT</div>
</div>'''

new_footer = '''</div><!-- /layout -->

<!-- DISCLAIMER OVERLAY -->
<div id="disclaimer-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.92); backdrop-filter:blur(8px); z-index:150; align-items:center; justify-content:center; animation:fadeIn 0.4s ease;">
  <div style="position:relative; max-width:720px; width:90%; border:2px solid #c9a227; border-radius:8px; background:rgba(12,8,0,0.95); box-shadow:0 0 48px 8px rgba(201,162,39,0.25), inset 0 0 48px rgba(201,162,39,0.08); padding:32px 28px; font-family:'Satoshi',monospace; text-align:center;">
    <button onclick="closeDisclaimer()" style="position:absolute; top:8px; right:12px; background:transparent; border:1px solid #c9a227; color:#c9a227; padding:4px 10px; border-radius:3px; font-size:10px; font-weight:700; font-family:monospace; cursor:pointer; letter-spacing:0.1em; transition:all 0.15s;" onmouseover="this.style.background='#c9a227';this.style.color='#000'" onmouseout="this.style.background='transparent';this.style.color='#c9a227'">DISMISS</button>
    <div style="margin-bottom:16px;">
      <span style="font-size:11px; font-weight:900; letter-spacing:0.1em; color:#c9a227; font-family:monospace; text-shadow:0 0 12px rgba(201,162,39,0.6);">⚠ DISCLAIMER</span>
    </div>
    <p style="font-size:13px; font-weight:700; letter-spacing:0.04em; color:#c9a227; line-height:1.6; margin-bottom:8px; font-family:monospace;">
      BY USING SECUREGATE YOU ACKNOWLEDGE YOU ALREADY MADE A POOR LIFE CHOICE...
    </p>
    <p style="font-size:11px; color:var(--muted); line-height:1.7; margin-bottom:20px; font-family:monospace;">
      No refunds. No support. No guarantees. You are the sole custodian of your keys.<br>
      The contract is obfuscated. The gate is final. The sweep is absolute.<br>
      <span style="color:#c9a227;">⚫-'</span>
    </p>
    <div style="margin-top:16px; padding-top:16px; border-top:1px solid #3a2a00;">
      <a href="https://x.com/hope_ology" target="_blank" rel="noopener" style="font-size:9px; font-weight:700; color:#c9a227; text-decoration:none; letter-spacing:0.08em; font-family:monospace;" onclick="event.stopPropagation();">@hope_ology</a>
      <span style="color:var(--faint); margin:0 12px;">|</span>
      <button id="thank-you-btn-overlay" onclick="openThankYouNote(); closeDisclaimer();" style="background:#c9a227; color:#000; border:none; padding:8px 20px; font-size:9px; font-weight:700; font-family:monospace; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; border-radius:3px; clip-path:polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); transition:all 0.15s;">THANK YOU</button>
    </div>
  </div>
</div>

<!-- THANK YOU STICKY NOTE MODAL -->
<div id="thank-you-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(6px); z-index:200; align-items:center; justify-content:center; animation:fadeIn 0.3s ease;">
  <div style="position:relative; width:380px; max-width:90%; background:linear-gradient(135deg, #1a1a0a 0%, #0f0f05 100%); border:2px solid #c9a227; border-radius:8px; box-shadow:0 0 48px 8px rgba(201,162,39,0.25); padding:24px; font-family:'Satoshi',sans-serif; transform:rotate(-1.5deg); animation:fadeIn 0.3s ease;">
    <div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%) rotate(-2deg); width:60px; height:20px; background:rgba(201,162,39,0.3); border-radius:4px 4px 0 0; box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
    <h3 style="font-size:11px; font-weight:900; letter-spacing:0.15em; color:#c9a227; margin-bottom:16px; text-transform:uppercase; font-family:monospace;">SEND A THANK YOU</h3>
    <textarea id="thank-you-message" placeholder="Type your message..." style="width:100%; min-height:80px; background:#0a0a0a; border:1px solid #2a1a00; border-radius:4px; padding:12px; color:var(--text); font-family:'Satoshi',monospace; font-size:12px; line-height:1.6; resize:vertical; outline:none; transition:border-color 0.15s;" onfocus="this.style.borderColor='#c9a227'"></textarea>
    <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
      <button onclick="closeThankYouNote()" style="background:transparent; border:1px solid #3a2a00; color:var(--muted); padding:8px 16px; font-size:9px; font-weight:700; font-family:monospace; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; border-radius:3px; clip-path:polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%); transition:all 0.15s;">CANCEL</button>
      <button onclick="sendThankYouNote()" style="background:#c9a227; color:#000; border:none; padding:8px 20px; font-size:9px; font-weight:700; font-family:monospace; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; border-radius:3px; clip-path:polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); transition:all 0.15s;">SEND</button>
    </div>
    <div id="thank-you-wallet-section" style="display:none; margin-top:20px; padding-top:16px; border-top:1px solid #3a2a00;">
      <div style="font-size:8px; font-weight:700; letter-spacing:0.15em; color:var(--gold); margin-bottom:8px; text-transform:uppercase;">THANK YOU WALLET (COPY)</div>
      <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
        <input type="text" id="thank-you-wallet-display" value="0xA0eb06a5fab172860837C4D68e75F339896500b5" readonly style="flex:1; background:#0a0a0a; border:1px solid #2a1a00; border-radius:3px; padding:8px 10px; font-size:10px; font-family:monospace; color:var(--teal);">
        <button onclick="copyThankYouWallet()" style="background:#c9a227; color:#000; border:none; padding:8px 14px; font-size:8px; font-weight:700; font-family:monospace; letter-spacing:0.1em; text-transform:uppercase; cursor:pointer; border-radius:3px; clip-path:polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%); transition:all 0.15s;">COPY</button>
      </div>
      <p id="thank-you-copy-status" style="font-size:8px; color:var(--teal); margin-top:6px; min-height:10px; font-family:monospace;"></p>
    </div>
  </div>
</div>

<!-- STATUSBAR -->
<div class="statusbar">
  <div style="display:flex; align-items:center; gap:8px;">
    <span class="status-dot dot-secure"></span>
    <span id="status-text">777G v1.0 · SECURE</span>
  </div>
  <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; justify-content:flex-end;">
    <!-- Teal tilted envelope + THANK YOU -->
    <div id="thank-you-btn" onclick="openThankYouNote()" style="display:flex; align-items:center; gap:6px; cursor:pointer; transform: rotate(-8deg); transition: transform 0.2s;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" style="transform: rotate(-15deg);">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
      <span style="font-size:9px; font-weight:700; letter-spacing:0.1em; color:var(--teal); white-space:nowrap;">THANK YOU</span>
    </div>
    <div style="display:flex; align-items:center; gap:8px; transform: rotate(2deg);">
      <span style="font-size:9px; font-weight:700; letter-spacing:0.08em; color:var(--gold);">BUILT BY EMP</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.8">
        <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z" stroke-width="0.5" opacity="0.3"/>
        <path d="M12 6.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5 5.5-2.5 5.5-5.5-2.5-5.5-5.5-5.5z" stroke-width="0.5" opacity="0.3"/>
        <path d="M12 17.5c3 0 5.5-2.5 5.5-5.5s-2.5-5.5-5.5-5.5-5.5 2.5-5.5 5.5 2.5 5.5 5.5 5.5z" stroke-width="0.5" opacity="0.3"/>
        <path d="M8.5 12c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5S8.5 13.9 8.5 12z"/>
        <path d="M15.5 12c0 1.9-1.6 3.5-3.5 3.5s-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5S15.5 10.1 15.5 12z"/>
        <path d="M12 8.5c1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5z"/>
      </svg>
      <a href="https://x.com/hope_ology" target="_blank" rel="noopener" style="font-size:9px; font-weight:600; color:var(--gold); text-decoration:none; letter-spacing:0.05em;" onclick="event.stopPropagation();">@hope_ology</a>
    </div>
  </div>
</div>'''

if old_footer in backup:
    backup = backup.replace(old_footer, new_footer)
    print("Footer replaced successfully")
else:
    print("Footer block not found - checking current structure...")

# Add JS functions at the end (before </body>)
old_scripts = '''</script>
</body>
</html>'''

new_scripts = '''<script>
// ── CUSTOM FUNCTIONS FOR NEW FEATURES ──
(function() {
  'use strict';

  // K1-TARGET WALLET: fade out when K1 key is entered
  const k1KeyInput = document.getElementById('k1-key');
  const k1TargetGroup = document.getElementById('k1-target-group');
  const k1TargetWallet = document.getElementById('k1-target-wallet');

  if (k1KeyInput && k1TargetGroup && k1TargetWallet) {
    k1KeyInput.addEventListener('input', function() {
      if (this.value.length > 0) {
        k1TargetGroup.style.opacity = '0';
        k1TargetGroup.style.height = '0';
        k1TargetGroup.style.margin = '0';
        k1TargetGroup.style.padding = '0';
        k1TargetGroup.style.pointerEvents = 'none';
      } else {
        k1TargetGroup.style.opacity = '1';
        k1TargetGroup.style.height = 'auto';
        k1TargetGroup.style.margin = '';
        k1TargetGroup.style.padding = '';
        k1TargetGroup.style.pointerEvents = 'auto';
      }
    });
  }

  // QR CODE CIRCLE
  const qrCircleOverlay = document.getElementById('qr-circle-overlay');
  const qrCanvasMain = document.getElementById('qr-canvas-main');
  let qrCodeInstanceMain = null;

  window.toggleQRCircle = function() {
    if (qrCircleOverlay.style.display === 'flex') {
      closeQRCircle();
    } else {
      qrCircleOverlay.style.display = 'flex';
      // Generate QR code
      if (!qrCodeInstanceMain && typeof QRCode !== 'undefined') {
        qrCodeInstanceMain = new QRCode(qrCanvasMain, {
          text: window.location.href,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }
  };

  window.closeQRCircle = function() {
    qrCircleOverlay.style.display = 'none';
  };

  // Close on background click
  if (qrCircleOverlay) {
    qrCircleOverlay.addEventListener('click', function(e) {
      if (e.target === qrCircleOverlay) closeQRCircle();
    });
  }

  // DISCLAIMER OVERLAY
  const disclaimerOverlay = document.getElementById('disclaimer-overlay');

  window.closeDisclaimer = function() {
    if (disclaimerOverlay) disclaimerOverlay.style.display = 'none';
  };

  // Show disclaimer on load (once per session)
  if (disclaimerOverlay && !sessionStorage.getItem('disclaimer_shown')) {
    setTimeout(function() {
      disclaimerOverlay.style.display = 'flex';
      sessionStorage.setItem('disclaimer_shown', '1');
    }, 2000);
  }

  // THANK YOU STICKY NOTE MODAL
  const thankYouModal = document.getElementById('thank-you-modal');
  const thankYouBtn = document.getElementById('thank-you-btn');
  const thankYouBtnOverlay = document.getElementById('thank-you-btn-overlay');
  const thankYouMessage = document.getElementById('thank-you-message');
  const thankYouWalletSection = document.getElementById('thank-you-wallet-section');
  const thankYouWalletDisplay = document.getElementById('thank-you-wallet-display');
  const thankYouCopyStatus = document.getElementById('thank-you-copy-status');

  function openThankYouNote() {
    if (thankYouModal) {
      thankYouModal.style.display = 'flex';
      if (thankYouMessage) thankYouMessage.focus();
    }
  }

  function closeThankYouNote() {
    if (thankYouModal) {
      thankYouModal.style.display = 'none';
      if (thankYouMessage) thankYouMessage.value = '';
      if (thankYouWalletSection) thankYouWalletSection.style.display = 'none';
      if (thankYouCopyStatus) thankYouCopyStatus.textContent = '';
    }
  }

  // Wire up buttons
  var thankYouBtnEl = document.getElementById('thank-you-btn');
  var thankYouBtnOverlay = document.getElementById('thank-you-btn-overlay');
  if (thankYouBtnEl) thankYouBtnEl.onclick = function() { 
    var modal = document.getElementById('thank-you-modal');
    if (modal) { modal.style.display = 'flex'; var msg = document.getElementById('thank-you-message'); if (msg) msg.focus(); }
  };
  var overlayBtn = document.getElementById('thank-you-btn-overlay');
  if (overlayBtn) overlayBtn.onclick = function() { 
    var modal = document.getElementById('thank-you-modal');
    if (modal) { modal.style.display = 'flex'; var msg = document.getElementById('thank-you-message'); if (msg) msg.focus(); }
  };

  // Close on background click
  var modal = document.getElementById('thank-you-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        var msg = document.getElementById('thank-you-message');
        if (msg) msg.value = '';
        var ws = document.getElementById('thank-you-wallet-section');
        if (ws) ws.style.display = 'none';
        var cs = document.getElementById('thank-you-copy-status');
        if (cs) cs.textContent = '';
        modal.style.display = 'none';
      }
    });
  }

  // SEND THANK YOU NOTE (email via mailto)
  window.sendThankYouNote = function() {
    var msg = document.getElementById('thank-you-message');
    var message = msg ? msg.value.trim() : '';
    if (!message) { alert('Please enter a message.'); return; }
    var email = 'mferemp@gmail.com';
    var subject = encodeURIComponent('SecureGate Thank You Note');
    var body = encodeURIComponent(message + '\\n\\n---\\nSent from SecureGate 777G Dashboard');
    window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    
    var ws = document.getElementById('thank-you-wallet-section');
    if (ws) ws.style.display = 'block';
    var msg = document.getElementById('thank-you-message');
    if (msg) msg.disabled = true;
  };

  // COPY WALLET
  window.copyThankYouWallet = function() {
    var walletEl = document.getElementById('thank-you-wallet-display');
    var statusEl = document.getElementById('thank-you-copy-status');
    var wallet = walletEl ? walletEl.value : '';
    if (wallet && navigator.clipboard) {
      navigator.clipboard.writeText(wallet).then(function() {
        var statusEl = document.getElementById('thank-you-copy-status');
        if (statusEl) {
          statusEl.textContent = '✓ Copied to clipboard';
          statusEl.style.color = 'var(--teal)';
        }
      }).catch(function() {
        var statusEl = document.getElementById('thank-you-copy-status');
        if (statusEl) {
          statusEl.textContent = '✗ Copy failed';
          statusEl.style.color = 'var(--magenta)';
        }
      });
    }
  };

  // Close modal on background click
  var modal = document.getElementById('thank-you-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        var msg = document.getElementById('thank-you-message');
        if (msg) msg.value = '';
        var ws = document.getElementById('thank-you-wallet-section');
        if (ws) ws.style.display = 'none';
        var cs = document.getElementById('thank-you-copy-status');
        if (cs) cs.textContent = '';
        modal.style.display = 'none';
      }
    });
  }

  // DISCLAIMER OVERLAY
  var disclaimerOverlay = document.getElementById('disclaimer-overlay');
  window.closeDisclaimer = function() {
    var d = document.getElementById('disclaimer-overlay');
    if (d) d.style.display = 'none';
  };

  // Show disclaimer on load (once per session)
  if (disclaimerOverlay && !sessionStorage.getItem('disclaimer_shown')) {
    setTimeout(function() {
      var d = document.getElementById('disclaimer-overlay');
      if (d) d.style.display = 'flex';
      sessionStorage.setItem('disclaimer_shown', '1');
    }, 2000);
  }

  // QR CODE CIRCLE
  var qrCircleOverlay = document.getElementById('qr-circle-overlay');
  var qrCanvasMain = document.getElementById('qr-canvas-main');
  var qrCodeInstanceMain = null;

  window.toggleQRCircle = function() {
    var overlay = document.getElementById('qr-circle-overlay');
    if (!overlay) return;
    if (overlay.style.display === 'flex') {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'flex';
      if (!qrCodeInstanceMain && typeof QRCode !== 'undefined') {
        var canvas = document.getElementById('qr-canvas-main');
        if (canvas && typeof QRCode !== 'undefined') {
          qrCodeInstanceMain = new QRCode(canvas, {
            text: window.location.href,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      }
    }
  };

  window.closeQRCircle = function() {
    var overlay = document.getElementById('qr-circle-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  // Close on background click
  var qrOverlay = document.getElementById('qr-circle-overlay');
  if (qrOverlay) {
    qrOverlay.addEventListener('click', function(e) {
      if (e.target === qrOverlay) {
        var o = document.getElementById('qr-circle-overlay');
        if (o) o.style.display = 'none';
      }
    });
  }

  // K1-TARGET WALLET: fade out when K1 key is entered
  var k1KeyInput = document.getElementById('k1-key');
  var k1TargetGroup = document.getElementById('k1-target-group');
  var k1TargetWallet = document.getElementById('k1-target-wallet');

  if (k1KeyInput && k1TargetGroup && k1TargetWallet) {
    k1KeyInput.addEventListener('input', function() {
      if (this.value.length > 0) {
        k1TargetGroup.style.opacity = '0';
        k1TargetGroup.style.height = '0';
        k1TargetGroup.style.margin = '0';
        k1TargetGroup.style.padding = '0';
        k1TargetGroup.style.pointerEvents = 'none';
      } else {
        k1TargetGroup.style.opacity = '1';
        k1TargetGroup.style.height = 'auto';
        k1TargetGroup.style.margin = '';
        k1TargetGroup.style.padding = '';
        k1TargetGroup.style.pointerEvents = 'auto';
      }
    });
  }

})();
</script>
</body>
</html>'''

if old_scripts in backup:
    backup = backup.replace(old_scripts, new_scripts)
    print("JS functions added")
else:
    print("Scripts block not found")

# Write the final rebuilt file
with open('live/index.html', 'w') as f:
    f.write(backup)

print("Final file written successfully")
