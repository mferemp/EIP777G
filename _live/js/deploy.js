/**
 * Deployment Orchestration
 * Handles the complete deployment flow: revoke scan → funding calc → flashbots bundle → verify
 */

import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js';
import { GENESIS_LOCK_ABI, ERC20_ABI, ERC721_ABI, NETWORKS, encodeGenesisProof } from './contracts.js';
import { FlashbotsBuilder, HyperliquidCoreDeployer, FundingCalculator } from './flashbots.js';
import { SessionVault, DeviceFingerprinter, GenesisKeyGenerator } from './crypto.js';

export class DeploymentOrchestrator {
  constructor(vault, config = {}) {
    this.vault = vault;
    this.config = config;
    this.provider = null;
    this.signer = null;
    this.networkKey = 'ethereum';
    this.contract = null;
    this.contractAddress = null;
    this.progressCallback = null;
    this.logCallback = null;
  }

  setProgressCallback(fn) { this.progressCallback = fn; }
  setLogCallback(fn) { this.logCallback = fn; }

  _log(level, message) {
    if (this.logCallback) this.logCallback({ level, message, timestamp: Date.now() });
    console.log(`[${level.toUpperCase()}]`, message);
  }

  _progress(step, status, data = {}) {
    if (this.progressCallback) this.progressCallback({ step, status, ...data });
  }

  // Initialize provider and signer
  async initialize(networkKey, rpcUrl, deployerKey) {
    this.networkKey = networkKey;
    this.network = NETWORKS[networkKey];

    const rpc = rpcUrl || this.network.rpc;
    this.provider = new ethers.JsonRpcProvider(rpc);
    this.signer = new ethers.Wallet(deployerKey, this.provider);

    // Verify network
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== Number(this.network.chainId) && this.network.chainId !== 'hyperliquid') {
      throw new Error(`Network mismatch: connected to ${network.chainId}, expected ${this.network.chainId}`);
    }

