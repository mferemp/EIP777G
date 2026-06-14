/**
 * Flashbots Bundle Builder
 * Handles atomic bundle: Revoke All → Deploy → Verify
 * Supports Ethereum Mainnet (Flashbots) and Hyperliquid EVM (own MEV)
 */

import { NETWORKS, FUNDING_BASE, GAS_ESTIMATES } from './contracts.js';

export class FlashbotsBuilder {
  constructor(provider, networkKey) {
    this.provider = provider;
    this.networkKey = networkKey;
    this.network = NETWORKS[networkKey];
    this.bundle = [];
    this.signer = null;
  }

  setSigner(signer) { this.signer = signer; return this; }

  // Build revoke transactions for all approvals/delegates
  async addRevokeTransactions(approvals) {
    const erc20Abi = [
      'function approve(address spender, uint256 amount) external returns (bool)',
      'function allowance(address owner, address spender) external view returns (uint256)'
    ];
    const erc721Abi = [
      'function setApprovalForAll(address operator, bool approved) external',
      'function isApprovedForAll(address owner, address operator) external view returns (bool)'
    ];

    for (const approval of approvals) {
      try {
        if (approval.type === 'erc20') {
          const contract = new ethers.Contract(approval.token, erc20Abi, this.signer);
          const tx = await contract.approve.populateTransaction(approval.spender, 0);
          this.bundle.push({
            transaction: { ...tx, gasLimit: GAS_ESTIMATES.revokeApproval },
            signer: this.signer
          });
        } else if (approval.type === 'erc721') {
          const contract = new ethers.Contract(approval.token, erc721Abi, this.signer);
          const tx = await contract.setApprovalForAll.populateTransaction(approval.operator, false);
          this.bundle.push({
            transaction: { ...tx, gasLimit: GAS_ESTIMATES.revokeDelegate },
            signer: this.signer
          });
        } else if (approval.type === 'delegate') {
          // Custom delegate revocation
          const contract = new ethers.Contract(approval.contract, [
            'function removeOperator(address operator) external',
            'function revokeDelegate(address delegate) external'
          ], this.signer);
          let tx;
          try {
            tx = await contract.removeOperator.populateTransaction(approval.delegate);
          } catch {
            tx = await contract.revokeDelegate.populateTransaction(approval.delegate);
          }
          this.bundle.push({
            transaction: { ...tx, gasLimit: GAS_ESTIMATES.revokeDelegate },
            signer: this.signer
          });
        }
      } catch (e) {
        console.warn('[Flashbots] Failed to build revoke for', approval, e);
      }
    }
    return this;
  }

  // Add contract deployment transaction
  addDeployTransaction(contractFactory, deployParams, genesisProof) {
    const deployTx = contractFactory.getDeployTransaction(
      deployParams.k1Address,
      deployParams.k2Address,
      deployParams.k3Address,
      deployParams.cleanAddress,
      deployParams.authWindow,
      deployParams.minDelay,
      genesisProof
    );
    deployTx.gasLimit = GAS_ESTIMATES.deploy;
    this.bundle.push({
      transaction: deployTx,
      signer: this.signer
    });
    return this;
  }

  // Add verification transaction (call verifyGenesis)
  addVerifyTransaction(contractAddress) {
    const verifyAbi = ['function verifyGenesis() external view returns (address,address,address,address,uint64,uint256,bytes32)'];
    const contract = new ethers.Contract(contractAddress, verifyAbi, this.signer);
    const tx = contract.verifyGenesis.populateTransaction();
    tx.gasLimit = GAS_ESTIMATES.verifyGenesis;
    this.bundle.push({
      transaction: tx,
      signer: this.signer
    });
    return this;
  }

  // Sign all transactions in bundle
  async signBundle() {
    const signed = [];
    for (const item of this.bundle) {
      const signedTx = await item.signer.signTransaction(item.transaction);
      signed.push({
        signedTransaction: signedTx,
        signer: item.signer
      });
    }
    return signed;
  }

  // Submit via Flashbots (Ethereum Mainnet only)
  async submitFlashbots(signedBundle, targetBlock) {
    if (!this.network.flashbots.enabled) {
      throw new Error('Flashbots not enabled for this network');
    }

    const flashbotsProvider = await this._getFlashbotsProvider();
    const bundle = signedBundle.map(tx => ({
      signedTransaction: tx.signedTransaction
    }));

    const result = await flashbotsProvider.sendBundle(bundle, targetBlock);
    return result;
  }

  async _getFlashbotsProvider() {
    // Dynamic import to avoid bundle size
    const { FlashbotsBundleProvider } = await import('@flashbots/ethers-provider-bundle');
    const authSigner = new ethers.Wallet(CryptoUtils.randomHex(32), this.provider);
    return FlashbotsBundleProvider.create(this.provider, authSigner, this.network.flashbots.relay);
  }

