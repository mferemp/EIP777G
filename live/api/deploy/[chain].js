// Vercel Serverless Function: POST /api/deploy/:chain
// PROJECT: SecureGate 777G | OPERATOR: Empress | NO HELIX REFERENCES ANYWHERE

const { ethers } = require('ethers');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chain } = req.query;
  const body = req.body || {};
  const mode = String(body.mode || 'recovery');
  const isProactive = mode === 'proactive_2fa';
  const isWalletRepo = mode === 'wallet_repo';
  const VERSION = '3.3.0';

  // Validate required fields
  if (isProactive) {
    // Proactive 2FA: K1 funds and signs deployment (no deployer key)
    if (!body.k1PrivateKey || !body.k1Address || !body.k2Address) {
      return res.status(400).json({ error: 'Missing required fields for Proactive 2FA: k1PrivateKey, k1Address, k2Address' });
    }
    if (body.deployerPrivateKey) {
      return res.status(400).json({ error: 'Deployer private key is forbidden in Proactive 2FA mode; K1 signs deployment' });
    }
  } else if (isWalletRepo) {
    // Wallet Repo: deployer funds, Flashbots + revoke-all + sweeper
    if (!body.deployerPrivateKey || !body.k1PrivateKey || !body.k1Address || !body.k2Address || !body.k3Address) {
      return res.status(400).json({ error: 'Missing required fields for Wallet Repo mode' });
    }
  } else {
    if (!body.deployerPrivateKey || !body.k1PrivateKey || !body.k1Address || !body.k2Address || !body.k3Address) {
      return res.status(400).json({ error: 'Missing required fields for recovery mode' });
    }
  }

  // Load contract artifact from static artifacts folder
  let artifact;
  try {
    const fs = require('fs');
    const path = require('path');
    const artifactPath = path.join(process.cwd(), 'artifacts', 'EIP777G.json');
    if (!fs.existsSync(artifactPath)) {
      return res.status(500).json({ error: 'Contract artifact not found: artifacts/EIP777G.json' });
    }
    artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    console.log('DEBUG: Loaded artifact from:', artifactPath);
  } catch (e) {
    return res.status(500).json({ error: 'Contract artifact read failed', details: e.message });
  }

  // Validate artifact has bytecode
  if (!artifact.bytecode || !artifact.bytecode.object) {
    return res.status(500).json({ error: 'Contract artifact missing bytecode' });
  }

  try {
    if (!body.rpcUrl) {
      return res.status(400).json({ error: 'RPC URL is required. Provide your own RPC URL.' });
    }
    const provider = new ethers.JsonRpcProvider(body.rpcUrl);

    let signerWallet;
    if (isProactive) {
      // Proactive 2FA: K1 wallet signs deployment
      signerWallet = new ethers.Wallet(body.k1PrivateKey, provider);
    } else {
      // Recovery or Wallet Repo: deployer wallet signs
      signerWallet = new ethers.Wallet(body.deployerPrivateKey, provider);
    }

    // Check signer balance first
    const balance = await provider.getBalance(signerWallet.address);
    console.log('DEBUG: Signer address:', signerWallet.address);
    console.log('DEBUG: Signer balance:', balance.toString());

    if (balance === 0n) {
      return res.status(400).json({
        error: 'SIGNER_UNFUNDED',
        message: 'Signing account has 0 ETH. Fund the signer address before deploying.',
        address: signerWallet.address,
        balance: balance.toString()
      });
    }

    // Get the deployment bytecode (creation bytecode)
    const bytecode = artifact.bytecode.object;

    // Constructor arguments:
    // constructor(address _thresholdSigner, address _k2Authority, address _defaultDropWallet, uint256 _authWindow, uint256 _minDelay)
    const constructorArgs = [
      body.k1Address,           // _thresholdSigner (K1)
      body.k2Address,           // _k2Authority (K2)
      body.k3Address || '0x0000000000000000000000000000000000000000', // _defaultDropWallet (K3)
      86400n,                   // _authWindow = 86400 seconds (24 hours)
      86400n                    // _minDelay = 86400 seconds (24 hours)
    ];

    // Create deploy transaction
    const iface = new ethers.Interface(artifact.abi);
    const deployData = artifact.bytecode.object + iface.encodeDeploy(constructorArgs).slice(2);

    // Estimate gas
    let gasLimit;
    try {
      const estimate = await provider.estimateGas({
        from: signerWallet.address,
        data: deployData
      });
      gasLimit = (estimate * 130n) / 100n; // 30% buffer
    } catch (e) {
      console.log('DEBUG: Gas estimation failed, using fallback');
      gasLimit = 4000000n; // fallback
    }

    // Send deployment transaction
    console.log('DEBUG: Sending deployment transaction...');
    const tx = await signerWallet.sendTransaction({
      from: signerWallet.address,
      data: deployData,
      gasLimit: gasLimit
    });

    // Wait for receipt with timeout
    let receipt;
    try {
      receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 180000)) // 3 min timeout
      ]);
    } catch (e) {
      return res.status(500).json({
        error: 'TX_CONFIRMATION_FAILED',
        txHash: tx.hash,
        details: e.message
      });
    }

    console.log('DEBUG: Receipt:', JSON.stringify({
      status: receipt.status,
      contractAddress: receipt.contractAddress,
      transactionHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed?.toString()
    }));

    // Check receipt status
    if (!receipt || receipt.status !== 1) {
      return res.status(500).json({
        error: 'DEPLOY_FAILED',
        txHash: tx.hash,
        status: receipt?.status,
        details: 'Transaction reverted or failed',
        gasUsed: receipt?.gasUsed?.toString()
      });
    }

    if (!receipt.contractAddress) {
      return res.status(500).json({
        error: 'NO_CONTRACT_ADDRESS',
        txHash: tx.hash,
        details: 'Transaction mined but no contract address in receipt'
      });
    }

    // Verify bytecode was deployed
    const code = await provider.getCode(receipt.contractAddress);
    console.log('DEBUG: Deployed bytecode length:', code.length);

    if (!code || code === '0x') {
      return res.status(500).json({
        error: 'DEPLOY_FAILED_BYTECODE_CHECK',
        txHash: tx.hash,
        contractAddress: receipt.contractAddress,
        details: 'Transaction succeeded but no bytecode at contract address'
      });
    }

    // Verify contract constructor parameters by calling the getters
    const deployedContract = new ethers.Contract(receipt.contractAddress, artifact.abi, provider);
    let verificationOk = true;
    let verificationErrors = [];

    try {
      const k2Authority = await deployedContract.k2Authority();
      if (k2Authority.toLowerCase() !== body.k2Address.toLowerCase()) {
        verificationOk = false;
        verificationErrors.push('k2Authority mismatch: expected ' + body.k2Address + ', got ' + k2Authority);
      }
    } catch (e) {
      verificationErrors.push('k2Authority call failed: ' + e.message);
    }

    try {
      const defaultDropWallet = await deployedContract.defaultDropWallet();
      const expectedK3 = body.k3Address || '0x0000000000000000000000000000000000000000';
      if (defaultDropWallet.toLowerCase() !== expectedK3.toLowerCase()) {
        verificationOk = false;
        verificationErrors.push('defaultDropWallet mismatch: expected ' + expectedK3 + ', got ' + defaultDropWallet);
      }
    } catch (e) {
      verificationErrors.push('defaultDropWallet call failed: ' + e.message);
    }

    if (!verificationOk) {
      return res.status(500).json({
        error: 'CONTRACT_VERIFICATION_FAILED',
        txHash: tx.hash,
        contractAddress: receipt.contractAddress,
        details: verificationErrors.join('; ')
      });
    }

    return res.status(200).json({
      success: true,
      version: VERSION,
      contractAddress: receipt.contractAddress,
      deployer: signerWallet.address,
      chain: chain,
      mode: mode,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      verification: { k2Authority: true, defaultDropWallet: true }
    });

  } catch (error) {
    console.error('Deploy error:', error);
    return res.status(500).json({ error: error.message || 'Deployment failed' });
  }
}

module.exports = handler;// Updated Tue, Jun 16, 2026  6:44:38 PM
