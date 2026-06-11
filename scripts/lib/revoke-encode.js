/**
 * SecureGate v1 — approval / delegate revoke encoding
 * Owner: Empress (@Hope_ology)
 */

const { ethers } = require('ethers');

const IFACES = {
  erc20: new ethers.Interface(['function approve(address spender, uint256 amount)']),
  erc721: new ethers.Interface(['function setApprovalForAll(address operator, bool approved)']),
  erc1155: new ethers.Interface(['function setApprovalForAll(address operator, bool approved)']),
  gov_delegate: new ethers.Interface(['function delegate(address delegatee)']),
};

const ZERO = '0x0000000000000000000000000000000000000000';

function parseApprovals(raw) {
  if (!raw) return [];
  let list;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    list = JSON.parse(trimmed);
  } else if (Array.isArray(raw)) {
    list = raw;
  } else {
    return [];
  }
  return list.map((a, i) => normalizeApproval(a, i));
}

function normalizeApproval(a, index) {
  if (!a || typeof a !== 'object') throw new Error(`approval[${index}] invalid`);
  const type = (a.type || 'erc20').toLowerCase();
  const token = (a.token || a.contract || '').trim();
  const spender = (a.spender || a.operator || a.delegate || '').trim();
  if (!token || !ethers.isAddress(token)) throw new Error(`approval[${index}] bad token`);
  if (!['gov_delegate'].includes(type) && (!spender || !ethers.isAddress(spender))) {
    throw new Error(`approval[${index}] bad spender/operator`);
  }
  if (!IFACES[type]) throw new Error(`approval[${index}] unknown type: ${type}`);
  return { type, token, spender: spender || ZERO };
}

function encodeRevokeCall(approval) {
  const { type, token, spender } = approval;
  let data;
  if (type === 'erc20') {
    data = IFACES.erc20.encodeFunctionData('approve', [spender, 0]);
  } else if (type === 'erc721' || type === 'erc1155') {
    data = IFACES[type].encodeFunctionData('setApprovalForAll', [spender, false]);
  } else if (type === 'gov_delegate') {
    data = IFACES.gov_delegate.encodeFunctionData('delegate', [ZERO]);
  }
  return { to: token, data, type, spender };
}

module.exports = { parseApprovals, encodeRevokeCall, ZERO };