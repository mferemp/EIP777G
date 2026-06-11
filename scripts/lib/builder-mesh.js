/**
 * SecureGate v1 — multi-relay Flashbots builder mesh
 * Owner: Empress (@Hope_ology)
 *
 * Submits the same signed bundle to every builder in parallel per target block.
 * Beats public-mempool sweepers — nothing hits the mempool until inclusion.
 */

const { ethers } = require('ethers');
const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require('@flashbots/ethers-provider-bundle');

const BUILDER_RELAYS = [
  { id: 'flashbots', name: 'FLASHBOTS', url: 'https://relay.flashbots.net' },
  { id: 'builder0x69', name: 'BUILDER0X69', url: 'https://relay.builder0x69.io' },
  { id: 'titan', name: 'TITAN', url: 'https://rpc.titanbuilder.xyz' },
  { id: 'beaver', name: 'BEAVER', url: 'https://relay.beaverbuild.org' },
  { id: 'rsync', name: 'RSYNC', url: 'https://rsync-builder.xyz' },
  { id: 'protect', name: 'PROTECT', url: 'https://relay.flashbots.net' },
];

const PRIORITY_TIERS_GWEI = [15, 25, 30];

function maxBaseFeeInFutureBlock(baseFee, n) {
  let f = BigInt(baseFee);
  for (let i = 0; i < n; i++) f = (f * 1125n) / 1000n + 1n;
  return f;
}

async function createMeshProviders(provider, authSigner) {
  const out = [];
  for (const relay of BUILDER_RELAYS) {
    try {
      const fb = await FlashbotsBundleProvider.create(provider, authSigner, relay.url);
      out.push({ relay, fb });
    } catch (e) {
      console.log(`⚠ mesh ${relay.id} init failed: ${e.message}`);
    }
  }
  if (!out.length) throw new Error('No Flashbots mesh relays available');
  return out;
}

/**
 * Simulate + blast bundle to all builders for up to `windowBlocks` future blocks.
 * Escalates priority fee tiers between windows.
 */
async function submitBundleToMesh({
  provider,
  authSigner,
  signedTxs,
  label = 'bundle',
  windowBlocks = 10,
  hardCapWei,
}) {
  const mesh = await createMeshProviders(provider, authSigner);
  const primary = mesh[0].fb;
  const block = await provider.getBlock('latest');
  if (!block?.baseFeePerGas) throw new Error('Cannot read base fee');

  console.log(`Blitz mesh — ${label}: ${signedTxs.length} tx(s) → ${mesh.length} builders`);

  for (const tierGwei of PRIORITY_TIERS_GWEI) {
    console.log(`\n— Priority tier ${tierGwei} gwei —`);
    for (let offset = 1; offset <= windowBlocks; offset++) {
      const target = block.number + offset;
      const sim = await primary.simulate(signedTxs, target);
      if ('error' in sim) {
        console.log(`  sim block ${target}: ${sim.error.message || sim.error}`);
        continue;
      }
      console.log(`  sim OK block ${target} — broadcasting to ${mesh.length} relays…`);

      const submissions = await Promise.all(
        mesh.map(async ({ relay, fb }) => {
          try {
            const resp = await fb.sendRawBundle(signedTxs, target);
            return { relay: relay.id, resp };
          } catch (e) {
            return { relay: relay.id, error: e.message };
          }
        }),
      );

      const waits = await Promise.all(
        submissions.map(async (s) => {
          if (!s.resp) return { relay: s.relay, resolution: 1, error: s.error };
          try {
            const resolution = await s.resp.wait();
            return { relay: s.relay, resolution };
          } catch (e) {
            return { relay: s.relay, resolution: 1, error: e.message };
          }
        }),
      );

      const included = waits.find(w => w.resolution === FlashbotsBundleResolution.BundleIncluded);
      if (included) {
        console.log(`✓ ${label} included block ${target} via ${included.relay} @ ${tierGwei} gwei`);
        return { ok: true, block: target, relay: included.relay, tierGwei };
      }
      console.log(`  block ${target}: ${waits.map(w => `${w.relay}=${w.resolution}`).join(', ')}`);
    }
  }

  if (hardCapWei) {
    console.error(`Hard cap ${ethers.formatEther(hardCapWei)} ETH — aborting mesh ${label}`);
  }
  return { ok: false };
}

module.exports = {
  BUILDER_RELAYS,
  PRIORITY_TIERS_GWEI,
  maxBaseFeeInFutureBlock,
  createMeshProviders,
  submitBundleToMesh,
};