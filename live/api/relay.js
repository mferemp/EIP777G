const { ethers } = require('ethers');

// chainId -> env var name. Values live ONLY in Vercel env (never in code)
const RPC_ENV = {
  1:        'RPC_ETHEREUM',
  10:       'RPC_OPTIMISM',
  137:      'RPC_POLYGON',
  42161:    'RPC_ARBITRUM',
  8453:     'RPC_BASE',
  43114:    'RPC_AVALANCHE',
  56:       'RPC_BNB',
  9745:     'RPC_PLASMA',
  998:      'RPC_HYPERLIQUID',
  57073:    'RPC_INK',
  2741:     'RPC_ABSTRACT',
  10143:    'RPC_MONAD',
};

// Flashbots relay endpoint for Ethereum mainnet
const FLASHBOTS_RELAY = 'https://relay.flashbots.net';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const raw = JSON.stringify(req.body || {});

  // HARD GUARD: refuse anything that looks like a secret leaked into the body
  if (/privateKey|mnemonic|secret|seedPhrase/i.test(raw)) {
    return res.status(400).json({ 
      error: 'Request rejected: looks like it contains a secret. Keys never leave your device.' 
    });
  }

  const { chainId, signedTxs, useFlashbots } = req.body || {};

  if (!Number.isInteger(chainId) || !Array.isArray(signedTxs) || signedTxs.length === 0) {
    return res.status(400).json({ 
      error: 'Expected { chainId:int, signedTxs:[0x...] }' 
    });
  }

  if (!signedTxs.every(t => typeof t === 'string' && /^0x[0-9a-fA-F]+$/.test(t))) {
    return res.status(400).json({ 
      error: 'signedTxs must be 0x-prefixed raw transactions' 
    });
  }

  const envName = RPC_ENV[chainId];
  const rpcUrl  = envName && process.env[envName];

  if (!rpcUrl) {
    return res.status(400).json({ error: `Unsupported chainId ${chainId}` });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const hashes = [];

  try {
    // For Ethereum mainnet with Flashbots, send as private bundle
    if (chainId === 1 && useFlashbots && signedTxs.length > 1) {
      const flashbotsResult = await sendFlashbotsBundle(rpcUrl, signedTxs);
      return res.status(200).json({ ok: true, hashes: flashbotsResult.hashes, bundleHash: flashbotsResult.bundleHash });
    }

    // Standard broadcast for other chains or single transactions
    for (const rawTx of signedTxs) {
      const sent = await provider.broadcastTransaction(rawTx);
      hashes.push(sent.hash);
    }
    return res.status(200).json({ ok: true, hashes });
  } catch (e) {
    console.error('Relay error:', e);
    return res.status(502).json({ error: 'relay failed', detail: String(e.message || e) });
  }
}

// Flashbots bundle submission for Ethereum mainnet
async function sendFlashbotsBundle(rpcUrl, signedTxs) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Create ephemeral wallet for bundle signing (never a user key)
  const bundleSigner = ethers.Wallet.createRandom();
  
  // Get current block
  const block = await provider.getBlock('latest');
  const targetBlock = block.number + 1;
  
  // Parse signed transactions to get metadata for bundle
  const bundleTxs = signedTxs.map((rawTx, index) => {
    const tx = ethers.Transaction.from(rawTx);
    return {
      signedTransaction: rawTx,
      maxBlockNumber: targetBlock + 20, // Valid for next 20 blocks
    };
  });

  // Create Flashbots bundle
  const bundle = {
    txs: bundleTxs.map(t => t.signedTransaction),
    blockNumber: targetBlock.toString(16), // hex
    minTimestamp: 0,
    maxTimestamp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  };

  // Create Flashbots bundle hash for signing
  const bundleHash = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes('flashbots'),
      ethers.keccak256(ethers.concat(bundleTxs.map(t => ethers.getBytes(t.signedTransaction)))),
      ethers.toBeHex(targetBlock, 32),
      ethers.toBeHex(0, 32),
      ethers.toBeHex(Math.floor(Date.now() / 1000) + 300, 32),
    ])
  );
  
  const signature = await bundleSigner.signMessage(ethers.getBytes(bundleHash));
  
  // Submit to Flashbots relay
  const response = await fetch(FLASHBOTS_RELAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendBundle',
      params: [bundle, targetBlock.toString(16), { signature, bundleSigner: bundleSigner.address }],
    }),
  });

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`Flashbots error: ${JSON.stringify(result.error)}`);
  }

  // Return bundle info and individual tx hashes
  const txs = signedTxs.map(rawTx => ethers.Transaction.from(rawTx));
  const hashes = txs.map(tx => tx.hash);
  
  return {
    hashes,
    bundleHash: result.result?.bundleHash || 'unknown',
  };
}

module.exports = handler;