/* ────────────────────────────────────────────────────────────────────────
   POST /api/recovery/execute  —  atomic approval-severance batch
   ------------------------------------------------------------------------
   Spec: "Revokes — atomic approval severance (npm run revoke)" via a
   Flashbots builder mesh, submitted so the malicious sweeper bot on K1
   cannot front-run or steal the gas.

   WHY the old client-side revoke did nothing:
     The dashboard sent approve(0) FROM K1 directly. K1 is the compromised
     wallet — a sweeper bot instantly drains any ETH sent to it for gas, so
     K1 could never pay for (and therefore never broadcast) a revoke.

   HOW this fixes it (per spec — no EIP-7702 anywhere):
     Build ONE atomic bundle:
       tx[0]      Deployer (courier) -> K1 : sends EXACT gas for the revokes
       tx[1..N]   K1 -> token        : approve(spender,0) /
                                        setApprovalForAll(spender,false)
     The whole bundle executes atomically, in order, inside a single block.
     Because it is submitted PRIVATELY to the builder mesh (not the public
     mempool) the sweeper never sees the funding tx arrive and cannot insert
     its drain tx between the funding and the revokes. If any tx reverts the
     entire bundle is dropped — the courier never loses funds to a partial
     execution.

     Mainnet (chainId 1): submitted to the Flashbots relay multiplexed across
     the full builder mesh, and re-submitted for several consecutive target
     blocks ("multiple flashbot deployment") to maximise inclusion odds
     against the sweeper.

     Chains without a Flashbots relay (L2s, HL-EVM 999, etc.): there is no
     private builder mesh, so the bundle is broadcast as a tightly-sequenced
     high-priority-fee funding+revoke sequence. This is best-effort, not
     sweeper-proof, and is reported as such per chain.

   Auth: X-Operator-Proof = keccak256(veilPhrase + ':sg:v1').
   ──────────────────────────────────────────────────────────────────────── */

import { ethers } from 'ethers';

/* ── builder mesh (mainnet) ──────────────────────────────────────────────
   The Flashbots relay multiplexes to every builder named in `builders`.    */
const FLASHBOTS_RELAY = 'https://relay.flashbots.net';
const MAINNET_BUILDERS = [
  'flashbots', 'f1b.io', 'rsync', 'beaverbuild.org', 'builder0x69',
  'Titan', 'EigenPhi', 'boba-builder', 'Gambit Labs', 'payload',
  'Loki', 'BuildAI', 'JetBuilder', 'tbuilder', 'penguinbuild', 'bobthebuilder'
];
/* Standalone builder endpoints that also accept eth_sendBundle directly,
   used in addition to the relay for redundancy. */
const MAINNET_DIRECT = [
  'https://rpc.beaverbuild.org',
  'https://rsync-builder.xyz',
  'https://rpc.titanbuilder.xyz',
  'https://builder0x69.io',
  'https://rpc.payload.de'
];

const ERC20_APPROVE_SEL      = '0x095ea7b3'; // approve(address,uint256)
const ERC721_SETALL_SEL      = '0xa22cb465'; // setApprovalForAll(address,bool)

function keccakPhrase(phrase){
  return ethers.keccak256(ethers.toUtf8Bytes(String(phrase) + ':sg:v1'));
}

/* Operator veil gate. Enforces X-Operator-Proof against OPERATOR_VEIL_PHRASE
   (env) or the documented veil phrase fallback so it works out of the box. */
function verifyOperator(req){
  const proof = req.headers['x-operator-proof'];
  if(!proof) return false;
  const candidates = [];
  if(process.env.OPERATOR_VEIL_PHRASE) candidates.push(process.env.OPERATOR_VEIL_PHRASE);
  candidates.push('Hope_ology'); // documented session veil phrase
  return candidates.some(p => keccakPhrase(p).toLowerCase() === String(proof).toLowerCase());
}

function encodeRevoke(a){
  const spender = ethers.zeroPadValue(ethers.getAddress(a.spender), 32);
  if(a.type === 'ERC721' || a.type === 'ERC-721' || a.isAll){
    // setApprovalForAll(spender,false)
    return ERC721_SETALL_SEL + spender.slice(2) + ethers.zeroPadValue('0x00', 32).slice(2);
  }
  // approve(spender,0)
  return ERC20_APPROVE_SEL + spender.slice(2) + ethers.zeroPadValue('0x00', 32).slice(2);
}

async function flashbotsSend(url, body, authSigner){
  const payload = JSON.stringify(body);
  const signature = authSigner.address + ':' +
    await authSigner.signMessage(ethers.getBytes(ethers.id(payload)));
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Flashbots-Signature': signature },
    body: payload
  });
  let json = null;
  try { json = await resp.json(); } catch(e){ /* builder returned non-json */ }
  return { status: resp.status, json };
}

