const crypto = require('crypto');

/**
 * MASTER PASSKEY SYSTEM
 * =====================
 * Your personal admin passkey allows you to:
 * 1. Access admin dashboard functions
 * 2. Generate one-time user auth keys for users who prove ownership via DM
 * 3. Cannot be used to bypass Auth-Gate — only to GENERATE keys for others
 * 
 * SETUP INSTRUCTIONS:
 * 1. Choose a strong passkey (e.g., 32+ random characters)
 * 2. Run: node .master-passkey-setup.cjs "YOUR_PASSKEY_HERE"
 * 3. Copy the MASTER_PASSKEY_HASH and add to .env.development.local
 * 4. Input the passkey into the admin field on your dashboard
 */

function generateMasterPasskeyHash(passkey) {
  if (!passkey) {
    console.error('❌ USAGE: node .master-passkey-setup.cjs "YOUR_PASSKEY"');
    process.exit(1);
  }
  
  const hash = crypto.createHash('sha256').update(passkey).digest('hex');
  console.log('\n=== MASTER PASSKEY HASH ===');
  console.log(`Passkey: ${passkey}`);
  console.log(`Hash: ${hash}`);
  console.log('\n=== ADD TO .env.development.local ===');
  console.log(`MASTER_PASSKEY_HASH=${hash}`);
  console.log('\n=== DASHBOARD USAGE ===');
  console.log('1. Open dashboard');
  console.log('2. Click hidden TARDIS admin button');
  console.log(`3. Input passkey: ${passkey}`);
  console.log('4. Admin panel unlocks → Generate user auth keys\n');
}

// Run with provided passkey
const passkey = process.argv[2];
generateMasterPasskeyHash(passkey);
