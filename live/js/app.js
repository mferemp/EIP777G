(function() {
    'use strict';

    const NETWORKS = {
        ethereum:       { rpc: 'https://ethereum-rpc.publicnode.com',           chainId: 1,      symbol: 'ETH',  flashbots: true  },
        'hl-evm':       { rpc: 'https://api.hyperliquid-testnet.xyz/evm',        chainId: 998,    symbol: 'HYPE', flashbots: false },
        'hl-core':      { rpc: 'https://api.hyperliquid.xyz/evm',                chainId: 999,    symbol: 'USDC', hlCore: true     },
        base:           { rpc: 'https://mainnet.base.org',                       chainId: 8453,   symbol: 'ETH'  },
        arbitrum:       { rpc: 'https://arb1.arbitrum.io/rpc',                   chainId: 42161,  symbol: 'ETH'  },
        optimism:       { rpc: 'https://mainnet.optimism.io',                    chainId: 10,     symbol: 'ETH'  },
        polygon:        { rpc: 'https://polygon-rpc.com',                        chainId: 137,    symbol: 'MATIC'},
        bnb:            { rpc: 'https://bsc-dataseed.binance.org/',               chainId: 56,     symbol: 'BNB'  },
        avax:           { rpc: 'https://api.avax.network/ext/bc/C/rpc',          chainId: 43114,  symbol: 'AVAX' },
        plasma:         { rpc: 'TODO:PLASMA_RPC',                                chainId: 9745,   symbol: 'ETH'  },
        monad:          { rpc: 'TODO:MONAD_RPC',                                 chainId: 10143,  symbol: 'MON'  },
        ink:            { rpc: 'TODO:INK_RPC',                                   chainId: 57073,  symbol: 'ETH'  },
        unichain:       { rpc: 'TODO:UNICHAIN_RPC',                              chainId: 130,    symbol: 'ETH'  },
        abstract:       { rpc: 'TODO:ABSTRACT_RPC',                              chainId: 2741,   symbol: 'ETH'  },
        'ape-chain':    { rpc: 'TODO:APE_CHAIN_RPC',                             chainId: 33139,  symbol: 'APE'  }
    };

    let ethers = window.ethers;
    let currentProvider = null;
    let currentContractAddress = null;

    function initDashboard() {
        if (sessionStorage.getItem('sg_auth_passed') !== '1') return;
        setupTabs();
        setupNetworkSelector();
        setupDeployerKeyDerivation();
        setupFundingCalculator();
        setupRevokeScanner();
        setupDeployButton();
        setupSmokeTest();
        setupStatusRefresh();
        setupPurgeButton();
        setupInputToggles();
        setupSessionEnforcement();
    }

    function setupTabs() {
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
                const target = document.getElementById(btn.dataset.tab); if (target) target.hidden = false;
            });
        });
        document.querySelector('[data-tab]')?.click();
    }

    function setupNetworkSelector() {
        const selector = document.getElementById('network-select');
        const rpcInput = document.getElementById('rpc-url');
        selector?.addEventListener('change', () => {
            const net = NETWORKS[selector.value];
            if (net) {
                rpcInput.value = net.rpc;
                currentProvider = new ethers.JsonRpcProvider(net.rpc);
            }
        });
    }

    function setupDeployerKeyDerivation() {
        const deployerKey = document.getElementById('deployer-key');
        const k1Addr = document.getElementById('k1-addr') || document.getElementById('deployer-addr');
        deployerKey?.addEventListener('input', () => {
            try {
                if (window.ethers && deployerKey.value.startsWith('0x') && deployerKey.value.length === 66) {
                    const wallet = new ethers.Wallet(deployerKey.value);
                    if (k1Addr) k1Addr.value = wallet.address;
                }
            } catch (e) {}
        });
    }

    function setupFundingCalculator() {
        const calcBtn = document.getElementById('calc-funding');
        const display = document.getElementById('funding-display');
        const netSelect = document.getElementById('funding-network') || document.getElementById('network-select');

        calcBtn?.addEventListener('click', async () => {
            const net = NETWORKS[netSelect.value];
            if (!net) { display.innerHTML = '<p class="error">Select network</p>'; return; }
            const provider = new ethers.JsonRpcProvider(net.rpc);
            try {
                const gasPriceHex = await provider.send('eth_gasPrice', []);
                const gasPriceWei = BigInt(gasPriceHex);
                const revokeCount = BigInt(Math.max(1, document.querySelectorAll('#revoke-tbody tr').length || 5));
                const deployGas = 3000000n;
                const revokeGas = revokeCount * 80000n;
                const verifyGas = 50000n;
                const totalGasBase = deployGas + revokeGas + verifyGas;
                const totalGasBuffered = totalGasBase * 13n / 10n;
                const totalWei = totalGasBuffered * gasPriceWei;
                const deployWei = deployGas * 13n / 10n * gasPriceWei;
                const revokeWei = revokeGas * 13n / 10n * gasPriceWei;
                const verifyWei = verifyGas * 13n / 10n * gasPriceWei;
                const bufferWei = totalGasBase * 3n / 10n * gasPriceWei;

                const totalEth   = ethers.formatEther(totalWei);
                const deployEth  = ethers.formatEther(deployWei);
                const revokeEth  = ethers.formatEther(revokeWei);
                const verifyEth  = ethers.formatEther(verifyWei);
                const bufferEth  = ethers.formatEther(bufferWei);

                const priceResp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                const priceData = await priceResp.json();
                const usd = (parseFloat(totalEth) * (priceData.ethereum?.usd || 0)).toFixed(2);

                document.getElementById('funding-display').innerHTML = `
                    <div class="funding-breakdown">
                        <div class="funding-row"><span>Deploy contract:</span><span>${parseFloat(deployEth).toFixed(6)} ETH</span></div>
                        <div class="funding-row"><span>Revoke bundle (est ${Number(revokeCount)}):</span><span>${parseFloat(revokeEth).toFixed(6)} ETH</span></div>
                        <div class="funding-row"><span>Verify:</span><span>${parseFloat(verifyEth).toFixed(6)} ETH</span></div>
                        <div class="funding-row"><span>30% buffer:</span><span>${parseFloat(bufferEth).toFixed(6)} ETH</span></div>
                        <div class="funding-row total"><span>TOTAL:</span><span>${parseFloat(totalEth).toFixed(6)} ETH (~$${usd})</span></div>
                    </div>
                `;
                document.getElementById('total-amount') && (document.getElementById('total-amount').textContent = parseFloat(totalEth).toFixed(6) + ' ETH');
            } catch (e) {
                document.getElementById('funding-display').innerHTML = '<p class="error">Calculation failed</p>';
            }
        });
    }

    function setupRevokeScanner() {
        const scanBtn = document.getElementById('scan-revokes');
        const revokeAllBtn = document.getElementById('revoke-all');
        const status = document.getElementById('revoke-status');
        const tbody = document.getElementById('revoke-tbody');

        async function performRevokeScan() {
            const k1Addr = document.getElementById('k1-addr')?.value?.trim();
            if (!k1Addr || !/^0x[0-9a-fA-F]{40}$/.test(k1Addr)) { 
                if (status) status.textContent = 'Enter K1 address first'; 
                return; 
            }
            if (status) status.textContent = 'Scanning revoke targets...';
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

            try {
                const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');
                
                const erc20Logs = await provider.getLogs({
                    topics: [
                        ethers.id('Approval(address,address,uint256)'),
                        ethers.zeroPadValue(document.getElementById('k1-addr').value, 32)
                    ],
                    fromBlock: 0
                });

                const erc721Logs = await provider.getLogs({
                    topics: [
                        ethers.id('ApprovalForAll(address,address,bool)'),
                        ethers.zeroPadValue(document.getElementById('k1-addr').value, 32)
                    ],
                    fromBlock: 0
                });

                const revokes = [];
                for (const log of erc20Logs) {
                    const spender = log.topics[2] ? ethers.getAddress(log.topics[2].slice(26)) : '';
                    if (spender) revokes.push({ token: log.address, spender, type: 'ERC20' });
                }

                const ZERO_ADDR_PADDED = ethers.zeroPadValue(ethers.ZeroAddress, 32);
                for (const log of erc721Logs) {
                    if (log.topics[2] && log.topics[2] !== ZERO_ADDR_PADDED) {
                        const operator = log.topics[2] ? ethers.getAddress(log.topics[2].slice(26)) : '';
                        if (operator) revokes.push({ token: log.address, spender: operator, type: 'ERC721 ApprovalForAll' });
                    }
                }

                const delegations = await checkEIP7702Delegations(new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com'), document.getElementById('k1-addr').value);
                for (const del of delegations) {
                    revokes.push({ token: del.delegate, spender: del.delegate, type: 'EIP-7702 Delegation' });
                }

                populateRevokeTable(revokes);
                document.getElementById('revoke-status').textContent = `Found ${revokes.length} revoke targets`;
                document.getElementById('revoke-all').classList.remove('hidden');
                document.getElementById('revoke-all').disabled = false;
                window._sg_revoke_targets = revokes;
            } catch (e) {
                console.error(e);
                document.getElementById('revoke-status').textContent = 'Scan failed: ' + e.message;
            }
        }

        scanBtn?.addEventListener('click', async () => {
            await performRevokeScan();
        });

        async function checkEIP7702Delegations(provider, address) {
            try {
                const code = await provider.getCode(address);
                if (code && code.startsWith('0xef0100') && code.length === 48) {
                    const delegateAddr = '0x' + code.slice(8);
                    const checksummed = ethers.getAddress(delegateAddr);
                    return [{ delegate: checksummed, type: 'EIP-7702' }];
                }
                return [];
            } catch (e) {
                console.warn('EIP-7702 check failed:', e.message);
                return [];
            }
        }

        function populateRevokeTable(revokes) {
            const tbody = document.getElementById('revoke-tbody');
            if (!revokes.length) {
                tbody.innerHTML = '<tr><td colspan="4">No revoke targets found</td></tr>';
                return;
            }
            tbody.innerHTML = revokes.map((r, i) => `
                <tr>
                    <td><code>${r.token.slice(0,6)}...${r.token.slice(-4)}</code></td>
                    <td>${r.type}</td>
                    <td><code>${r.spender.slice(0,6)}...${r.spender.slice(-4)}</code></td>
                    <td><button class="btn small" onclick="removeRevokeTarget('${r.token}','${r.spender}')">Remove</button></td>
                </tr>
            `).join('');
        }

        document.getElementById('revoke-all')?.addEventListener('click', async () => {
            const revokeAllBtn = document.getElementById('revoke-all');
            const status = document.getElementById('revoke-status');
            const targets = window._sg_revoke_targets || [];
            if (!targets.length) return;
            revokeAllBtn.disabled = true;
            if (status) status.textContent = 'Building revoke calldata and submitting...';

            const calldata = [];
            for (const t of window._sg_revoke_targets) {
                if (t.type === 'ERC20') {
                    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
                    calldata.push({
                        to: t.token,
                        data: iface.encodeFunctionData('approve', [t.spender, 0n]),
                        value: '0'
                    });
                } else if (t.type === 'ERC721 ApprovalForAll') {
                    const iface = new ethers.Interface(['function setApprovalForAll(address,bool)']);
                    calldata.push({
                        to: t.token,
                        data: iface.encodeFunctionData('setApprovalForAll', [t.spender, false]),
                        value: '0'
                    });
                } else if (t.type === 'EIP-7702 Delegation') {
                    calldata.push({
                        to: t.delegate,
                        data: '0x',
                        value: '0'
                    });
                }
            }

            const rpcUrl = document.getElementById('rpc-url')?.value || 'https://ethereum-rpc.publicnode.com';
            const network = document.getElementById('network-select')?.value || 'ethereum';
            
            try {
                const res = await fetch(`/api/deploy/${network}/revoke`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        k1PrivateKey: document.getElementById('k1-key')?.value,
                        k1Address: document.getElementById('k1-addr')?.value,
                        deployerPrivateKey: document.getElementById('deployer-key')?.value,
                        rpcUrl,
                        approvals: window._sg_revoke_targets || []
                    })
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Revoke submission failed');
                if (status) status.textContent = `Revoke bundle submitted: ${result.txHash || result.bundleHash || 'pending'}`;
                
                document.querySelectorAll('#revoke-tbody tr').forEach(row => {
                    row.style.opacity = '0.5';
                    const lastCell = row.querySelector('td:last-child');
                    if (lastCell) lastCell.textContent = '✅ Revoked';
                });
            } catch (e) {
                console.error('Revoke submission error:', e);
                if (status) status.textContent = 'Revoke failed: ' + e.message;
                revokeAllBtn.disabled = false;
            }
        });
    }

    function setupDeployButton() {
        const btn = document.getElementById('deploy-btn');
        const modal = document.getElementById('progress-modal');
        const steps = ['estimate-gas','scan-revokes','build-bundle','submit-bundle','verify-deploy','smoke-test'];

        btn?.addEventListener('click', async () => {
            const req = ['deployer-key','k1-key','k2-addr','k3-addr','rpc-url'];
            if (!req.every(id => document.getElementById(id)?.value)) {
                alert('All fields required: deployer key, K1 key, K2 addr, K3 addr, RPC URL');
                return;
            }
            document.getElementById('progress-modal').classList.remove('hidden');
            for (const step of steps) {
                document.getElementById(`step-${step}`)?.classList.add('running');
                try {
                    await runDeployStep(step);
                    document.getElementById(`step-${step}`)?.classList.replace('running','done');
                } catch (e) {
                    document.getElementById(`step-${step}`)?.classList.replace('running','error');
                    document.getElementById('step-error') && (document.getElementById('step-error').textContent = e.message);
                    return;
                }
            }
        });
    }

    async function runDeployStep(step) {
        switch(step) {
            case 'estimate-gas': await new Promise(r => setTimeout(r, 500)); break;
            case 'scan-revokes': 
                await performRevokeScan();
                break;
            case 'build-bundle': await new Promise(r => setTimeout(r, 1000)); break;
            case 'submit-bundle': {
                const network = document.getElementById('network-select')?.value || 'ethereum';
                const res = await fetch('/api/deploy/' + network, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                        deployerPrivateKey: document.getElementById('deployer-key').value,
                        k1PrivateKey: document.getElementById('k1-key').value,
                        k1Address: document.getElementById('k1-addr').value,
                        k2Address: document.getElementById('k2-addr').value,
                        k3Address: document.getElementById('k3-addr').value,
                        rpcUrl: document.getElementById('rpc-url').value,
                        approvals: window._sg_revoke_targets || []
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Deploy failed');
                window._sg_contract_address = data.contractAddress;
                break;
            }
            case 'verify-deploy': {
                const provider = new ethers.JsonRpcProvider(document.getElementById('rpc-url').value);
                const code = await provider.getCode(window._sg_contract_address);
                if (code === '0x') throw new Error('Contract not deployed');
                break;
            }
            case 'smoke-test': await runSmokeTest(); break;
        }
    }

    async function runSmokeTest() {
        const addr = window._sg_contract_address;
        if (!addr) { alert('No deployment on record'); return; }
        const provider = new ethers.JsonRpcProvider(document.getElementById('rpc-url').value);
        const abi = [
            'function k2Authority() view returns (address)',
            'function ingressSevered() view returns (bool)',
            'function egressSevered() view returns (bool)'
        ];
        const contract = new ethers.Contract(window._sg_contract_address, abi, provider);
        try {
            const [code, k2, ingress, egress] = await Promise.all([
                provider.getCode(window._sg_contract_address),
                contract.k2Authority(),
                contract.ingressSevered(),
                contract.egressSevered()
            ]);
            const k2Addr = document.getElementById('k2-addr').value;
            document.getElementById('smoke-display').innerHTML = `
                <div class="smoke-check ${code !== '0x' ? 'pass' : 'fail'}">Bytecode: ${code !== '0x' ? 'DEPLOYED' : 'MISSING'}</div>
                <div class="smoke-check ${k2 === k2Addr ? 'pass' : 'fail'}">K2 Authority: ${k2 === k2Addr ? 'MATCH' : 'MISMATCH'}</div>
                <div class="smoke-check ${ingress ? 'pass' : 'fail'}">Ingress Severed: ${ingress ? 'YES' : 'NO'}</div>
                <div class="smoke-check ${egress ? 'pass' : 'fail'}">Egress Severed: ${egress ? 'YES' : 'NO'}</div>
            `;
        } catch (e) {
            document.getElementById('smoke-display').innerHTML = '<div class="smoke-check fail">Smoke test failed: ' + e.message + '</div>';
        }
    }

    function setupStatusRefresh() {
        document.getElementById('refresh-status')?.addEventListener('click', async () => {
            const rpcUrl = document.getElementById('rpc-url')?.value || 'https://ethereum-rpc.publicnode.com';
            const balProvider = new ethers.JsonRpcProvider(rpcUrl);
            const addrs = [
                { id: 'deployer-balance', input: 'deployer-key', derive: true },
                { id: 'k1-balance', input: 'k1-addr' },
                { id: 'k3-balance', input: 'k3-addr' },
                { id: 'k2-balance', input: 'k2-addr' }
            ];
            for (const a of addrs) {
                const val = document.getElementById(a.input)?.value;
                if (!val) continue;
                let addr;
                try {
                    addr = a.derive ? new ethers.Wallet(val.trim()).address : val.trim();
                } catch (e) { continue; }
                if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) continue;
                try {
                    const bal = await balProvider.getBalance(addr);
                    document.getElementById(a.id) && (document.getElementById(a.id).textContent = ethers.formatEther(bal) + ' ETH');
                } catch (e) {}
            }
        });
    }

    function setupPurgeButton() {
        document.getElementById('purge-btn')?.addEventListener('click', () => {
            if (confirm('Purge session? All keys and deployment data will be wiped.')) {
                document.querySelectorAll('input').forEach(el => el.value = '');
                sessionStorage.clear();
                window._sg_contract_address = null;
                window._sg_revoke_targets = null;
                window.location.reload();
            }
        });
    }

    function setupInputToggles() {
        document.querySelectorAll('.input-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                if (target) {
                    target.type = target.type === 'password' ? 'text' : 'password';
                    btn.querySelector('.eye-open')?.classList.toggle('hidden');
                    btn.querySelector('.eye-closed')?.classList.toggle('hidden');
                }
            });
        });
    }

    function setupSessionEnforcement() {
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { sessionStorage.removeItem('sg_auth_passed'); window.location.reload(); } });
        document.addEventListener('visibilitychange', () => { if (document.hidden) sessionStorage.removeItem('sg_auth_passed'); });
        let idleTimer = setTimeout(() => { sessionStorage.removeItem('sg_auth_passed'); window.location.reload(); }, 300000);
        ['mousemove','keydown','touchstart'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { sessionStorage.removeItem('sg_auth_passed'); window.location.reload(); }, 300000); }, { passive: true }));
    }

    // performRevokeScan moved to module scope for runDeployStep to call
    async function performRevokeScan() {
        const scanBtn = document.getElementById('scan-revokes');
        const status = document.getElementById('revoke-status');
        const tbody = document.getElementById('revoke-tbody');

        const k1Addr = document.getElementById('k1-addr')?.value?.trim();
        if (!k1Addr || !/^0x[0-9a-fA-F]{40}$/.test(k1Addr)) { 
            if (status) status.textContent = 'Enter K1 address first'; 
            return; 
        }
        if (status) status.textContent = 'Scanning revoke targets...';
        if (tbody) tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

        try {
            const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');
            
            const erc20Logs = await provider.getLogs({
                topics: [
                    ethers.id('Approval(address,address,uint256)'),
                    ethers.zeroPadValue(document.getElementById('k1-addr').value, 32)
                ],
                fromBlock: 0
            });

            const erc721Logs = await provider.getLogs({
                topics: [
                    ethers.id('ApprovalForAll(address,address,bool)'),
                    ethers.zeroPadValue(document.getElementById('k1-addr').value, 32)
                ],
                fromBlock: 0
            });

            const revokes = [];
            for (const log of erc20Logs) {
                const spender = log.topics[2] ? ethers.getAddress(log.topics[2].slice(26)) : '';
                if (spender) revokes.push({ token: log.address, spender, type: 'ERC20' });
            }

            const ZERO_ADDR_PADDED = ethers.zeroPadValue(ethers.ZeroAddress, 32);
            for (const log of erc721Logs) {
                if (log.topics[2] && log.topics[2] !== ZERO_ADDR_PADDED) {
                    const operator = log.topics[2] ? ethers.getAddress(log.topics[2].slice(26)) : '';
                    if (operator) revokes.push({ token: log.address, spender: operator, type: 'ERC721 ApprovalForAll' });
                }
            }

            const delegations = await checkEIP7702Delegations(new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com'), document.getElementById('k1-addr').value);
            for (const del of delegations) {
                revokes.push({ token: del.delegate, spender: del.delegate, type: 'EIP-7702 Delegation' });
            }

            populateRevokeTable(revokes);
            document.getElementById('revoke-status').textContent = `Found ${revokes.length} revoke targets`;
            document.getElementById('revoke-all').classList.remove('hidden');
            document.getElementById('revoke-all').disabled = false;
            window._sg_revoke_targets = revokes;
        } catch (e) {
            console.error(e);
            document.getElementById('revoke-status').textContent = 'Scan failed: ' + e.message;
        }
    }

    async function checkEIP7702Delegations(provider, address) {
        try {
            const code = await provider.getCode(address);
            if (code && code.startsWith('0xef0100') && code.length === 48) {
                const delegateAddr = '0x' + code.slice(8);
                const checksummed = ethers.getAddress(delegateAddr);
                return [{ delegate: checksummed, type: 'EIP-7702' }];
            }
            return [];
        } catch (e) {
            console.warn('EIP-7702 check failed:', e.message);
            return [];
        }
    }

    function populateRevokeTable(revokes) {
        const tbody = document.getElementById('revoke-tbody');
        if (!revokes.length) {
            tbody.innerHTML = '<tr><td colspan="4">No revoke targets found</td></tr>';
            return;
        }
        tbody.innerHTML = revokes.map((r, i) => `
            <tr>
                <td><code>${r.token.slice(0,6)}...${r.token.slice(-4)}</code></td>
                <td>${r.type}</td>
                <td><code>${r.spender.slice(0,6)}...${r.spender.slice(-4)}</code></td>
                <td><button class="btn small" onclick="removeRevokeTarget('${r.token}','${r.spender}')">Remove</button></td>
            </tr>
        `).join('');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (sessionStorage.getItem('sg_auth_passed') === '1') initDashboard();
        });
    } else if (sessionStorage.getItem('sg_auth_passed') === '1') {
        initDashboard();
    }
})();