export default async function handler(req, res){
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  if(!verifyOperator(req)){
    res.status(403).json({ error: 'operator veil proof required' });
    return;
  }

  const body = req.body || {};
  const { chainId, rpcUrl, k1Key, deployerKey, approvals } = body;
  const targetBlocks = Math.min(Math.max(parseInt(body.targetBlocks || 8, 10), 1), 25);

  if(!rpcUrl || !k1Key || !deployerKey || !Array.isArray(approvals) || !approvals.length){
    res.status(400).json({ error: 'rpcUrl, k1Key, deployerKey and non-empty approvals[] are required' });
    return;
  }

  try {
    const cid = Number(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl, cid, { staticNetwork: true });
    const k1 = new ethers.Wallet(k1Key, provider);
    const deployer = new ethers.Wallet(deployerKey, provider);
    /* random, fundless identity used only to authenticate to the relay */
    const authSigner = ethers.Wallet.createRandom();

    const [net, k1Nonce, depNonce, feeData, latestBlock] = await Promise.all([
      provider.getNetwork(),
      provider.getTransactionCount(k1.address, 'latest'),
      provider.getTransactionCount(deployer.address, 'latest'),
      provider.getFeeData(),
      provider.getBlockNumber()
    ]);

    /* Correct the priority fee: many chains reject the ethers default.
       Query the network's suggested tip and add headroom. */
    let priority = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
    try {
      const tipHex = await provider.send('eth_maxPriorityFeePerGas', []);
      const netTip = (BigInt(tipHex) * 120n) / 100n;
      if(netTip > priority) priority = netTip;
    } catch(e){ /* method unsupported — keep ethers value */ }
    let maxFee = feeData.maxFeePerGas || ethers.parseUnits('40', 'gwei');
    if(maxFee < priority) maxFee = priority * 2n;

    const perRevokeGas = 60000n; // headroom over ~46k for approve/setApprovalForAll
    const revokeCount = BigInt(approvals.length);
    const totalRevokeGas = perRevokeGas * revokeCount;
    /* fund K1 with exactly the gas the revokes will burn (worst case) */
    const fundingValue = totalRevokeGas * maxFee;

    /* ── build signed txs ── */
    // tx[0] deployer -> K1 funding
    const fundTx = await deployer.signTransaction({
      to: k1.address, value: fundingValue, nonce: depNonce,
      gasLimit: 21000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: priority,
      chainId: cid, type: 2
    });
    const signedTxs = [fundTx];
    // tx[1..N] K1 -> token revokes
    for(let i = 0; i < approvals.length; i++){
      const a = approvals[i];
      const raw = await k1.signTransaction({
        to: ethers.getAddress(a.token), data: encodeRevoke(a), value: 0n,
        nonce: k1Nonce + i, gasLimit: perRevokeGas,
        maxFeePerGas: maxFee, maxPriorityFeePerGas: priority,
        chainId: cid, type: 2
      });
      signedTxs.push(raw);
    }

    const hasFlashbots = (cid === 1);
    const submissions = [];

    if(hasFlashbots){
      /* mainnet: multiplex across the builder mesh, for several target blocks */
      for(let b = 1; b <= targetBlocks; b++){
        const targetBlock = latestBlock + b;
        const bundle = {
          jsonrpc: '2.0', id: b, method: 'eth_sendBundle',
          params: [{
            txs: signedTxs,
            blockNumber: '0x' + targetBlock.toString(16),
            builders: MAINNET_BUILDERS
          }]
        };
        const relayResult = await flashbotsSend(FLASHBOTS_RELAY, bundle, authSigner);
        submissions.push({ target: 'flashbots-relay', block: targetBlock, status: relayResult.status,
          result: relayResult.json && (relayResult.json.result || relayResult.json.error) });
        /* also hit standalone builders directly for redundancy */
        for(const url of MAINNET_DIRECT){
          try {
            const r = await flashbotsSend(url, bundle, authSigner);
            submissions.push({ target: url, block: targetBlock, status: r.status,
              result: r.json && (r.json.result || r.json.error) });
          } catch(e){ submissions.push({ target: url, block: targetBlock, error: e.message }); }
        }
      }
      res.status(200).json({
        ok: true, mode: 'flashbots-mesh', chainId: cid,
        network: net.name, revokes: approvals.length, targetBlocks,
        fundingWei: fundingValue.toString(), maxFeePerGasWei: maxFee.toString(),
        submissions,
        note: 'Bundle submitted privately to the builder mesh across ' + targetBlocks +
              ' blocks. Inclusion is not guaranteed on any single block; monitor K1 approvals to confirm severance.'
      });
      return;
    }

    /* ── non-Flashbots chains: best-effort sequenced broadcast ──
       No private mesh available. Broadcast the funding tx then the revokes
       with a high priority fee. NOT sweeper-proof — reported honestly. */
    const broadcast = [];
    try {
      const fh = await provider.send('eth_sendRawTransaction', [fundTx]);
      broadcast.push({ step: 'fund', hash: fh });
      // wait for funding to land so K1 has gas
      await provider.waitForTransaction(fh, 1, 60000);
    } catch(e){ broadcast.push({ step: 'fund', error: e.message }); }
    for(let i = 1; i < signedTxs.length; i++){
      try {
        const h = await provider.send('eth_sendRawTransaction', [signedTxs[i]]);
        broadcast.push({ step: 'revoke', index: i - 1, hash: h });
      } catch(e){ broadcast.push({ step: 'revoke', index: i - 1, error: e.message }); }
    }
    res.status(200).json({
      ok: true, mode: 'public-sequenced', chainId: cid, network: net.name,
      revokes: approvals.length, broadcast,
      warning: 'This chain has no Flashbots builder mesh. Revokes were broadcast publicly and are NOT protected against a front-running sweeper. Verify approvals on-chain.'
    });
  } catch(err){
    console.log('[recovery/execute] error:', err && err.message);
    res.status(500).json({ error: (err && err.message) || 'revoke batch failed' });
  }
}
