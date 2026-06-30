#!/usr/bin/env node

const crypto = require('crypto');

/**
 * GENERATE USER AUTH KEY
 * ======================
 * Use this to create one-time bypass tokens for users who prove ownership via DM.
 * 
 * USAGE:
 *   node scripts/generate-user-key.cjs "USER_K1_ADDRESS" "ADMIN_TOKEN_SECRET"
 * 
 * EXAMPLE:
 *   node scripts/generate-user-key.cjs "0x1234..." "your-secret-from-env"
 * 
 * OUTPUT:
 *   Base64URL-encoded token → User inputs into their dashboard admin field
 * 
 * SECURITY:
 * - This token works ONLY for this specific K1 address
 * - Token expires after 24 hours (configurable)
 * - Token consumed after one use (tracked in Redis)
 * - User cannot reuse it or pass it to others
 * - Your master passkey is NOT exposed to users
 */

const k1Address = process.argv[2];
const adminSecret = process.argv[3];

if (!k1Address || !adminSecret) {
  console.error('USAGE: node scripts/generate-user-key.cjs "0xK1Address" "admin_secret"');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/generate-user-key.cjs "0x1234567890123456789012345678901234567890" "my-super-secret-key"');
  process.exit(1);
}

// Validate K1 address format
if (!/^0x[a-fA-F0-9]{40}$/.test(k1Address)) {
  console.error('❌ Invalid K1 address format. Must be 0x followed by 40 hex chars.');
  process.exit(1);
}

// Generate token
const nonce = crypto.randomBytes(16).toString('hex');
const exp = Math.floor(Date.now() / 1000) + 86400; // 24 hours

const payload = {
  k1: k1Address.toLowerCase(),
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

console.log('\n=== GENERATED USER AUTH KEY ===\n');
console.log('K1 Address:', k1Address);
console.log('Nonce:', nonce);
console.log('Expires:', new Date(exp * 1000).toISOString());
console.log('\n=== TOKEN (share with user) ===\n');
console.log(token);
console.log('\n=== INSTRUCTIONS FOR USER ===\n');
console.log('1. Open dashboard at eip777g.vercel.app');
console.log('2. Click hidden TARDIS admin button (or auth bypass trigger)');
console.log('3. Paste this token into the "User Key" field');
console.log('4. Click "Verify" to unlock Auth-Gate bypass');
console.log('5. Token is consumed after one use and cannot be reused\n');
