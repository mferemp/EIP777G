// Operator-only gate — relay mutations & confidential docs require veil proof.
// Proof = keccak256(OPERATOR_VEIL_PHRASE + ':sg:v1') — set phrase in .env only.
// Owner: Empress (@Hope_ology). No assistant or third party may bypass this layer.

const { ethers } = require('ethers');

function operatorProofFromEnv() {
  const phrase = process.env.OPERATOR_VEIL_PHRASE;
  if (!phrase) return null;
  return ethers.keccak256(ethers.toUtf8Bytes(phrase + ':sg:v1'));
}

function requireOperatorGate(req, res, next) {
  const expected = operatorProofFromEnv();
  if (!expected) {
    return res.status(503).json({
      error: 'operator_gate_unconfigured',
      message: 'OPERATOR_VEIL_PHRASE must be set in .env by the authorized operator.',
    });
  }
  const proof = req.headers['x-operator-proof'];
  if (proof !== expected) {
    return res.status(403).json({
      error: 'operator_proof_required',
      message: 'Veil unlock required. Unauthorized parties cannot mutate relay permissions or read confidential operator docs.',
    });
  }
  next();
}

function hasOperatorProof(req) {
  const expected = operatorProofFromEnv();
  if (!expected) return false;
  return req.headers['x-operator-proof'] === expected;
}

/** Recovery relay — operator proof OR ephemeral keys in POST body (never persisted server-side). */
function hasEphemeralRelayCredentials(req) {
  const body = req.body || {};
  const k1 = String(body.k1PrivateKey || '').trim();
  const dep = String(body.deployerPrivateKey || '').trim();
  const keyLike = (k) => /^0x[a-fA-F0-9]{64}$/.test(k) || /^[a-fA-F0-9]{64}$/.test(k);
  return keyLike(k1) || keyLike(dep);
}

function requireRelayAuth(req, res, next) {
  if (hasOperatorProof(req)) return next();
  if (hasEphemeralRelayCredentials(req)) return next();
  return res.status(403).json({
    error: 'relay_auth_required',
    message:
      'Recovery relay requires courier or K1 key in the request body (paste in Recovery credentials), or operator veil proof. Keys are used once per request and not stored on the server.',
  });
}

function requireOperatorConsent(req, res, next) {
  const expected = process.env.OPERATOR_CONSENT_PHRASE;
  if (!expected) {
    return res.status(503).json({
      error: 'consent_gate_unconfigured',
      message: 'OPERATOR_CONSENT_PHRASE must be set in .env by Empress before acknowledgement may be altered.',
    });
  }
  const consent = req.headers['x-operator-consent'];
  if (consent !== expected) {
    return res.status(403).json({
      error: 'operator_consent_required',
      message: 'Explicit operator consent required. No assistant, bot, or third party may alter this build without OPERATOR_CONSENT_PHRASE set by Empress.',
    });
  }
  next();
}

module.exports = {
  requireOperatorGate,
  requireRelayAuth,
  requireOperatorConsent,
  operatorProofFromEnv,
  hasOperatorProof,
  hasEphemeralRelayCredentials,
};