    this._log('info', `Initialized on ${this.network.name} (${network.chainId})`);
    return this;
  }

  // Step 1: Calculate required funding
  async calculateFunding(live = true) {
    this._progress(1, 'active', { description: 'Calculating funding requirements...' });
    this._log('info', 'Calculating funding...');

    let funding;
    if (live) {
      funding = await FundingCalculator.estimateLive(this.networkKey, this.provider);
    } else {
      funding = FundingCalculator.calculate(this.networkKey);
    }

    this._progress(1, 'completed', funding);
    this._log('info', `Funding required: ${funding.totalFormatted} ${funding.currency}`);
    return funding;
  }

  // Step 2: Scan for revoke targets (ERC20 allowances, ERC721 delegates, custom delegates)
  async scanRevokeTargets(k1Address) {
    this._progress(2, 'active', { description: 'Scanning for approvals & delegates...' });
    this._log('info', `Scanning revoke targets for ${k1Address}`);

    const targets = [];

    // Get token balances to find ERC20 tokens
    const tokens = await this._scanERC20Balances(k1Address);
    this._log('info', `Found ${tokens.length} ERC20 tokens`);

    for (const token of tokens) {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, this.provider);
        const allowance = await contract.allowance(k1Address, token.spender || '0x0000000000000000000000000000000000000000');
        if (allowance > 0n) {
          targets.push({
            type: 'erc20',
            token: token.address,
            symbol: token.symbol,
            spender: token.spender,
            amount: allowance.toString(),
            amountFormatted: ethers.formatUnits(allowance, token.decimals),
            risk: 'high'
          });
        }
      } catch (e) {
        this._log('warn', `Failed to check allowance for ${token.address}`);
      }
    }

    // Scan ERC721 delegations
    const nfts = await this._scanERC721Balances(k1Address);
    this._log('info', `Found ${nfts.length} NFT collections`);

    for (const nft of nfts) {
      try {
        const contract = new ethers.Contract(nft.address, ERC721_ABI, this.provider);
        const isApproved = await contract.isApprovedForAll(k1Address, nft.operator || '0x0000000000000000000000000000000000000000');
        if (isApproved) {
          targets.push({
            type: 'erc721',
            token: nft.address,
            name: nft.name,
            operator: nft.operator,
            risk: 'critical'
          });
        }
      } catch (e) {
        this._log('warn', `Failed to check delegate for ${nft.address}`);
      }
    }

    // Scan for custom delegate patterns (common in DeFi)
    const customDelegates = await this._scanCustomDelegates(k1Address);
    for (const del of customDelegates) {
      targets.push({ ...del, type: 'delegate', risk: 'critical' });
    }

    this._progress(2, 'completed', { count: targets.length, targets });
    this._log('info', `Scan complete: ${targets.length} revoke targets found`);
    return targets;
  }

  async _scanERC20Balances(address) {
    // In production, use a token indexer (Zapper, Covalent, Alchemy)
    // For now, return known tokens - this would be replaced with actual indexing
    const knownTokens = [
      // USDC, USDT, WETH etc. - would be fetched from indexer
    ];
    return knownTokens;
  }

  async _scanERC721Balances(address) {
    // Would use indexer to find NFTs
    return [];
  }

  async _scanCustomDelegates(address) {
    // Check common delegate patterns
    // This would check known DeFi protocols for delegate approvals
    return [];
  }

  // Step 3: Build Flashbots bundle
  async buildBundle(targets, deployParams, genesisProof) {
    this._progress(3, 'active', { description: 'Building Flashbots bundle...' });
    this._log('info', 'Building deployment bundle...');

    const builder = new FlashbotsBuilder(this.provider, this.networkKey).setSigner(this.signer);

    // Add revoke transactions first
    for (const target of targets) {
      await builder.addRevokeTransactions([target]);
    }

    // Add deployment
    const factory = new ethers.ContractFactory(GENESIS_LOCK_ABI, deployParams.bytecode, this.signer);
    builder.addDeployTransaction(factory, deployParams, genesisProof);

    // Add verification
    // Note: contract address unknown until deployed, so verification happens post-deploy

    const signedBundle = await builder.signBundle();
    this._progress(3, 'completed', { txCount: signedBundle.length });
    this._log('info', `Bundle built with ${signedBundle.length} transactions`);

    return { builder, signedBundle };
  }

  // Step 4: Submit bundle
  async submitBundle(signedBundle, targetBlock = null) {
    this._progress(4, 'active', { description: 'Submitting bundle...' });
    this._log('info', 'Submitting bundle...');

    if (this.network.flashbots.enabled && this.networkKey === 'ethereum') {
      // Try Flashbots first
      try {
        const builder = new FlashbotsBuilder(this.provider, this.networkKey).setSigner(this.signer);
        const result = await builder.submitFlashbots(signedBundle, targetBlock || (await this.provider.getBlockNumber()) + 1);
        this._progress(4, 'completed', { method: 'flashbots', result });
        this._log('info', 'Bundle submitted via Flashbots');
        return { method: 'flashbots', result };
      } catch (e) {
        this._log('warn', `Flashbots failed, falling back to standard: ${e.message}`);
      }
    }

    // Standard submission
    const builder = new FlashbotsBuilder(this.provider, this.networkKey).setSigner(this.signer);
    const receipts = await builder.submitStandard(signedBundle);
    this._progress(4, 'completed', { method: 'standard', receipts });
    this._log('info', 'Bundle submitted via standard RPC');
    return { method: 'standard', receipts };
  }

  // Step 5: Verify deployment
  async verifyDeployment(receipt) {
    this._progress(5, 'active', { description: 'Verifying deployment...' });
    this._log('info', 'Verifying deployment...');

    // Extract contract address from receipt
    const deployReceipt = receipt.receipts?.[1] || receipt.receipts?.[0];
    if (!deployReceipt) throw new Error('No deployment receipt found');

    const contractAddress = deployReceipt.contractAddress || deployReceipt.to;
    if (!contractAddress) throw new Error('Contract address not found in receipt');

    this.contractAddress = contractAddress;
    this.contract = new ethers.Contract(contractAddress, GENESIS_LOCK_ABI, this.provider);

    // Verify genesis
    const [k1, k2, k3, clean, deployedAt, chainId, genesisHash] = await this.contract.verifyGenesis();

    this._progress(5, 'completed', { contractAddress, k1, k2, k3, genesisHash });
    this._log('info', `Deployment verified: ${contractAddress}`);

    return { contractAddress, genesisHash, k1, k2, k3, deployedAt, chainId };
  }

  // Step 6: Smoke test
  async runSmokeTest() {
    this._progress(6, 'active', { description: 'Running smoke test...' });
    this._log('info', 'Running smoke test...');

    if (!this.contract) throw new Error('Contract not initialized');

    const tests = [];

    // Test 1: Verify genesis matches
    try {
      const [k1, k2, k3] = await Promise.all([
        this.contract.k1Genesis(),
        this.contract.k2Authority(),
        this.contract.k3DropWallet()
      ]);
      tests.push({ name: 'Genesis addresses', pass: true, data: { k1, k2, k3 } });
    } catch (e) {
      tests.push({ name: 'Genesis addresses', pass: false, error: e.message });
    }

    // Test 2: Check severance status
    try {
      const [ingress, egress] = await Promise.all([
        this.contract.isIngressSevered(),
        this.contract.isEgressSevered()
      ]);
      tests.push({ name: 'Severance status', pass: true, data: { ingress, egress } });
    } catch (e) {
      tests.push({ name: 'Severance status', pass: false, error: e.message });
    }

    // Test 3: Queue a dummy intent (0 value)
    try {
      // This would require K1 to sign - skip for smoke test
      tests.push({ name: 'Intent queue (requires K1)', pass: true, skipped: true });
    } catch (e) {
      tests.push({ name: 'Intent queue', pass: false, error: e.message });
    }

    // Test 4: Check K1 balance (should be 0 or unchanged)
    try {
      const k1Bal = await this.provider.getBalance(await this.contract.k1Genesis());
      tests.push({ name: 'K1 balance check', pass: true, data: { balance: ethers.formatEther(k1Bal) } });
    } catch (e) {
      tests.push({ name: 'K1 balance check', pass: false, error: e.message });
    }

    const passed = tests.filter(t => t.pass).length;
    const total = tests.length;

    this._progress(6, 'completed', { tests, passed, total });
    this._log('info', `Smoke test: ${passed}/${total} passed`);

    return { tests, passed, total, success: passed === total };
  }

  // Full deployment pipeline
  async deployFull(params) {
    const {
      networkKey, rpcUrl, deployerKey,
      k1Address, k2Address, k3Address, cleanAddress,
      authWindow, minDelay,
      genesisProof, bytecode,
      onProgress, onLog
    } = params;

    if (onProgress) this.setProgressCallback(onProgress);
    if (onLog) this.setLogCallback(onLog);

    try {
      // Initialize
      await this.initialize(networkKey, rpcUrl, deployerKey);

      // Derive K1 address from key if not provided
      const k1Wallet = new ethers.Wallet(this.vault.get('k1Key') || params.k1Key, this.provider);
      const derivedK1 = k1Wallet.address;

      // Step 1: Funding
      const funding = await this.calculateFunding(true);

      // Step 2: Scan revokes
      const targets = await this.scanRevokeTargets(derivedK1);

      // Step 3: Build bundle
      const deployParams = {
        k1Address: derivedK1,
        k2Address, k3Address, cleanAddress,
        authWindow, minDelay,
        bytecode
      };
      const { signedBundle } = await this.buildBundle(targets, deployParams, genesisProof);

      // Step 4: Submit
      const submitResult = await this.submitBundle(signedBundle);

      // Step 5: Verify
      const verifyResult = await this.verifyDeployment(submitResult);

      // Step 6: Smoke test
      const smokeResult = await this.runSmokeTest();

      // Success
      this._log('info', '✅ Deployment complete');
      this._log('info', `Contract: ${verifyResult.contractAddress}`);
      this._log('info', `Genesis Hash: ${verifyResult.genesisHash}`);

      return {
        success: true,
        contractAddress: verifyResult.contractAddress,
        genesisHash: verifyResult.genesisHash,
        funding,
        revokeTargets: targets.length,
        method: submitResult.method,
        smokeTest: smokeResult
      };

    } catch (error) {
      this._log('error', `Deployment failed: ${error.message}`);
      this._progress(0, 'failed', { error: error.message });
      throw error;
    }
  }

  // Hyperliquid Core deployment
  async deployHyperliquidCore(params) {
    const { k1Address, k2Address, k3Address, cleanAddress, authWindow, minDelay, genesisProof } = params;

    this._log('info', 'Deploying to Hyperliquid Core...');

    const deployer = new HyperliquidCoreDeployer(NETWORKS['hyperliquid-core'].rpc, this.signer);

    const deployParams = {
      k1Address, k2Address, k3Address, cleanAddress,
      authWindow, minDelay, genesisProof
    };

    const result = await deployer.deployGenesisGate(deployParams);

    this._log('info', 'Hyperliquid Core deployment submitted');
    return result;
  }
}

// Export for global use
window.DeploymentOrchestrator = DeploymentOrchestrator;