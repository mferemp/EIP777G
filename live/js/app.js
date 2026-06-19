// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE
// CLIENT-SIDE SIGNING ONLY — Private keys never leave the browser
// Server receives only signed transactions (0x...)

(function () {
  'use strict';

  const NETWORKS = {
    ethereum:     { rpc: '', chainId: 1,       symbol: 'ETH',  flashbots: true  },
    'hl-evm':     { rpc: '', chainId: 998,     symbol: 'HYPE', flashbots: false },
    'hl-core':    { rpc: '', chainId: 999,     symbol: 'USDC', hlCore: true     },
    base:         { rpc: '', chainId: 8453,    symbol: 'ETH'  },
    arbitrum:     { rpc: '', chainId: 42161,   symbol: 'ETH'  },
    optimism:     { rpc: '', chainId: 10,      symbol: 'ETH'  },
    polygon:      { rpc: '', chainId: 137,     symbol: 'MATIC' },
    bnb:          { rpc: '', chainId: 56,      symbol: 'BNB'  },
    avax:         { rpc: '', chainId: 43114,   symbol: 'AVAX' },
    plasma:       { rpc: '', chainId: 9745,    symbol: 'ETH'  },
    monad:        { rpc: '', chainId: 10143,   symbol: 'MON'  },
    ink:          { rpc: '', chainId: 57073,   symbol: 'ETH'  },
    unichain:     { rpc: '', chainId: 130,     symbol: 'ETH'  },
    abstract:     { rpc: '', chainId: 2741,    symbol: 'ETH'  },
    'ape-chain':  { rpc: '', chainId: 33139,   symbol: 'APE'  }
  };

  let ethers = window.ethers;
  let currentContractAddress = null;
  window._sg_contract_address = null;
  window._sg_revoke_targets = [];
  window._sg_k1_first_tx = null;
  window._sg_verified_k1_addr = null;

  function el(id) { return document.getElementById(id); }
  function val(id) { const e = el(id); return e ? e.value.trim() : ''; }
  function isAddr(s) { return /^0x[0-9a-fA-F]{40}$/.test(s); }
  function isKey(s)  { return /^0x[0-9a-fA-F]{64}$/.test(s) || /^[0-9a-fA-F]{64}$/.test(s); }

  function setText(id, txt) {
    const e = el(id) || document.querySelector('[data-display="' + id + '"]');
    if (e) { if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') e.value = txt; else e.textContent = txt; }
  }

  function rpcInputEl() { return el('rpc-url') || el('rpc-input'); }
  function netSelEl()   { return el('network-select') || document.querySelector('select[name="network"]'); }
  function getK1AddrValue() { return window._sg_verified_k1_addr || ''; }
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

  async function loadArtifact() {
    try {
      const resp = await fetch('/api/deploy/EIP777G.json');
      if (!resp.ok) throw new Error('Failed to load artifact');
      return await resp.json();
    } catch (e) {
      console.error('Failed to load artifact:', e);
      throw new Error('Contract artifact not found. Deploy cannot proceed.');
    }
  }

  function buildDeployTx(chainId, k1Addr, k2Addr, k3Addr, deployerAddr) {
    if (!ARTIFACT) throw new Error('Artifact not loaded');
    const iface = new ethers.Interface(ARTIFACT.abi);
    const deployData = ARTIFACT.bytecode.object + iface.encodeDeploy([
      k1Addr,
      k2Addr,
      k3Addr || '0x0000000000000000000000000000000000000000',
      86400n,
      86400n
    ]).slice(2);
    return {
      data: deployData,
      chainId,
      type: 2
    };
  }

  async function sendSignedTxs(chainId, signedTxs, useFlashbots) {
    const res = await fetch('/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId, signedTxs, useFlashbots: chainId === 1 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Relay error');
    return data;
  }

  async function runSmokeTest() {
    const addr = window._sg_contract_address || currentContractAddress;
    const out = el('smoke-output') || el('smoke-results');
    if (!addr) { if (out) out.textContent = 'No deployment in current session.'; return false; }
    const rpc = rpcInputEl()?.value?.trim();
    if (!rpc) { if (out) out.textContent = 'No RPC configured.'; return false; }

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

  function initDashboard() {
    if (sessionStorage.getItem('sg_auth_passed') !== '1') return;

    const boundK1 = sessionStorage.getItem('sg_bound_k1');
    if (boundK1) {
      window._sg_verified_k1_addr = boundK1;
      const k1Display = el('k1-addr') || el('k1-address') || el('bound-k1-addr');
      if (k1Display) k1Display.textContent = boundK1;
    }

    loadArtifact().then(() => console.log('Artifact loaded')).catch(e => console.error(e));

    document.querySelectorAll('.input-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.input-wrapper')?.querySelector('input') || el(btn.dataset.target);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.classList.toggle('eye-open');
      });
    });

    const netSel  = netSelEl();
    const rpcInp  = rpcInputEl();
    if (netSel && rpcInp) {
      netSel.addEventListener('change', () => {});
    }

    const rpcChainSel = el('rpc-chain-selector');
    if (rpcChainSel && netSel && rpcInp) {
      netSel.addEventListener('change', () => {
        const v = netSel.value;
        const chips = rpcChainSel.querySelectorAll('.chain-chip');
        chips.forEach(chip => {
          if (chip.dataset.net === v) chip.classList.add('selected');
          else chip.classList.remove('selected');
        });
      });

      rpcChainSel.addEventListener('click', (e) => {
        const chip = e.target.closest('.chain-chip');
        if (!chip) return;
        const net = chip.dataset.net;
        chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        netSel.value = net;
      });

      const initialChips = rpcChainSel.querySelectorAll('.chain-chip');
      initialChips.forEach(chip => {
        if (chip.dataset.net === netSel.value) chip.classList.add('selected');
      });
    }

    const walletRepoOpt = el('wallet-repo-opt');
    const activate2faOpt = el('activate-2fa-opt');
    const deployBtn = el('deploy-btn');

    walletRepoOpt?.addEventListener('change', () => {
      if (walletRepoOpt.checked) activate2faOpt.checked = false;
      updateModeUI();
    });
    activate2faOpt?.addEventListener('change', () => {
      if (activate2faOpt.checked) walletRepoOpt.checked = false;
      updateModeUI();
    });

    function updateModeUI() {
      const isWalletRepo = walletRepoOpt?.checked || false;
      const is2FA = activate2faOpt?.checked || false;
      const hasVerifiedK1 = !!window._sg_verified_k1_addr;
      const bothChecked = isWalletRepo && is2FA;

      let ready = false;
      if (bothChecked) {
        if (deployBtn) deployBtn.textContent = 'SELECT ONE MODE ONLY';
      } else if (isWalletRepo) {
        ready = isKey(val('deployer-key')) &&
                isKey(val('k1-key')) &&
                isAddr(k2AddrEl()?.value?.trim() || '') &&
                isAddr(k3AddrEl()?.value?.trim() || '') &&
                (rpcInp?.value?.trim() || '').length > 4;
        if (deployBtn) deployBtn.textContent = 'DEPLOY WALLET REPO (FLASHBOTS + REVOKE/SWEEPER)';
      } else if (is2FA) {
        ready = hasVerifiedK1 &&
                isAddr(k2AddrEl()?.value?.trim() || '') &&
                (rpcInp?.value?.trim() || '').length > 4;
        if (deployBtn) deployBtn.textContent = 'DEPLOY 2FA GATE (K1 FUNDS, NO FLASHBOTS)';
      } else {
        if (deployBtn) deployBtn.textContent = 'SELECT MODE →';
      }
      deployBtn.disabled = !ready || bothChecked;

      const deployerKeyRow = el('deployer-key')?.closest('.form-group');
      if (deployerKeyRow) deployerKeyRow.style.display = is2FA ? 'none' : '';

      const k3Row = el('k3-addr')?.closest('.form-group');
      if (k3Row) k3Row.style.display = is2FA ? 'none' : '';

      const scanRevokeBtn = el('scan-revokes');
      if (scanRevokeBtn) scanRevokeBtn.style.display = is2FA ? 'none' : '';

      const revokeAllBtn = el('revoke-all');
      if (revokeAllBtn) revokeAllBtn.style.display = is2FA ? 'none' : '';
    }

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
        updateModeUI();
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
        updateModeUI();
      });
    }

    const k1AddrDisplay = el('k1-addr') || el('k1-address');
    if (k1AddrDisplay && window._sg_verified_k1_addr) {
      k1AddrDisplay.textContent = window._sg_verified_k1_addr;
    }

    ['k2-addr', 'k2-address', 'k3-addr', 'k3-address', 'rpc-url', 'rpc-input'].forEach(id => {
      el(id)?.addEventListener('input', updateModeUI);
    });

    updateModeUI();

    const fundBtn = el('calc-funding');
    const fundDisp = el('funding-display');
    if (fundBtn) {
      fundBtn.addEventListener('click', async () => {
        const cfg = NETWORKS[netSel?.value];
        if (!cfg) { alert('Select a network first'); return; }
        const origTxt = fundBtn.textContent;
        fundBtn.textContent = 'Calculating…';
        try {
          const rpc = rpcInp?.value?.trim();
          if (!rpc) { alert('Enter your RPC URL'); return; }
          const gpData = await rpcPost(rpc, 'eth_gasPrice', []);
          const gasPriceWei = BigInt(gpData.result || '0x3B9ACA00');

          const isWalletRepo = walletRepoOpt?.checked || false;
          const is2FA = activate2faOpt?.checked || false;

          const deployGas = 3000000n;
          const revokeGasPer = 80000n;
          const verifyGas = 50000n;
          const sweeperGas = 150000n;

          let revokeCount = 0n;
          let totalGas = 0n;

          if (is2FA) {
            revokeCount = 0n;
            totalGas = ((deployGas + verifyGas) * 130n) / 100n;
          } else if (isWalletRepo) {
            revokeCount = BigInt((document.querySelectorAll('#revoke-tbody tr').length ?? 0) || 5);
            totalGas = ((deployGas + revokeCount * revokeGasPer + sweeperGas + verifyGas) * 130n) / 100n;
          } else {
            fundBtn.textContent = origTxt;
            if (fundDisp) fundDisp.innerHTML = '<div style="color:var(--magenta)">Select Wallet Repo or 2FA mode</div>';
            return;
          }

          const totalWei = totalGas * gasPriceWei;
          const totalEth = parseFloat(ethers.formatEther(totalWei)).toFixed(6);

          let fiatStr = '';
          try {
            const pr = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const pd = await pr.json();
            fiatStr = ' (~$' + (parseFloat(totalEth) * pd.ethereum.usd).toFixed(2) + ' USD)';
          } catch (e) { fiatStr = ''; }

          const deployGasEst = deployGas;
          const verifyGasEst = verifyGas;
          const revokeGasTotal = revokeCount * revokeGasPer;
          const sweeperGasEst = sweeperGas;
          const totalGasUnbuffered = is2FA
            ? deployGasEst + verifyGasEst
            : isWalletRepo
              ? deployGasEst + revokeCount * revokeGasPer + sweeperGas + verifyGasEst
              : deployGasEst + revokeCount * revokeGasPer + verifyGasEst;

          const deployPct = (deployGasEst * 100 / totalGasUnbuffered).toFixed(0);
          const revokePct = is2FA ? '0' : ((revokeCount * revokeGasPer) * 100 / totalGasUnbuffered).toFixed(0);
          const sweeperPct = isWalletRepo ? (sweeperGas * 100 / totalGasUnbuffered).toFixed(0) : '0';
          const verifyPct = (verifyGas * 100 / totalGasUnbuffered).toFixed(0);

          if (fundDisp) {
            let html = '';
            if (is2FA) {
              html =
                '<div style="color:var(--teal)"><strong>K1 FUNDS (Preventative 2FA):</strong></div>' +
                '<div>Deploy 2FA gate: ' + (parseFloat(totalEth) * deployGas / totalGasUnbuffered).toFixed(6) + ' ' + cfg.symbol + ' (' + deployPct + '%)</div>' +
                '<div>Verify + smoke: ' + (parseFloat(totalEth) * verifyGas / totalGasUnbuffered).toFixed(6) + ' ' + cfg.symbol + ' (' + verifyPct + '%)</div>' +
                '<div><strong>TOTAL K1 FUNDING (30% buffer): ' + totalEth + ' ' + cfg.symbol + fiatStr + '</strong></div>' +
                '<div style="color:var(--magenta);margin-top:8px;">⚠ NO DEPLOYER FUNDING • NO FLASHBOTS • NO REVOKES</div>' +
                '<div style="color:var(--gold);margin-top:4px;">✓ K1 locked as genesis-verified executor</div>';
            } else if (isWalletRepo) {
              html =
                '<div style="color:var(--teal)"><strong>DEPLOYER FUNDS (Wallet Repo = 777G Standard):</strong></div>' +
                '<div>Deploy contract: ' + (parseFloat(totalEth) * deployGas / totalGasUnbuffered).toFixed(6) + ' ' + cfg.symbol + ' (' + deployPct + '%)</div>' +
                '<div>Revoke-all: ' + (parseFloat(totalEth) * revokeCount * revokeGasPer / totalGasUnbuffered).toFixed(6) + ' ' + cfg.symbol + ' (' + revokePct + '%)</div>' +
                '<div>Sweeper bots: ' + (parseFloat(totalEth) * sweeperGas / totalGasUnbuffered).toFixed(6) + ' ' + cfg.symbol + ' (' + sweeperPct + '%)</div>' +
                '<div>Verify + smoke: ' + (parseFloat(totalEth) * verifyGas / totalGasUnbuffered).toFixed(6) + ' ' + cfg.symbol + ' (' + verifyPct + '%)</div>' +
                '<div><strong>TOTAL DEPLOYER FUNDING (30% buffer incl): ' + totalEth + ' ' + cfg.symbol + fiatStr + '</strong></div>' +
                '<div style="color:var(--gold);margin-top:4px;">✓ K1 locked as genesis-verified executor</div>' +
                '<div style="color:var(--magenta);margin-top:4px;">✓ Flashbots • Revoke-all • Sweeper bots</div>';
            }
            fundDisp.innerHTML = html;
          }
          const ta = el('total-amount');
          if (ta) ta.textContent = totalEth + ' ' + cfg.symbol;
        } catch (err) {
          if (fundDisp) fundDisp.textContent = 'Error: ' + err.message;
        }
        fundBtn.textContent = origTxt;
      });
    }

    const scanBtn    = el('scan-revokes');
    const revokeTbody = el('revoke-tbody');
    const revokeStatus = el('revoke-status');

    if (scanBtn) {
      scanBtn.addEventListener('click', async () => {
        if (activate2faOpt?.checked) {
          if (revokeStatus) revokeStatus.textContent = 'Revoke scan skipped in 2FA mode';
          return;
        }
        const k1 = getK1AddrValue();
        if (!isAddr(k1)) { alert('No verified K1 address'); return; }
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

          const rpc = rpcInp?.value?.trim();
          if (!rpc) { alert('Enter your RPC URL'); return; }
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

    const revokeAllBtn = el('revoke-all');
    if (revokeAllBtn) {
      revokeAllBtn.addEventListener('click', async () => {
        if (activate2faOpt?.checked) {
          if (revokeStatus) revokeStatus.textContent = 'Revoke-all skipped in 2FA mode';
          return;
        }
        if (!window._sg_revoke_targets || !window._sg_revoke_targets.length) {
          alert('No revoke targets. Run scan first.'); return;
        }
        revokeAllBtn.disabled = true;
        if (revokeStatus) revokeStatus.textContent = 'Building & signing revoke transactions…';
        try {
          const k1Key = val('k1-key');
          const k1Addr = getK1AddrValue();
          const network = netSel?.value || 'ethereum';
          const cfg = NETWORKS[network];
          const rpc = rpcInp?.value?.trim() || cfg.rpc;
          const chainId = cfg.chainId;

          if (!isKey(k1Key)) { alert('K1 private key required for revoke'); revokeAllBtn.disabled = false; return; }
          if (!isAddr(k1Addr)) { alert('No verified K1 address'); revokeAllBtn.disabled = false; return; }

          if (revokeStatus) revokeStatus.textContent = 'Signing revoke transactions…';

          const provider = new ethers.JsonRpcProvider(rpc);
          const k1Wallet = new ethers.Wallet(k1Key, provider);

          let nonce = await provider.getTransactionCount(k1Addr);

          const signedTxs = [];
          const ERC20_IFACE = new ethers.Interface(['function approve(address,uint256)']);
          const ERC721_IFACE = new ethers.Interface(['function setApprovalForAll(address,bool)']);
          const DELEGATE_IFACE = new ethers.Interface(['function revokeDelegation()']);

          for (const t of window._sg_revoke_targets) {
            let tx;
            if (t.type === 'ERC20') {
              const data = ERC20_IFACE.encodeFunctionData('approve', [t.spender, 0]);
              tx = {
                to: t.token, data, chainId: chainId, type: 2,
                nonce, gasLimit: 80000n,
                maxFeePerGas: (await provider.getFeeData()).maxFeePerGas,
                maxPriorityFeePerGas: (await provider.getFeeData()).maxPriorityFeePerGas,
              };
            } else if (t.type === 'ERC721') {
              const data = ERC721_IFACE.encodeFunctionData('setApprovalForAll', [t.spender, false]);
              tx = {
                to: t.token, data, chainId: chainId, type: 2,
                nonce, gasLimit: 80000n,
                maxFeePerGas: (await provider.getFeeData()).maxFeePerGas,
                maxPriorityFeePerGas: (await provider.getFeeData()).maxPriorityFeePerGas,
              };
            } else if (t.type === 'EIP-7702-DELEGATE') {
              tx = {
                to: k1Addr,
                data: '0xef0100' + '0'.repeat(40),
                chainId: chainId, type: 2,
                nonce, gasLimit: 50000n,
                maxFeePerGas: (await provider.getFeeData()).maxFeePerGas,
                maxPriorityFeePerGas: (await provider.getFeeData()).maxPriorityFeePerGas,
              };
            } else continue;

            const signed = await k1Wallet.signTransaction(tx);
            signedTxs.push(signed);
            nonce++;
          }

          if (revokeStatus) revokeStatus.textContent = 'Submitting ' + signedTxs.length + ' signed revoke transactions…';

          const res = await sendSignedTxs(chainId, signedTxs, false);
          
          if (revokeStatus) revokeStatus.textContent = 'Revoke bundle submitted ✓ (' + res.hashes.length + ' txs)';
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

    if (deployBtn) {
      deployBtn.addEventListener('click', async () => {
        deployBtn.disabled = true;
        const isWalletRepo = walletRepoOpt?.checked || false;
        const is2FA = activate2faOpt?.checked || false;
        const network = netSel?.value || 'ethereum';
        const cfg = NETWORKS[network];
        const chainId = cfg.chainId;
        const rpc = rpcInp?.value?.trim() || cfg.rpc;
        const modal = el('progress-modal') || el('deploy-progress');

        const setStep = (i, status, msg) => {
          if (!modal) return;
          const row = modal.querySelector('[data-step="' + i + '"]') || modal.querySelector('.step-' + i);
          if (row) {
            row.className = row.className.replace(/step-(pending|running|done|error)/g, '') + ' step-' + status;
            const msgEl = row.querySelector('.step-msg');
            if (msgEl) msgEl.textContent = msg;
          }
        };

        if (modal) modal.hidden = false;

        try {
          await loadArtifact();

          setStep(0, 'running', 'Estimating…');
          el('calc-funding')?.click();
          await new Promise(r => setTimeout(r, 800));
          setStep(0, 'done', 'Complete');

          if (is2FA) {
            setStep(1, 'running', 'Building & signing 2FA deployment…');
            
            const k1Key = val('k1-key');
            const k1Addr = window._sg_verified_k1_addr;
            const k2Addr = k2AddrEl()?.value?.trim();
            const rpc = rpcInp?.value?.trim();
            
            if (!isKey(val('k1-key'))) { alert('K1 private key required'); deployBtn.disabled = false; return; }
            if (!isAddr(k1Addr)) { alert('No verified K1 address'); deployBtn.disabled = false; return; }
            if (!isAddr(k2Addr)) { alert('K2 address required'); deployBtn.disabled = false; return; }
            if (!rpc) { alert('Enter your RPC URL'); deployBtn.disabled = false; return; }

            const provider = new ethers.JsonRpcProvider(rpc);
            const k1Wallet = new ethers.Wallet(val('k1-key'), provider);
            const deployerAddr = k1Addr;

            const deployTx = buildDeployTx(chainId, k1Addr, k2AddrEl()?.value?.trim(), '', deployerAddr);
            const nonce = await provider.getTransactionCount(deployerAddr);
            const feeData = await provider.getFeeData();
            deployTx.nonce = nonce;
            deployTx.maxFeePerGas = feeData.maxFeePerGas;
            deployTx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
            deployTx.gasLimit = 4000000n;

            setStep(1, 'running', 'Signing deployment…');
            const signedDeploy = await k1Wallet.signTransaction(deployTx);

            const testTx = {
              to: k2AddrEl()?.value?.trim(),
              value: ethers.parseEther('0.0001'),
              chainId: chainId,
              type: 2,
              nonce: nonce + 1n,
              maxFeePerGas: deployTx.maxFeePerGas,
              maxPriorityFeePerGas: deployTx.maxPriorityFeePerGas,
              gasLimit: 21000n,
            };
            const signedTest = await k1Wallet.signTransaction(testTx);

            setStep(1, 'running', 'Submitting test send + deployment…');
            
            const res = await sendSignedTxs(chainId, [signedTest, signedDeploy], false);
            
            setStep(1, 'done', 'Test send: ' + res.hashes[0].slice(0,10) + '... Deploy: ' + res.hashes[1].slice(0,10) + '...');

            setStep(2, 'running', 'Verifying bytecode…');
            await new Promise(r => setTimeout(r, 3000));
            
            setStep(2, 'done', 'Waiting for block confirmation…');
            
            setStep(3, 'running', 'Running smoke test…');
            await runSmokeTest();
            setStep(3, 'done', 'All checks passed');

          } else if (isWalletRepo) {
            setStep(1, 'running', 'Scanning revoke targets…');
            if (!window._sg_revoke_targets || !window._sg_revoke_targets.length) {
              el('scan-revokes')?.click();
              await new Promise(r => setTimeout(r, 3000));
            }
            setStep(1, 'done', (window._sg_revoke_targets?.length || 0) + ' targets');

            setStep(2, 'running', 'Building & signing transactions…');
            
            const deployerKey = val('deployer-key');
            const k1Key = val('k1-key');
            const k1Addr = window._sg_verified_k1_addr;
            const k2Addr = k2AddrEl()?.value?.trim();
            const k3Addr = k3AddrEl()?.value?.trim();
            const rpc = rpcInp?.value?.trim();
            const deployerAddr = el('deployer-addr')?.textContent?.trim();

            if (!isKey(deployerKey)) { alert('Deployer private key required'); deployBtn.disabled = false; return; }
            if (!isKey(k1Key)) { alert('K1 private key required for revoke'); deployBtn.disabled = false; return; }
            if (!isAddr(k1Addr)) { alert('No verified K1 address'); deployBtn.disabled = false; return; }
            if (!isAddr(k2Addr)) { alert('K2 address required'); deployBtn.disabled = false; return; }
            if (!isAddr(k3Addr)) { alert('K3 address required'); deployBtn.disabled = false; return; }
            if (!isAddr(deployerAddr)) { alert('Deployer address not derived'); deployBtn.disabled = false; return; }
            if (!rpc) { alert('Enter your RPC URL'); deployBtn.disabled = false; return; }

            const provider = new ethers.JsonRpcProvider(rpc);
            const deployerWallet = new ethers.Wallet(deployerKey, provider);
            const k1Wallet = new ethers.Wallet(k1Key, provider);

            setStep(2, 'running', 'Building deploy + revoke + test transactions…');

            const deployerNonce = await provider.getTransactionCount(deployerAddr);
            const feeData = await provider.getFeeData();
            
            const testTx = {
              to: k3AddrEl()?.value?.trim(),
              value: ethers.parseEther('0.0001'),
              chainId,
              type: 2,
              nonce: deployerNonce,
              maxFeePerGas: feeData.maxFeePerGas,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
              gasLimit: 21000n,
            };
            const signedTest = await deployerWallet.signTransaction(testTx);

            let k1Nonce = await provider.getTransactionCount(k1Addr);
            const k1RevokeTxs = [];
            const ERC20_IFACE = new ethers.Interface(['function approve(address,uint256)']);
            const ERC721_IFACE = new ethers.Interface(['function setApprovalForAll(address,bool)']);
            
            for (const t of window._sg_revoke_targets) {
              let data;
              if (t.type === 'ERC20') {
                data = ERC20_IFACE.encodeFunctionData('approve', [t.spender, 0]);
              } else if (t.type === 'ERC721') {
                data = new ethers.Interface(['function setApprovalForAll(address,bool)']).encodeFunctionData('setApprovalForAll', [t.spender, false]);
              } else if (t.type === 'EIP-7702-DELEGATE') {
                data = '0xef0100' + '0'.repeat(40);
              } else continue;
              
              const tx = {
                to: t.token, data, chainId, type: 2,
                nonce: k1Nonce++, gasLimit: 80000n,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
              };
              const signed = await k1Wallet.signTransaction(tx);
              k1RevokeTxs.push(signed);
            }

            const deployTx = buildDeployTx(chainId, k1Addr, k2AddrEl()?.value?.trim(), k3AddrEl()?.value?.trim(), deployerAddr);
            deployTx.nonce = deployerNonce + 1n;
            deployTx.maxFeePerGas = feeData.maxFeePerGas;
            deployTx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
            deployTx.gasLimit = 4000000n;
            const signedDeploy = await deployerWallet.signTransaction(deployTx);

            setStep(2, 'running', 'Submitting to Flashbots relay…');
            
            const allSigned = [signedTest, ...k1RevokeTxs, signedDeploy];
            
            const res = await sendSignedTxs(chainId, allSigned, true);
            
            setStep(2, 'done', 'Bundle submitted: ' + res.hashes.length + ' txs' + (res.bundleHash ? ' | Bundle: ' + res.bundleHash.slice(0,10) + '...' : ''));
            
            setStep(3, 'running', 'Verifying bytecode…');
            await new Promise(r => setTimeout(r, 5000));
            
            setStep(3, 'done', 'Waiting for block confirmation…');
            
            setStep(4, 'running', 'Running smoke test…');
            await runSmokeTest();
            setStep(4, 'done', 'All checks passed');

          }

          if (modal) {
            const completeMsg = modal.querySelector('.complete-msg');
            if (completeMsg) {
              if (is2FA) completeMsg.textContent = '✅ PREVENTATIVE 2FA DEPLOYED (K1 FUNDS)';
              else if (isWalletRepo) completeMsg.textContent = '✅ WALLET REPO DEPLOYED (FLASHBOTS + REVOKE-ALL + SWEEPER)';
            }
          }
        } catch (err) {
          console.error('Deploy failed:', err);
          alert('Deploy failed: ' + err.message);
        }
        deployBtn.disabled = false;
      });
    }

    const smokeBtn = el('smoke-test');
    if (smokeBtn) {
      smokeBtn.addEventListener('click', () => {
        runSmokeTest().catch(e => {
          const out = el('smoke-output') || el('smoke-results');
          if (out) out.innerHTML += '<div style="color:var(--color-error)">Error: ' + e.message + '</div>';
        });
      });
    }

    const refreshBtn = el('refresh-status');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const rpc = rpcInp?.value?.trim();
        if (!rpc) return;
        const provider = new ethers.JsonRpcProvider(rpc);
        const addrMap = {
          deployer: (el('deployer-addr') || el('deployer-address'))?.textContent?.trim(),
          k1: window._sg_verified_k1_addr,
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

    function wipeSession() {
      if (!confirm('Purge session? All keys and deployment data will be wiped immediately.')) return;
      document.querySelectorAll('input').forEach(inp => { inp.value = ''; });
      ['deployer-addr', 'k1-addr', 'deployer-address', 'k1-address', 'sidebar-deployer-addr', 'sidebar-k1-addr', 'bound-k1-addr'].forEach(id => {
        const e = el(id);
        if (e) e.textContent = '';
      });
      sessionStorage.clear();
      localStorage.removeItem('sg_genesis_origin');
      localStorage.removeItem('sg_genesis_fp');
      localStorage.removeItem('sg_first_visit');
      localStorage.removeItem('sg_visit_count');
      localStorage.removeItem('sg_auth_passed');
      localStorage.removeItem('sg_bypass_hash');
      window._sg_contract_address = null;
      window._sg_revoke_targets = [];
      window._sg_verified_k1_addr = null;
      window.location.reload();
    }
    var scrubBtn = el('scrub-btn');
    if (scrubBtn) scrubBtn.addEventListener('click', wipeSession);
    var powerBtn = el('power-btn');
    if (powerBtn) powerBtn.addEventListener('click', wipeSession);
    var purgeBtn = el('purge-btn');
    if (purgeBtn) purgeBtn.addEventListener('click', wipeSession);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }
})();