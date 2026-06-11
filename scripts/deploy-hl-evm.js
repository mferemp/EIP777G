#!/usr/bin/env node
/**
 * SecureGate v1 — Hyperliquid EVM Deploy
 * Owner: Empress
 *
 * Thin wrapper — delegates to deploy-fabric.js with DEPLOY_FABRIC=hl-evm
 */

process.env.DEPLOY_FABRIC = 'hl-evm';
require('./deploy-fabric.js');