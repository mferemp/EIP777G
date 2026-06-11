#!/usr/bin/env node
/**
 * SecureGate v1 — Ethereum mainnet gate deploy entry
 * Owner: Empress
 *
 * Delegates to eth-blitz-deploy.js (6-builder Flashbots mesh).
 * Severance on ethereum must be complete first.
 */

process.env.DEPLOY_FABRIC = 'ethereum';
require('./scripts/eth-blitz-deploy.js');