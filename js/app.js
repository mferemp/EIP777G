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
        console.log('Dashboard initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            if (sessionStorage.getItem('sg_auth_passed') === '1') initDashboard();
        });
    } else if (sessionStorage.getItem('sg_auth_passed') === '1') {
        initDashboard();
    }
})();