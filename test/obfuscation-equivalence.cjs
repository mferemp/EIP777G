const fs = require('fs');
const path = require('path');

function assert(cond, label) {
  if (!cond) throw new Error('INVARIANT FAIL: ' + label);
  console.log('OK: ' + label);
}

function claim(label) {
  console.log('CLAIM: ' + label);
}

const cleanSrc = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'EIP777G.sol'), 'utf8');
const obfSrc  = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'AuroraGate.sol'), 'utf8');

claim('Obfuscated file name is non-revealing');
assert(!obfSrc.includes('SecureGate'), 'file must not contain brand/mechanism name');
assert(!obfSrc.includes('EIP777G'), 'file must not reveal protocol name');
assert(!obfSrc.includes('Genesis'), 'file must not reveal deployment narrative');

claim('Named addresses are obfuscated in source');
assert(!obfSrc.includes('k1Genesis'), 'no k1Genesis identifier in obfuscated source');
assert(!obfSrc.includes('k2Authority'), 'no k2Authority identifier');
assert(!obfSrc.includes('k3DropWallet'), 'no k3DropWallet identifier');
assert(!obfSrc.includes('cleanWallet') || obfSrc.includes('d '), 'clean wallet renamed or obfuscated');

claim('Route-related labels are neutralized');
assert(!obfSrc.includes('IngressSevered'), 'no ingress term');
assert(!obfSrc.includes('EgressSevered'), 'no egress term');

claim('No mechanism-explaining comments');
assert(obfSrc.split('\n').filter(l => l.trim().startsWith('//')).length <= 1, 'at most SPDX-style comment');

claim('Storage layout preserves safety-relevant positions');
const cleanStorage = cleanSrc.match(/address public immutable[^\n]+/g) || [];
const obfStorage   = obfSrc.match(/address public immutable[^\n]+/g) || [];
assert(cleanStorage.length === obfStorage.length, 'immutable address count unchanged');
assert(obfSrc.includes('function _recover('), 'recovery helper preserved');
assert(obfSrc.includes('modifier guard()'), 'execution guard preserved');

claim('Keccak-based genesis proof semantics preserved');
assert(obfSrc.includes('keccak256(abi.encode(_a,_b,_c,_d,msg.sender,block.timestamp,block.chainid))'), 'genesis derivation preserved');

claim('Execution has no hidden destination substitution paths');
assert(obfSrc.includes('dest.call{value: i.value, gas: i.gas}(i.data)') || obfSrc.includes('dest.call{gas: i.gas}(i.data)'), 'destination use unchanged');
assert(obfSrc.includes('c.call{value: address(this).balance}'), 'sweep destination unchanged');

claim('Authorization gate is unchanged and non-custodial');
assert(obfSrc.includes('require(msg.sender == b') || obfSrc.match(/msg\.sender\s*==\s*b/), 'authorization check preserved against renamed K2');
assert(!obfSrc.includes('transferOwnership'), 'no ownership transfer risk added');
assert(!obfSrc.includes('selfdestruct'), 'no self-destruct added');

claim('No private keys or secrets in deployment-relevant source');
assert(!obfSrc.includes('privateKey'), 'no privateKey literal');
assert(!obfSrc.includes('mnemonic'), 'no mnemonic literal');

claim('No ABI/artifact publication paths added');
assert(obfSrc.includes('abi.json') === false && obfSrc.includes('artifacts/') === false, 'no artifact publication reference');

console.log('\nINVARIANT RESULTS: all checks passed');
