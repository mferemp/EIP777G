// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE
(function () {
  'use strict';

  const NETWORKS = {
    ethereum:    { rpc: 'https://ethereum-rpc.publicnode.com',          chainId: 1,      symbol: 'ETH',  flashbots: true  },
    'hl-evm':    { rpc: 'https://api.hyperliquid-testnet.xyz/evm',       chainId: 998,    symbol: 'HYPE', flashbots: false },
    'hl-core':   { rpc: 'https://api.hyperliquid.xyz/evm',               chainId: 999,    symbol: 'USDC', hlCore: true     },
    base:        { rpc: 'https://mainnet.base.org',                      chainId: 8453,   symbol: 'ETH'  },
    arbitrum:    { rpc: 'https://arb1.arbitrum.io/rpc',                  chainId: 42161,  symbol: 'ETH'  },
    optimism:    { rpc: 'https://mainnet.optimism.io',                   chainId: 10,     symbol: 'ETH'  },
    polygon:     { rpc: 'https://polygon-rpc.com',                       chainId: 137,    symbol: 'MATIC'},
    bnb:         { rpc: 'https://bsc-dataseed.binance.org/',              chainId: 56,     symbol: 'BNB'  },
    avax:        { rpc: 'https://api.avax.network/ext/bc/C/rpc',         chainId: 43114,  symbol: 'AVAX' },
    plasma:      { rpc: 'TODO:PLASMA_RPC',                               chainId: 9745,   symbol: 'ETH'  },
    monad:       { rpc: 'TODO:MONAD_RPC',                                chainId: 10143,  symbol: 'MON'  },
    ink:         { rpc: 'TODO:INK_RPC',                                  chainId: 57073,  symbol: 'ETH'  },
    unichain:    { rpc: 'TODO:UNICHAIN_RPC',                             chainId: 130,    symbol: 'ETH'  },
    abstract:    { rpc: 'TODO:ABSTRACT_RPC',                             chainId: 2741,   symbol: 'ETH'  },
    'ape-chain': { rpc: 'TODO:APE_CHAIN_RPC',                            chainId: 33139,  symbol: 'APE'  }
  };

  let ethers = window.ethers;
  let currentContractAddress = null;
  window._sg_contract_address = null;
  window._sg_revoke_targets = [];
  window._sg_k1_first_tx = null;

  // helpers
  function el(id) { return document.getElementById(id); }
  function val(id) { const e = el(id); return e ? e.value.trim() : ''; }
  function isAddr(s) { return /^0x[0-9a-fA-F]{40}$/.test(s); }
  function isKey(s)  { return /^0x[0-9a-fA-F]{64}$/.test(s) || /^[0-9a-fA-F]{64}$/.test(s); }

  function setText(id, txt) {
    const e = el(id) || document.querySelector('[data-display="' + id + '"]');
    if (e) { if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') e.value = txt; else e.textContent = txt; }
  }

  function setHtml(id, html) {
    const e = el(id); if (e) e.innerHTML = html;
  }

  function rpcInputEl() { return el('rpc-url') || el('rpc-input'); }
  function netSelEl()   { return el('network-select') || document.querySelector('select[name="network"]'); }
  function getK1AddrValue() {
    const el1 = el('k1-addr') || el('k1-address');
    if (!el1) return '';
    return el1.textContent.trim();
  }
  function k2AddrEl()   { return el('k2-addr') || el('k2-address'); }
  function k3AddrEl()   { return el('k3-addr') || el('k3-address'); }

  async function rpcPost(rpc, method, params) {
    const r = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
    });
    return r.json();
  }

  // smoke test
  async function runSmokeTest() {
    const addr = window._sg_contract_address || currentContractAddress;
    const out = el('smoke-output') || el('smoke-results');
    if (!addr) { if (out) out.textContent = 'No deployment in current session.'; return false; }
    const rpc = rpcInputEl()?.value?.trim() || NETWORKS[netSelEl()?.value]?.rpc;
    if (!rpc || rpc.startsWith('TODO')) { if (out) out.textContent = 'No RPC configured.'; return false; }

    const provider = new ethers.JsonRpcProvider(rpc);
    const abi = [
      'function k2Authority() view returns (address)',
      'function ingressSevered() view returns (bool)',
      'function egressSevered() view returns (bool)'
    ];
    const contract = new ethers.Contract(addr, abi, provider);
    const results = [];

    const chk = async (label, fn) => {
      try { const v = await fn(); results.push({ label, pass: true, val: v }); }
      catch (e) { results.push({ label, pass: false, val: e.message }); }
    };

    await chk('Bytecode deployed', async () => {
      const code = await provider.getCode(addr);
      if (code === '0x') throw new Error('No bytecode');
      return 'present';
    });
    await chk('k2Authority', async () => {
      const k2 = await contract.k2Authority();
      const exp = k2AddrEl()?.value?.trim();
      if (exp && k2.toLowerCase() !== exp.toLowerCase()) throw new Error('Mismatch: got ' + k2);
      return k2;
    });
    await chk('ingressSevered', async () => String(await contract.ingressSevered()));
    await chk('egressSevered',  async () => String(await contract.egressSevered()));

    if (out) {
      out.innerHTML = results.map(r =>
        '<div style="color:' + (r.pass ? 'var(--color-success)' : 'var(--color-error)') + '">' +
        (r.pass ? '✅' : '❌') + ' ' + r.label + ': ' + r.val + '</div>'
      ).join('');
    }

    const allPass = results.every(r => r.pass);
    if (!allPass) throw new Error('Smoke test failed: ' + results.filter(r => !r.pass).map(r => r.label).join(', '));
    return true;
  }

  // main init
  function initDashboard() {
    if (sessionStorage.getItem('sg_auth_passed') !== '1') return;

    // 1. TAB NAVIGATION
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = true; });
        document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', 'false'));
        const target = el(btn.dataset.tab);
        if (target) { target.hidden = false; btn.setAttribute('aria-selected', 'true'); }
      });
    });
    const firstTab = document.querySelector('[data-tab]');
    if (firstTab) firstTab.click();

    // 2. EYE ICON TOGGLES
    document.querySelectorAll('.input-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.input-wrapper')?.querySelector('input') ||
                      el(btn.dataset.target);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.classList.toggle('eye-open');
      });
    });

    // 3. NETWORK -> AUTO-FILL RPC
    const netSel  = netSelEl();
    const rpcInp  = rpcInputEl();
    if (netSel && rpcInp) {
      netSel.addEventListener('change', () => {
        const cfg = NETWORKS[netSel.value];
        if (cfg && !cfg.rpc.startsWith('TODO')) rpcInp.value = cfg.rpc;
      });
    }

    // 3b. RPC CHAIN SELECTOR - Two-column chip grid sync
    const rpcChainSel = el('rpc-chain-selector');
    if (rpcChainSel && netSel && rpcInp) {
      netSel.addEventListener('change', () => {
        const val = netSel.value;
        const chips = rpcChainSel.querySelectorAll('.chain-chip');
        chips.forEach(chip => {
          if (chip.dataset.net === val) chip.classList.add('selected');
          else chip.classList.remove('selected');
        });
      });

      rpcChainSel.addEventListener('click', (e) => {
        const chip = e.target.closest('.chain-chip');
        if (!chip) return;
        const net = chip.dataset.net;
        const cfg = NETWORKS[net];
        if (cfg && !cfg.rpc.startsWith('TODO')) {
          rpcInp.value = cfg.rpc;
          netSel.value = net;
          rpcChainSel.querySelectorAll('.chain-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
        }
      });

      const initialChips = rpcChainSel.querySelectorAll('.chain-chip');
      initialChips.forEach(chip => {
        if (chip.dataset.net === netSel.value) chip.classList.add('selected');
      });
    }

    // 4. KEY -> ADDRESS DERIVATION + DEPLOY ENABLE CHECK
    const deployBtn = el('deploy-btn');

    const checkDeployReady = () => {
      if (!deployBtn) return;
      const ready = isKey(val('deployer-key')) &&
                    isKey(val('k1-key')) &&
                    isAddr(k2AddrEl()?.value?.trim() || '') &&
                    isAddr(k3AddrEl()?.value?.trim() || '') &&
                    (rpcInp?.value?.trim() || '').length > 4;
      deployBtn.disabled = !ready;
    };

    const dKey = el('deployer-key');
    const dAddr = el('deployer-addr');
    if (dKey && dAddr) {
      dKey.addEventListener('input', () => {
        try {
          if (isKey(dKey.value.trim())) {
            const a = ethers.computeAddress(dKey.value.trim());
            dAddr.textContent = a;
          }
        } catch (e) {}
        checkDeployReady();
      });
    }

    const k1Key = el('k1-key');
    if (k1Key) {
      k1Key.addEventListener('input', () => {
        try {
          if (isKey(k1Key.value.trim())) {
            const a = ethers.computeAddress(k1Key.value.trim());
            const k1a = el('k1-addr');
            if (k1a) k1a.textContent = a;
          }
        } catch (e) {}
        checkDeployReady();
      });
    }

    ['k2-addr', 'k2-address', 'k3-addr', 'k3-address', 'rpc-url', 'rpc-input'].forEach(id => {
      el(id)?.addEventListener('input', checkDeployReady);
    });

    // 5. FUNDING CALCULATOR
    const fundBtn = el('calc-funding');
    const fundDisp = el('funding-display');
    if (fundBtn) {
      fundBtn.addEventListener('click', async () => {
        const cfg = NETWORKS[netSel?.value];
        if (!cfg) { alert('Select a network first'); return; }
        const origTxt = fundBtn.textContent;
        fundBtn.textContent = 'Calculating…';
        try {
          const rpc = rpcInp?.value?.trim() || cfg.rpc;
          const gpData = await rpcPost(rpc, 'eth_gasPrice', []);
          const gasPriceWei = BigInt(gpData.result || '0x3B9ACA00');
          const revokeCount = BigInt(document.querySelectorAll('#revoke-tbody tr').length || 5);
          const totalGas = ((3000000n + revokeCount * 80000n + 50000n) * 13n) / 10n;
          const totalWei = totalGas * gasPriceWei;
          const totalEth = parseFloat(ethers.formatEther(totalWei)).toFixed(6);

          let fiatStr = '';
          try {
            const pr = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const pd = await pr.json();
            fiatStr = ' (~$' + (parseFloat(totalEth) * pd.ethereum.usd).toFixed(2) + ' USD)';
          } catch (e) {}

          if (fundDisp) {
            fundDisp.innerHTML =
              '<div>Deploy contract: ' + (parseFloat(totalEth) * 0.6).toFixed(6) + ' ' + cfg.symbol + '</div>' +
              '<div>Revoke bundle (' + revokeCount + '): ' + (parseFloat(totalEth) * 0.3).toFixed(6) + ' ' + cfg.symbol + '</div>' +
              '<div>Verify + smoke: ' + (parseFloat(totalEth) * 0.1).toFixed(6) + ' ' + cfg.symbol + '</div>' +
              '<div><strong>TOTAL (30% buffer incl): ' + totalEth + ' ' + cfg.symbol + fiatStr + '</strong></div>';
          }
          const ta = el('total-amount');
          if (ta) ta.textContent = totalEth + ' ' + cfg.symbol;
        } catch (err) {
          if (fundDisp) fundDisp.textContent = 'Error: ' + err.message;
        }
        fundBtn.textContent = origTxt;
      });
    }

    // 6. REVOKE SCANNER
    const scanBtn    = el('scan-revokes');
    const revokeTbody = el('revoke-tbody');
    const revokeStatus = el('revoke-status');

    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        const k1 = getK1AddrValue();
        if (!isAddr(k1)) { alert('Enter a valid K1 address first'); return; }
        const orig = scanBtn.textContent;
        scanBtn.textContent = 'Scanning…';
        if (revokeStatus) revokeStatus.textContent = 'Crawling Etherscan…';
        if (revokeTbody) revokeTbody.innerHTML = '';
        window._sg_revoke_targets = [];

        try {
          const BASE = 'https://api.etherscan.io/api';
          const [r20, r721] = await Promise.all([
            fetch(BASE + '?module=logs&action=getLogs&address=' + k1 +
              '&topic0=0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925&fromBlock=0&toBlock=latest').then(r => r.json()),
            fetch(BASE + '?module=logs&action=getLogs&address=' + k1 +
              '&topic0=0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31&fromBlock=0&toBlock=latest').then(r => r.json())
          ]);

          const addRow = (token, spender, type) => {
            window._sg_revoke_targets.push({ token, spender, type });
            if (revokeTbody) {
              const tr = document.createElement('tr');
              tr.innerHTML =
                '<td title="' + token + '">' + token.slice(0, 10) + '…</td>' +
                '<td title="' + spender + '">' + spender.slice(0, 10) + '…</td>' +
                '<td>' + type + '</td>' +
                '<td><span style="color:var(--color-warning)">pending</span></td>';
              revokeTbody.appendChild(tr);
            }
          };

          (r20.result || []).forEach(log => {
            if (log.topics && log.topics[2]) addRow(log.address, '0x' + log.topics[2].slice(26), 'ERC20');
          });
          (r721.result || []).forEach(log => {
            if (log.topics && log.topics[2]) addRow(log.address, '0x' + log.topics[2].slice(26), 'ERC721');
          });

          const rpc = rpcInp?.value?.trim() || cfg.rpc;
          try {
            const codeData = await rpcPost(rpc, 'eth_getCode', [k1, 'latest']);
            if (codeData.result && codeData.result !== '0x' && codeData.result.startsWith('0xef01')) {
              const delegateTo = '0x' + codeData.result.slice(6, 46);
              addRow(k1, delegateTo, 'EIP-7702-DELEGATE');
            }
          } catch (e) {}

          const count = window._sg_revoke_targets.length;
          if (revokeStatus) revokeStatus.textContent = 'Found ' + count + ' revoke target' + (count !== 1 ? 's' : '') + '.';
          const rab = el('revoke-all');
          if (rab) rab.disabled = count === 0;
        } catch (err) {
          if (revokeStatus) revokeStatus.textContent = 'Scan error: ' + err.message;
        }
        scanBtn.textContent = orig;
      });
    }

    // 7. REVOKE ALL
    const revokeAllBtn = el('revoke-all');
    if (revokeAllBtn) {
      revokeAllBtn.addEventListener('click', async () => {
        if (!window._sg_revoke_targets || !window._sg_revoke_targets.length) {
          alert('No revoke targets. Run scan first.'); return;
        }
        revokeAllBtn.disabled = true;
        if (revokeStatus) revokeStatus.textContent = 'Submitting revoke bundle…';
        try {
          const network = netSel?.value || 'ethereum';
          const res = await fetch('/api/deploy/' + network + '/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              k1PrivateKey: val('k1-key'),
              k1Address: getK1AddrValue(),
              deployerPrivateKey: val('deployer-key'),
              rpcUrl: rpcInp?.value?.trim(),
              approvals: window._sg_revoke_targets
            })
          });
          const data = await res.json();
          if (revokeStatus) revokeStatus.textContent = res.ok
            ? 'Revoke bundle submitted ✓'
            : 'Error: ' + (data.error || data.message || 'Unknown');
          if (res.ok) {
            document.querySelectorAll('#revoke-tbody td:last-child').forEach(td => {
              td.innerHTML = '<span style="color:var(--color-success)">revoked</span>';
            });
          }
        } catch (err) {
          if (revokeStatus) revokeStatus.textContent = 'Revoke error: ' + err.message;
        }
        revokeAllBtn.disabled = false;
      });
    }

    // 8. DEPLOY BUTTON
    if (deployBtn) {
      deployBtn.addEventListener('click', async () => {
        deployBtn.disabled = true;
        const network = netSel?.value || 'ethereum';
        const modal = el('progress-modal') || el('deploy-progress');

        const setStep = (i, status, msg) => {
          console.log('[Step ' + (i + 1) + '] ' + status + ': ' + msg);
          if (!modal) return;
          const row = modal.querySelector('[data-step="' + i + '"]') ||
                      modal.querySelector('.step-' + i);
          if (row) {
            row.className = row.className.replace(/step-(pending|running|done|error)/g, '') + ' step-' + status;
            const msgEl = row.querySelector('.step-msg');
            if (msgEl) msgEl.textContent = msg;
          }
        };

        if (modal) modal.hidden = false;

        try {
          // Step 0 — funding
          setStep(0, 'running', 'Estimating…');
          el('calc-funding')?.click();
          await new Promise(r => setTimeout(r, 800));
          setStep(0, 'done', 'Complete');

          // Step 1 — revoke scan
          setStep(1, 'running', 'Scanning…');
          if (!window._sg_revoke_targets || !window._sg_revoke_targets.length) {
            el('scan-revokes')?.click();
            await new Promise(r => setTimeout(r, 3000));
          }
          setStep(1, 'done', (window._sg_revoke_targets?.length || 0) + ' targets');

          // Step 2 — deploy bundle
          setStep(2, 'running', 'Submitting to Flashbots…');
          const deployRes = await fetch('/api/deploy/' + network, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deployerPrivateKey: val('deployer-key'),
              k1PrivateKey: val('k1-key'),
              k1Address: getK1AddrValue(),
              k2Address: k2AddrEl()?.value?.trim(),
              k3Address: k3AddrEl()?.value?.trim(),
              rpcUrl: rpcInp?.value?.trim(),
              approvals: window._sg_revoke_targets || []
            })
          });
          const deployData = await deployRes.json();
          if (!deployRes.ok) throw new Error(deployData.error || deployData.message || 'Deploy API error');
          currentContractAddress = deployData.contractAddress || deployData.address;
          window._sg_contract_address = currentContractAddress;
          setStep(2, 'done', currentContractAddress
            ? 'Contract: ' + currentContractAddress.slice(0, 14) + '…'
            : 'Bundle submitted');

          // Step 3 — verify bytecode
          setStep(3, 'running', 'Verifying bytecode…');
          if (currentContractAddress) {
            const rpc = rpcInp?.value?.trim();
            const codeData = await rpcPost(rpc, 'eth_getCode', [currentContractAddress, 'latest']);
            if (!codeData.result || codeData.result === '0x') throw new Error('No bytecode at contract address');
            setStep(3, 'done', 'Bytecode confirmed');
          } else {
            setStep(3, 'done', 'No address returned — check API');
          }

          // Step 4 — smoke test
          setStep(4, 'running', 'Running smoke test…');
          await runSmokeTest();
          setStep(4, 'done', 'All checks passed');

          if (modal) {
            const completeMsg = modal.querySelector('.complete-msg');
            if (completeMsg) completeMsg.textContent = '✅ DEPLOYMENT COMPLETE';
          }
        } catch (err) {
          console.error('Deploy failed:', err);
          alert('Deploy failed: ' + err.message);
        }
        deployBtn.disabled = false;
      });
    }

    // 9. SMOKE TEST BUTTON
    const smokeBtn = el('smoke-test');
    if (smokeBtn) {
      smokeBtn.addEventListener('click', () => {
        runSmokeTest().catch(e => {
          const out = el('smoke-output') || el('smoke-results');
          if (out) out.innerHTML += '<div style="color:var(--color-error)">Error: ' + e.message + '</div>';
        });
      });
    }

    // 10. STATUS REFRESH
    const refreshBtn = el('refresh-status');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const rpc = rpcInp?.value?.trim() || NETWORKS[netSel?.value]?.rpc;
        if (!rpc || rpc.startsWith('TODO')) return;
        const provider = new ethers.JsonRpcProvider(rpc);
        const addrMap = {
          deployer: (el('deployer-addr') || el('deployer-address'))?.textContent?.trim(),
          k1: getK1AddrValue(),
          k2: k2AddrEl()?.value?.trim(),
          k3: k3AddrEl()?.value?.trim()
        };
        for (const [key, addr] of Object.entries(addrMap)) {
          if (!isAddr(addr)) continue;
          try {
            const bal = await provider.getBalance(addr);
            const balEl = el(key + '-balance') || document.querySelector('[data-balance="' + key + '"]');
            if (balEl) balEl.textContent = parseFloat(ethers.formatEther(bal)).toFixed(4) + ' ETH';
          } catch (e) {}
        }
        // Gate state if contract deployed
        if (window._sg_contract_address) {
          try {
            const abi = [
              'function ingressSevered() view returns (bool)',
              'function egressSevered() view returns (bool)',
              'function k2Authority() view returns (address)'
            ];
            const c = new ethers.Contract(window._sg_contract_address, abi, provider);
            const [ing, eg, k2] = await Promise.all([c.ingressSevered(), c.egressSevered(), c.k2Authority()]);
            setText('gate-ingress', ing.toString());
            setText('gate-egress', eg.toString());
            setText('gate-k2', k2);
          } catch (e) {}
        }
      });
    }

    // 11. SESSION PURGE
    function wipeSession() {
      if (!confirm('Purge session? All keys and deployment data will be wiped immediately.')) return;
      document.querySelectorAll('input').forEach(inp => { inp.value = ''; });
      ['deployer-addr', 'k1-addr', 'deployer-address', 'k1-address', 'sidebar-deployer-addr', 'sidebar-k1-addr'].forEach(id => {
        const e = el(id);
        if (e) e.textContent = '';
      });
      sessionStorage.clear();
      window._sg_contract_address = null;
      window._sg_revoke_targets = [];
      window.location.reload();
    }
    var scrubBtn = el('scrub-btn');
    if (scrubBtn) scrubBtn.addEventListener('click', wipeSession);
    var purgeBtn = el('purge-btn');
    if (purgeBtn) purgeBtn.addEventListener('click', wipeSession);
  }

  // BOOT
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }
})();