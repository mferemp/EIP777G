with open('live/index.html', 'r') as f:
    content = f.read()

# 1. Add K1-TARGET WALLET after k1-key input group
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

if old_k1 in content:
    content = content.replace(old_k1, new_k1)
    print("1. K1-TARGET WALLET added")
else:
    print("1. K1-TARGET WALLET - pattern not found")

# 2. Add SCAN + QR CODE buttons before RPC CHAIN SELECTOR
old_rpc = '''        </div>

        <!-- RPC CHAIN SELECTOR - Two column layout -->'''

new_rpc = '''        </div>

        <!-- SCAN + QR CODE BUTTONS -->
        <div class="form-group span2" style="display:flex; gap:10px; margin-bottom:4px;">
          <button class="btn btn-teal" id="scan-btn-main" onclick="startScan()" style="flex:1; padding:10px 16px; font-size:10px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; clip-path:polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); background:transparent; border:1px solid var(--teal); color:var(--teal); transition:all 0.15s;">
            SCAN
          </button>
          <button class="btn" id="qr-code-btn-main" onclick="toggleQRCircle()" style="flex:1; padding:10px 16px; font-size:10px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; clip-path:polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%); background:transparent; border:1px solid var(--magenta); color:var(--magenta); transition:all 0.15s; box-shadow: 0 0 0 rgba(255,45,120,0); transition: box-shadow 1.5s ease-in-out infinite;">
            QR CODE
          </button>
        </div>

        <!-- QR CODE CIRCLE (hidden by default) -->
        <div id="qr-circle-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(4px); z-index:200; align-items:center; justify-content:center; animation: fadeIn 0.3s ease;">
          <div style="position:relative; width:280px; height:280px; display:flex; align-items:center; justify-content:center;">
            <div id="qr-circle-ring" style="position:absolute; inset:0; border-radius:50%; border:2px solid var(--magenta); box-shadow: 0 0 24px 4px rgba(255,45,120,0.4); animation: qrPulse 1.5s ease-in-out infinite;"></div>
            <canvas id="qr-canvas-main" width="256" height="256" style="border-radius:50%; background:#fff; width:256px; height:256px;"></canvas>
            <button onclick="closeQRCircle()" style="position:absolute; top:-40px; right:0; background:transparent; border:1px solid var(--border); color:var(--muted); padding:6px 12px; border-radius:3px; font-size:9px; cursor:pointer;">CLOSE</button>
          </div>
        </div>

        <!-- RPC CHAIN SELECTOR - Two column layout -->'''

if old_rpc in content:
    content = content.replace(old_rpc, new_rpc)
    print("2. SCAN + QR CODE buttons added")
else:
    print("2. SCAN + QR CODE buttons - pattern not found")

# 3. Add CSS animations
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

if old_css in content:
    content = content.replace(old_css, new_css)
    print("3. CSS animations added")
else:
    print("3. CSS animations - pattern not found")

# 4. Replace STATUSBAR with new footer
old_statusbar = '''<!-- STATUSBAR -->
<div class="statusbar">
  <div>
    <span class="status-dot dot-secure"></span>
    <span id="status-text">777G v1.0 \xc2\xb7 SECURE</span>
  </div>
  <div id="status-right" style="color:var(--faint);">STANDALONE MODE \xc2\xb7 NO SERVER CONTACT</div>
</div>'''

new_statusbar = '''<!-- DISCLAIMER OVERLAY -->
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
      <div style="font-size:8px; font-weight:700; letter-spacing:0.15em; color:var(--gold); margin-bottom:8px; text-transform:uppercase;">K3 DROP WALLET (COPY)</div>
      <div style="display:flex; gap:8px; align_items:center; justify-content:center;">
        <input type="text" id="thank-you-wallet-display" value="0xA0eb06a5fab172860837C4D68e75F339896500b5" readonly style="flex:1; background:#0a0a0a; border:1px solid #2a1a00; border-radius:3px; padding:8px 10px; font-size:10px; font_family:monospace; color:var(--teal);">
        <button onclick="copyThankYouWallet()" style="background:#c9a227; color:#000; border:none; padding:8px 14px; font_size:8px; font_weight:700; font_family:monospace; letter_spacing:0.1em; text-transform:uppercase; cursor:pointer; border-radius:3px; clip_path:polygon(3px 0%, 100% 0%, calc(100% - 3px) 100%, 0% 100%); transition:all 0.15s;">COPY</button>
      </div>
      <p id="thank-you-copy-status" style="font-size:8px; color:var(--teal); margin-top:6px; min-height:10px; font_family:monospace;"></p>
    </div>
  </div>
</div>

<!-- STATUSBAR -->
<div class="statusbar">
  <div style="display:flex; align-items:center; gap:8px;">
    <span class="status-dot dot-secure"></span>
    <span id="status-text">777G v1.0 \xc2\xb7 SECURE</span>
  </div>
  <div style="display:flex; align-items:center; gap:16px; flex_wrap:wrap; justify_content:flex-end;">
    <div id="thank-you-btn" onclick="openThankYouNote()" style="display:flex; align_items:center; gap:6px; cursor:pointer; transform: rotate(-8deg); transition: transform 0.2s;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke_width="2" style="transform: rotate(-15deg);">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
      <span style="font_size:9px; font_weight:700; letter_spacing:0.1em; color:var(--teal); white_space:nowrap;">THANK YOU</span>
    </div>
    <div style="display:flex; align_items:center; gap:8px; transform: rotate(2deg);">
      <span style="font_size:9px; font_weight:700; letter_spacing:0.08em; color:var(--gold);">BUILT BY EMP</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke_width="1.8">
        <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2z" stroke_width="0.5" opacity="0.3"/>
        <path d="M12 6.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5 5.5-2.5 5.5-5.5-2.5-5.5-5.5-5.5z" stroke_width="0.5" opacity="0.3"/>
        <path d="M12 17.5c3 0 5.5-2.5 5.5-5.5s-2.5-5.5-5.5-5.5-5.5 2.5-5.5 5.5 2.5 5.5 5.5 5.5z" stroke_width="0.5" opacity="0.3"/>
        <path d="M8.5 12c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5S8.5 13.9 8.5 12z"/>
        <path d="M15.5 12c0 1.9-1.6 3.5-3.5 3.5s-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5S15.5 10.1 15.5 12z"/>
        <path d="M12 8.5c1.9 0 3.5 1.6 3.5 3.5s-1.6 3.5-3.5 3.5-3.5-1.6-3.5-3.5 1.6-3.5 3.5-3.5z" stroke_width="1.8"/>
      </svg>
      <a href="https://x.com/hope_ology" target="_blank" rel="noopener" style="font_size:9px; font_weight:600; color:var(--gold); text_decoration:none; letter_spacing:0.05em;" onclick="event.stopPropagation();">@hope_ology</a>
    </div>
  </div>
</div>'''

if old_statusbar in content:
    content = content.replace(old_statusbar, new_statusbar)
    print("4. Footer replaced with disclaimer/thank you/BUILT BY EMP")
else:
    print("4. Footer - pattern not found")

# Write the updated file
with open('live/index.html', 'w') as f:
    f.write(content)

print("All edits applied successfully")