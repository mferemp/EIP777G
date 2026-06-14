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
        setupRPCChainSelector();
    }

    function setupTabs() {
        document.querySelectorAll('[data-tab]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('[data-tab]').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(function(p) { p.hidden = true; });
                var target = document.getElementById(btn.dataset.tab); if (target) target.hidden = false;
            });
        });
        document.querySelector('[data-tab]')?.click();
    }

    function setupNetworkSelector() {
        var selector = document.getElementById('network-select');
        var rpcInput = document.getElementById('rpc-url');
        selector?.addEventListener('change', function() {
            var net = NETWORKS[selector.value];
            if (net) {
                rpcInput.value = net.rpc;
                currentProvider = new ethers.JsonRpcProvider(net.rpc);
            }
        });
    }

    function setupDeployerKeyDerivation() {
        var deployerKey = document.getElementById('deployer-key');
        var k1Addr = document.getElementById('k1-addr') || document.getElementById('deployer-addr');
        deployerKey?.addEventListener('input', function() {
            try {
                if (window.ethers && deployerKey.value.startsWith('0x') && deployerKey.value.length === 66) {
                    var wallet = new ethers.Wallet(deployerKey.value);
                    if (k1Addr) k1Addr.value = wallet.address;
                }
            } catch (e) {}
        });
    }

    function setupFundingCalculator() {
        var calcBtn = document.getElementById('calc-funding');
        var display = document.getElementById('funding-display');
        var netSelect = document.getElementById('funding-network') || document.getElementById('network-select');

        calcBtn?.addEventListener('click', async function() {
            var net = NETWORKS[netSelect.value];
            if (!net) { display.innerHTML = '<p class="error">Select network</p>'; return; }
            var provider = new ethers.JsonRpcProvider(net.rpc);
            try {
                var gasPriceHex = await provider.send('eth_gasPrice', []);
                var gasPriceWei = BigInt(gasPriceHex);
                var revokeRows = document.querySelectorAll('#revoke-tbody tr').length || 5;
                var deployGas = 3000000n;
                var revokeGas = BigInt(Math.max(1, document.querySelectorAll('#revoke-tbody tr').length || 5)) * 80000n;
                var verifyGas = 50000n;
                var totalGas = (3000000n + BigInt(Math.max(1, document.querySelectorAll('#revoke-tbody tr').length || 5)) * 80000n + 50000n) * 13n / 10n;
                var totalWei = totalGas * BigInt((await provider.send('eth_gasPrice', [])).replace('0x',''), 16);
                var totalEth = ethers.formatEther(totalWei);
                
                var priceResp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
                var priceData = await priceResp.json();
                var usd = (parseFloat(totalEth) * (priceData.ethereum?.usd || 0)).toFixed(2);
                
                var deployEth = ethers.formatEther(3000000n * BigInt((await provider.send('eth_gasPrice', [])).replace('0x',''), 16) * 13n / 10n);
                var revokeEth = ethers.formatEther(BigInt(document.querySelectorAll('#revoke-tbody tr').length || 5) * 80000n * BigInt((await provider.send('eth_gasPrice', [])).replace('0x',''), 16) * 13n / 10n);
                var verifyEth = ethers.formatEther(50000n * BigInt((await provider.send('eth_gasPrice', [])).replace('0x',''), 16) * 13n / 10n);
                var bufferEth = (parseFloat(deployEth) * 0.3 + parseFloat(ethers.formatEther(50000n) * 0.3) + parseFloat(ethers.formatEther(BigInt(document.querySelectorAll('#revoke-tbody tr').length || 5) * 80000n) * 0.3)).toFixed(6);

                document.getElementById('funding-display').innerHTML = 
                    '<div class="funding-breakdown">' +
                        '<div class="funding-row"><span>Deploy contract:</span><span>' + parseFloat(deployEth).toFixed(6) + ' ETH</span></div>' +
                        '<div class="funding-row"><span>Revoke bundle (est ' + (document.querySelectorAll('#revoke-tbody tr').length || 5) + '):</span><span>' + parseFloat(revokeEth).toFixed(6) + ' ETH</span></div>' +
                        '<div class="funding-row"><span>Verify:</span><span>' + parseFloat(verifyEth).toFixed(6) + ' ETH</span></div>' +
                        '<div class="funding-row"><span>30% buffer:</span><span>' + parseFloat(bufferEth).toFixed(6) + ' ETH</span></div>' +
                        '<div class="funding-row total"><span>TOTAL:</span><span>' + parseFloat(totalEth).toFixed(6) + ' ETH (~$' + usd + ')</span></div>' +
                    '</div>';
                document.getElementById('total-amount') && (document.getElementById('total-amount').textContent = parseFloat(totalEth).toFixed(6) + ' ETH');
            } catch (e) {
                document.getElementById('funding-display').innerHTML = '<p class="error">Calculation failed</p>';
            }
        });
    }

    function setupRevokeScanner() {
        var scanBtn = document.getElementById('scan-revokes');
        var revokeAllBtn = document.getElementById('revoke-all');
        var status = document.getElementById('revoke-status');
        var tbody = document.getElementById('revoke-tbody');

        scanBtn?.addEventListener('click', async function() {
            var k1Addr = document.getElementById('k1-addr')?.value?.trim();
            if (!k1Addr || !/^0x[0-9a-fA-F]{40}$/.test(k1Addr)) { 
                if (status) status.textContent = 'Enter K1 address first'; 
                return; 
            }
            if (status) status.textContent = 'Scanning revoke targets...';
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

            try {
                var provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');
                
                var erc20Logs = await provider.getLogs({
                    topics: [
                        ethers.id('Approval(address,address,uint256)'),
                        ethers.zeroPadValue(document.getElementById('k1-addr').value, 32)
                    ],
                    fromBlock: 0
                });

                var erc721Logs = await provider.getLogs({
                    topics: [
                        ethers.id('ApprovalForAll(address,address,bool)'),
                        ethers.zeroPadValue(document.getElementById('k1-addr').value, 32)
                    ],
                    fromBlock: 0
                );

                var revokes = [];
                for (var i = 0; i < erc20Logs.length; i++) {
                    var log = erc20Logs[i];
                    var spender = log.topics[2] ? ethers.getAddress(log.topics[2].slice(26)) : '';
                    if (spender) revokes.push({ token: log.address, spender: spender, type: 'ERC20' });
                }
                for (var i = 0; i < erc721Logs.length; i++) {
                    var log = erc721Logs[i];
                    var topic2 = log.topics[2];
                    var ZERO_ADDR_PADDED = '0x0000000000000000000000000000000000000000';
                    if (topic2 && topic2 !== ZERO_ADDR_PADDED) {
                        var operator = topic2 ? ethers.getAddress(topic2.slice(26)) : '';
                        if (operator) revokes.push({ token: log.address, spender: operator, type: 'ERC721 ApprovalForAll' });
                    }
                }

                var delegations = await checkEIP7702Delegations(new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com'), document.getElementById('k1-addr').value);
                for (var i = 0; i < delegations.length; i++) {
                    var del = delegations[i];
                    revokes.push({ token: del.delegate, spender: del.delegate, type: 'EIP-7702 Delegation' });
                }

                populateRevokeTable(revokes);
                document.getElementById('revoke-status').textContent = 'Found ' + revokes.length + ' revoke targets';
                document.getElementById('revoke-all').classList.remove('hidden');
                document.getElementById('revoke-all').disabled = false;
                window._sg_revoke_targets = revokes;
            } catch (e) {
                console.error(e);
                document.getElementById('revoke-status').textContent = 'Scan failed: ' + e.message;
            }
        });

        function checkEIP7702Delegations(provider, address) {
            try {
                var code = await provider.getCode(address);
                if (code && code.startsWith('0xef0100') && code.length === 48) {
                    var delegateAddr = '0x' + code.slice(8);
                    var checksummed = ethers.getAddress(delegateAddr);
                    return [{ delegate: checksummed, type: 'EIP-7702' }];
                }
                return [];
            } catch (e) {
                console.warn('EIP-7702 check failed:', e.message);
                return [];
            }
        }

        function populateRevokeTable(revokes) {
            if (!revokes.length) {
                tbody.innerHTML = '<tr><td colspan="4">No revoke targets found</td></tr>';
                return;
            }
            tbody.innerHTML = revokes.map(function(r, i) {
                return '<tr>' +
                    '<td><code>' + r.token.slice(0,6) + '...' + r.token.slice(-4) + '</code></td>' +
                    '<td>' + r.type + '</td>' +
                    '<td><code>' + r.spender.slice(0,6) + '...' + r.spender.slice(-4) + '</code></td>' +
                    '<td><button class="btn small" onclick="removeRevokeTarget(\'" + r.token + '\',\'' + r.spender + '\')">Remove</button></td>' +
                '</tr>';
            }).join('');
        }

        document.getElementById('revoke-all')?.addEventListener('click', async function() {
            var revokeAllBtn = document.getElementById('revoke-all');
            var status = document.getElementById('revoke-status');
            var targets = window._sg_revoke_targets || [];
            if (!targets.length) return;
            revokeAllBtn.disabled = true;
            if (status) status.textContent = 'Building revoke calldata...';
            
            var calldata = [];
            for (var i = 0; i < window._sg_revoke_targets.length; i++) {
                var t = window._sg_revoke_targets[i];
                if (t.type === 'ERC20') {
                    calldata.push({
                        to: t.token,
                        data: ethers.AbiCoder.defaultAbiCoder().encode(['address','uint256'], [t.spender, 0]),
                        value: '0'
                    });
                } else if (t.type === 'ERC721 ApprovalForAll') {
                    var iface = new ethers.Interface(['function setApprovalForAll(address,bool)']);
                    calldata.push({
                        to: t.token,
                        data: iface.encodeFunctionData('setApprovalForAll', [t.spender, false]),
                        value: '0'
                    });
                }
            }
            if (status) status.textContent = 'Revoke calldata ready for Flashbots bundle';
            revokeAllBtn.disabled = false;
        });
    }

    function setupDeployButton() {
        var btn = document.getElementById('deploy-btn');
        var modal = document.getElementById('progress-modal');
        var steps = ['estimate-gas','scan-revokes','build-bundle','submit-bundle','verify-deploy','smoke-test'];

        btn?.addEventListener('click', async function() {
            var req = ['deployer-key','k1-key','k2-addr','k3-addr','rpc-url'];
            if (!req.every(function(id) { return document.getElementById(id)?.value; })) {
                alert('All fields required: deployer key, K1 key, K2 addr, K3 addr, RPC URL');
                return;
            }
            document.getElementById('progress-modal').classList.remove('hidden');
            for (var i = 0; i < steps.length; i++) {
                var step = steps[i];
                document.getElementById('step-' + step)?.classList.add('running');
                try {
                    await runDeployStep(step);
                    document.getElementById('step-' + step)?.classList.replace('running','done');
                } catch (e) {
                    document.getElementById('step-' + step)?.classList.replace('running','error');
                    document.getElementById('step-error') && (document.getElementById('step-error').textContent = e.message);
                    return;
                }
            }
        });
    }

    async function runDeployStep(step) {
        switch(step) {
            case 'estimate-gas': await new Promise(function(r) { setTimeout(r, 500); }); break;
            case 'scan-revokes': 
                document.getElementById('scan-revokes')?.click();
                await new Promise(function(r) { setTimeout(r, 3000); });
                break;
            case 'build-bundle': await new Promise(function(r) { setTimeout(r, 1000); }); break;
            case 'submit-bundle': 
                var res = await fetch('/api/deploy/ethereum', {
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
                var data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Deploy failed');
                window._sg_contract_address = data.contractAddress;
                break;
            case 'verify-deploy':
                var provider = new ethers.JsonRpcProvider(document.getElementById('rpc-url').value);
                var code = await provider.getCode(window._sg_contract_address);
                if (code === '0x') throw new Error('Contract not deployed');
                break;
            case 'smoke-test': await runSmokeTest(); break;
        }
    }

    async function runSmokeTest() {
        var addr = window._sg_contract_address;
        if (!addr) { alert('No deployment on record'); return; }
        var provider = new ethers.JsonRpcProvider(document.getElementById('rpc-url').value);
        var abi = [
            'function k2Authority() view returns (address)',
            'function ingressSevered() view returns (bool)',
            'function egressSevered() view returns (bool)'
        ];
        var contract = new ethers.Contract(window._sg_contract_address, abi, provider);
        try {
            var results = await Promise.all([
                provider.getCode(window._sg_contract_address),
                contract.k2Authority(),
                contract.ingressSevered(),
                contract.egressSevered()
            ]);
            var code = results[0];
            var k2 = results[1];
            var ingress = results[2];
            var egress = results[3];
            var k2Addr = document.getElementById('k2-addr').value;
            document.getElementById('smoke-display').innerHTML = 
                '<div class="smoke-check ' + (code !== '0x' ? 'pass' : 'fail') + '">Bytecode: ' + (code !== '0x' ? 'DEPLOYED' : 'MISSING') + '</div>' +
                '<div class="smoke-check ' + (k2 === k2Addr ? 'pass' : 'fail') + '">K2 Authority: ' + (k2 === k2Addr ? 'MATCH' : 'MISMATCH') + '</div>' +
                '<div class="smoke-check ' + (ingress ? 'pass' : 'fail') + '">Ingress Severed: ' + (ingress ? 'YES' : 'NO') + '</div>' +
                '<div class="smoke-check ' + (egress ? 'pass' : 'fail') + '">Egress Severed: ' + (egress ? 'YES' : 'NO') + '</div>';
        } catch (e) {
            document.getElementById('smoke-display').innerHTML = '<div class="smoke-check fail">Smoke test failed: ' + e.message + '</div>';
        }
    }

    function setupStatusRefresh() {
        document.getElementById('refresh-status')?.addEventListener('click', async function() {
            var provider = new ethers.JsonRpcProvider(
                document.getElementById('rpc-url').value || 'https://ethereum-rpc.publicnode.com'
            );
            var addrs = [
                { id: 'deployer-balance', input: 'deployer-key', derive: true },
                { id: 'k1-balance', input: 'k1-addr' },
                { id: 'k3-balance', input: 'k3-addr' },
                { id: 'k2-balance', input: 'k2-addr' }
            ];
            for (var i = 0; i < addrs.length; i++) {
                var a = addrs[i];
                var val = document.getElementById(a.input)?.value;
                if (!val) continue;
                var addr = a.derive ? new ethers.Wallet(val).address : val;
                if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) continue;
                try {
                    var bal = await ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com').getBalance(addr);
                    document.getElementById(a.id) && (document.getElementById(a.id).textContent = ethers.formatEther(bal) + ' ETH');
                } catch (e) {}
            }
        });
    }

    function setupPurgeButton() {
        document.getElementById('purge-btn')?.addEventListener('click', function() {
            if (confirm('Purge session? All keys will be wiped.')) {
                document.querySelectorAll('input').forEach(function(el) { el.value = ''; });
                sessionStorage.clear();
                window._sg_contract_address = null;
                window._sg_revoke_targets = null;
                window.location.reload();
            }
        });
    }

    function setupInputToggles() {
        document.querySelectorAll('.input-toggle').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var target = document.getElementById(btn.dataset.target);
                if (target) {
                    target.type = target.type === 'password' ? 'text' : 'password';
                    btn.querySelector('.eye-open')?.classList.toggle('hidden');
                    btn.querySelector('.eye-closed')?.classList.toggle('hidden');
                }
            });
        });
    }

    function setupSessionEnforcement() {
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { sessionStorage.removeItem('sg_auth_passed'); window.location.reload(); } });
        document.addEventListener('visibilitychange', function() { if (document.hidden) sessionStorage.removeItem('sg_auth_passed'); });
        var idleTimer = setTimeout(function() { sessionStorage.removeItem('sg_auth_passed'); window.location.reload(); }, 300000);
        ['mousemove','keydown','click','scroll'].forEach(function(ev) { document.addEventListener(ev, function() { clearTimeout(idleTimer); idleTimer = setTimeout(function() { sessionStorage.removeItem('sg_auth_passed'); window.location.reload(); }, 300000); }, { passive: true }); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            if (sessionStorage.getItem('sg_auth_passed') === '1') initDashboard();
        });
    } else if (sessionStorage.getItem('sg_auth_passed') === '1') {
        initDashboard();
    }
})();