  // Submit via standard RPC (fallback / other networks)
  async submitStandard(signedBundle) {
    const receipts = [];
    for (const tx of signedBundle) {
      const receipt = await this.provider.send('eth_sendRawTransaction', [tx.signedTransaction]);
      receipts.push(receipt);
      // Small delay between transactions
      await new Promise(r => setTimeout(r, 100));
    }
    return receipts;
  }

  // Get bundle for inspection
  getBundle() { return this.bundle; }
  clear() { this.bundle = []; return this; }
}

// Hyperliquid Core deployment uses different mechanism
export class HyperliquidCoreDeployer {
  constructor(apiUrl, signer) {
    this.apiUrl = apiUrl;
    this.signer = signer;
  }

  async deployGenesisGate(params) {
    // Hyperliquid Core uses different deployment:
    // 1. Build contract bytecode
    // 2. Sign deployment via EIP-712
    // 3. Submit via API
    // 4. Wait for confirmation

    const deploymentData = {
      contractType: 'GenesisGate',
      constructorArgs: {
        k1Genesis: params.k1Address,
        k2Authority: params.k2Address,
        k3DropWallet: params.k3Address,
        cleanWallet: params.cleanAddress,
        authWindow: params.authWindow,
        minDelay: params.minDelay,
        genesisProof: params.genesisProof
      }
    };

    // Sign with EIP-712
    const typedData = this._buildTypedData(deploymentData);
    const signature = await this.signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    // Submit via API
    const response = await fetch(`${this.apiUrl}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: { type: 'deployContract', ...deploymentData },
        signature,
        nonce: Date.now()
      })
    });

    return response.json();
  }

  _buildTypedData(data) {
    return {
      domain: { name: 'Hyperliquid', version: '1', chainId: 'hyperliquid' },
      types: {
        DeployContract: [
          { name: 'contractType', type: 'string' },
          { name: 'constructorArgs', type: 'ConstructorArgs' }
        ],
        ConstructorArgs: [
          { name: 'k1Genesis', type: 'address' },
          { name: 'k2Authority', type: 'address' },
          { name: 'k3DropWallet', type: 'address' },
          { name: 'cleanWallet', type: 'address' },
          { name: 'authWindow', type: 'uint64' },
          { name: 'minDelay', type: 'uint64' },
          { name: 'genesisProof', type: 'bytes' }
        ]
      },
      message: data
    };
  }
}

// Funding calculator
export class FundingCalculator {
  static calculate(networkKey, customGasPrice = null) {
    const network = NETWORKS[networkKey];
    const base = FUNDING_BASE[networkKey] || FUNDING_BASE.ethereum;
    const multiplier = network.gasMultiplier;

    const gasPrice = customGasPrice || (networkKey === 'ethereum' ? 20e9 : 1e9); // 20 gwei default
    const gasLimit = GAS_ESTIMATES.deploy;

    // Convert base costs from native to wei
    const toWei = (eth) => ethers.parseUnits(eth, network.nativeCurrency.decimals);

    const costs = {
      deploy: toWei(base.deploy),
      revoke: toWei(base.revoke),
      flashbots: toWei(base.flashbots),
      buffer: toWei(base.buffer)
    };

    // Apply gas multiplier for L2s
    const adjusted = {};
    for (const [key, value] of Object.entries(costs)) {
      adjusted[key] = (value * BigInt(Math.round(multiplier * 100))) / 100n;
    }

    const total = Object.values(adjusted).reduce((a, b) => a + b, 0n);

    return {
      network: network.name,
      chainId: network.chainId,
      breakdown: adjusted,
      total,
      totalFormatted: ethers.formatUnits(total, network.nativeCurrency.decimals),
      currency: network.nativeCurrency.symbol,
      gasPrice: gasPrice.toString(),
      gasLimit: gasLimit.toString(),
      timestamp: Date.now()
    };
  }

  // Estimate from current network conditions
  static async estimateLive(networkKey, provider) {
    const network = NETWORKS[networkKey];
    const base = FUNDING_BASE[networkKey] || FUNDING_BASE.ethereum;

    try {
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');

      const toWei = (eth) => ethers.parseUnits(eth, network.nativeCurrency.decimals);
      const costs = {
        deploy: toWei(base.deploy),
        revoke: toWei(base.revoke),
        flashbots: toWei(base.flashbots),
        buffer: toWei(base.buffer)
      };

      // Scale by actual gas price vs baseline
      const baseline = networkKey === 'ethereum' ? 20e9 : 1e9;
      const multiplier = Number(gasPrice) / baseline;

      const adjusted = {};
      for (const [key, value] of Object.entries(costs)) {
        adjusted[key] = (value * BigInt(Math.round(multiplier * 100))) / 100n;
      }

      const total = Object.values(adjusted).reduce((a, b) => a + b, 0n);

      return {
        ...this.calculate(networkKey),
        gasPrice: gasPrice.toString(),
        live: true,
        breakdown: adjusted,
        total,
        totalFormatted: ethers.formatUnits(total, network.nativeCurrency.decimals),
        currency: network.nativeCurrency.symbol
      };
    } catch {
      return this.calculate(networkKey);
    }
  }
}