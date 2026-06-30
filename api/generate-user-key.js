import crypto from 'crypto';

/**
 * GENERATE USER AUTH KEY ENDPOINT
 * ===============================
 * Admin-only endpoint to issue one-time bypass tokens for users.
 * Requires MASTER_PASSKEY_HASH in Authorization header (hashed).
 * 
 * POST /api/generate-user-key
 * Authorization: sha256-hash of master passkey
 * Body: { k1: "0xaddress" }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { k1 } = req.body || {};

  if (!k1 || typeof k1 !== 'string') {
    return res.status(400).json({ error: 'k1 address required' });
  }

  // Validate K1 address format
  if (!/^0x[a-fA-F0-9]{40}$/i.test(k1)) {
    return res.status(400).json({ error: 'invalid k1 address format' });
  }

  // Admin authorization via master passkey hash
  const authHeader = req.headers.authorization || '';
  const providedHash = authHeader.replace('Bearer ', '');
  const expectedHash = process.env.MASTER_PASSKEY_HASH;

  if (!expectedHash) {
    return res.status(500).json({ error: 'admin passkey not configured' });
  }

  if (providedHash !== expectedHash) {
    return res.status(403).json({ error: 'unauthorized' });
  }

  const adminSecret = process.env.ADMIN_TOKEN_SECRET;
  if (!adminSecret) {
    return res.status(500).json({ error: 'token secret not configured' });
  }

  // Generate one-time user key
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + 86400; // 24 hours

  const payload = {
    k1: k1.toLowerCase(),
    nonce,
    exp
  };

  const hmac = crypto
    .createHmac('sha256', adminSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const tokenPayload = {
    ...payload,
    hmac
  };

  const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

  return res.status(200).json({
    ok: true,
    token,
    k1: k1.toLowerCase(),
    expires: new Date(exp * 1000).toISOString(),
    instructions: `Share this token with the user. They paste it into their dashboard's admin key field to bypass Auth-Gate.`
  });
}
