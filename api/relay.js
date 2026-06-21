import { ethers } from 'ethers';

const RPC_ENV = {
  1: 'RPC_ETHEREUM',
  10: 'RPC_OPTIMISM',
  137: 'RPC_POLYGON',
  42161: 'RPC_ARBITRUM',
  8453: 'RPC_BASE',
  43114: 'RPC_AVALANCHE',
  56: 'RPC_BNB',
  9745: 'RPC_PLASMA',
  998: 'RPC_HYPERLIQUID',
  57073: 'RPC_INK',
  2741: 'RPC_ABSTRACT',
  10143: 'RPC_MONAD',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const rawBody = JSON.stringify(req.body || {});

  if (/privateKey|mnemonic|secret|seedPhrase/i.test(rawBody)) {
    return res.status(400).json({ error: 'Request rejected: looks like it contains a secret. Keys never leave your device.' });
  }

  const { chainId, signedTxs } = req.body || {};

  if (!Number.isInteger(chainId) || !Array.isArray(signedTxs) || signedTxs.length === 0) {
    return res.status(400).json({ error: 'Expected { chainId:int, signedTxs:[0x...] }' });
  }

  if (!signedTxs.every(t => typeof t === 'string' && /^0x[0-9a-fA-F]+$/.test(t))) {
    return res.status(400).json({ error: 'signedTxs must be 0x-prefixed raw transactions' });
  }

  const envName = RPC_ENV[chainId];
  const rpcUrl = envName && process.env[envName];

  if (!rpcUrl) {
    return res.status(400).json({ error: `Unsupported chainId ${chainId}` });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const hashes = [];

    for (const rawTx of signedTxs) {
      const sent = await provider.broadcastTransaction(rawTx);
      hashes.push(sent.hash);
    }

    return res.status(200).json({ ok: true, hashes });
  } catch (e) {
    console.error('relay failed', e);
    return res.status(502).json({ error: 'relay failed', detail: String(e && e.message ? e.message : e) });
  }
}

