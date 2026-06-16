/**
 * Builder mesh relay router — live reachability probes.
 * Owner: Empress (@Hope_ology)
 */

const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

const RELAYS = [
  { id: 'flashbots', name: 'FLASHBOTS', url: 'https://relay.flashbots.net' },
  { id: 'protect', name: 'PROTECT', url: 'https://rpc.flashbots.net' },
  { id: 'builder0x69', name: 'BUILDER0X69', url: 'https://builder0x69.io' },
  { id: 'rsync', name: 'RSYNC', url: 'https://rsync-builder.xyz' },
  { id: 'titan', name: 'TITAN', url: 'https://rpc.titanbuilder.xyz' },
  { id: 'beaver', name: 'BEAVER', url: 'https://rpc.beaverbuild.org' },
];

async function probeRelay(relay) {
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(relay.url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'SecureGate-777G/1.0' },
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    const online = res.status < 500;
    return {
      id: relay.id,
      name: relay.name,
      url: relay.url,
      status: online ? 'online' : 'offline',
      httpStatus: res.status,
      latencyMs,
    };
  } catch (err) {
    return {
      id: relay.id,
      name: relay.name,
      url: relay.url,
      status: 'offline',
      httpStatus: null,
      latencyMs: Date.now() - started,
      error: err.message,
    };
  }
}

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'securegate-777g-relay' });
});

router.get('/mesh', async (req, res) => {
  try {
    const relays = await Promise.all(RELAYS.map(probeRelay));
    const online = relays.filter(r => r.status === 'online').length;
    res.json({
      ok: true,
      ts: new Date().toISOString(),
      online,
      total: relays.length,
      relays,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;