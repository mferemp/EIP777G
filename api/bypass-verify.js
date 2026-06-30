import { ethers } from 'ethers';
import crypto from 'crypto';

let kv = null;

try {
  const mod = await import('@vercel/kv');
  kv = mod.kv;
} catch (_) {
  kv = null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { k1Addr, token } = req.body || {};

  if (typeof token !== 'string') {
    return res.status(400).json({ error: 'Expected { token }' });
  }

  let payload;

  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch (_) {
    return res.status(400).json({ error: 'malformed token' });
  }

  const { k1, nonce, exp, hmac } = payload || {};

  if (!k1 || !nonce || !exp || !hmac) {
    return res.status(400).json({ error: 'incomplete token' });
  }

  if (Math.floor(Date.now() / 1000) > Number(exp)) {
    return res.status(403).json({ error: 'token expired' });
  }

  const resolvedK1Addr = k1Addr || k1;

  if (!resolvedK1Addr || !ethers.isAddress(resolvedK1Addr) || ethers.getAddress(k1) !== ethers.getAddress(resolvedK1Addr)) {
    return res.status(403).json({ error: 'token not bound to this K1' });
  }

  // Validate HMAC (token issued by admin via master passkey, not operator-signed)
  const adminSecret = process.env.ADMIN_TOKEN_SECRET;
  if (!adminSecret) {
    return res.status(500).json({ error: 'admin token secret not configured' });
  }

  const expectedHmac = crypto
    .createHmac('sha256', adminSecret)
    .update(JSON.stringify({ k1, nonce, exp }))
    .digest('hex');

  if (hmac !== expectedHmac) {
    return res.status(403).json({ error: 'invalid token hmac' });
  }

  if (kv) {
    const usedKey = `bypass_used:${nonce}`;

    if (await kv.get(usedKey)) {
      return res.status(403).json({ error: 'token already used' });
    }

    const ttl = Math.max(60, Number(exp) - Math.floor(Date.now() / 1000) + 300);
    await kv.set(usedKey, 1, { ex: ttl });
  }

  return res.status(200).json({ ok: true });
}

