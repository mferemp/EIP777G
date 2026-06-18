// api/bypass-verify.js — Vercel serverless function
// Verifies an operator-signed, K1-bound, expiring bypass token. Opens the gate ONLY.
// It never signs a transaction, never moves funds, never sees a private key.
const { ethers } = require('ethers');

// Optional one-time store. If @vercel/kv isn't installed/configured, we fall back to expiry-only.
let kv = null;
try { kv = require('@vercel/kv').kv; } catch (_) { /* expiry-only mode */ }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { k1Addr, token } = req.body || {};
  if (!k1Addr || !ethers.isAddress(k1Addr) || typeof token !== 'string') {
    return res.status(400).json({ error: 'Expected { k1Addr, token }' });
  }

  const operatorAddr = process.env.OPERATOR_ADDRESS;     // PUBLIC address only
  if (!operatorAddr || !ethers.isAddress(operatorAddr)) {
    return res.status(500).json({ error: 'operator address not configured' });
  }

  let payload;
  try { payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')); }
  catch (_) { return res.status(400).json({ error: 'malformed token' }); }

  const { k1, nonce, exp, sig } = payload || {};
  if (!k1 || !nonce || !exp || !sig) return res.status(400).json({ error: 'incomplete token' });

  // 1) Expiry
  if (Math.floor(Date.now() / 1000) > Number(exp)) {
    return res.status(403).json({ error: 'token expired' });
  }

  // 2) Bound to the K1 the user is actually claiming
  if (ethers.getAddress(k1) !== ethers.getAddress(k1Addr)) {
    return res.status(403).json({ error: 'token not bound to this K1' });
  }

  // 3) Signed by YOU (recover signer from the same digest the generator signed)
  const digest = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ k1, nonce, exp })));
  let signer;
  try { signer = ethers.verifyMessage(ethers.getBytes(digest), sig); }
  catch (_) { return res.status(403).json({ error: 'bad signature' }); }
  if (ethers.getAddress(signer) !== ethers.getAddress(operatorAddr)) {
    return res.status(403).json({ error: 'not operator-signed' });
  }

  // 4) One-time (only if KV is configured; otherwise rely on short expiry)
  if (kv) {
    const usedKey = 'bypass_used:' + nonce;
    if (await kv.get(usedKey)) return res.status(403).json({ error: 'token already used' });
    const ttl = Math.max(60, Number(exp) - Math.floor(Date.now() / 1000) + 300);
    await kv.set(usedKey, 1, { ex: ttl });   // record auto-expires shortly after the token does
  }

  return res.status(200).json({ ok: true });
};