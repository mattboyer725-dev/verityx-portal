/**
 * CJS port of verityx-local-core v1.6.0 merkle.py + event_store.py
 * SHA 319af22fc87271665ec0e453a73b9946a4473104
 */
const crypto = require('crypto');

const CORE_VERSION = '1.6.0';
const CORE_SHA = '319af22fc87271665ec0e453a73b9946a4473104';
const CORE_REPO = 'mattboyer725-dev/verityx-local-core';
const SECRET = Buffer.from('verityx-desk-local-core-hmac-v1.6.0-siemens-gamesa-magnetics');
const LOG = [];
let seeded = false;

function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]));
  }
  return v;
}
function canonical(obj) {
  return JSON.stringify(sorted(obj));
}
function bodyOf(e) {
  return {
    actor: e.actor,
    event_id: e.event_id,
    event_type: e.event_type,
    payload: e.payload,
    prev_hash: e.prev_hash,
    timestamp: e.timestamp,
  };
}
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function hmac(buf) {
  return crypto.createHmac('sha256', SECRET).update(buf).digest('hex');
}
function signAndHash(draft) {
  const can = Buffer.from(canonical(bodyOf(draft)));
  const signature = hmac(can);
  const hash = sha256(Buffer.concat([can, Buffer.from(signature)]));
  return { signature, hash };
}
function leafHash(h) {
  return sha256(Buffer.concat([Buffer.from([0x00]), Buffer.from(h, 'hex')]));
}
function hashPair(l, r) {
  return sha256(Buffer.concat([Buffer.from([0x01]), Buffer.from(l, 'hex'), Buffer.from(r, 'hex')]));
}
function buildLevels(hashes) {
  if (!hashes.length) return [];
  let level = hashes.map(leafHash);
  const levels = [level];
  while (level.length > 1) {
    const nxt = [];
    for (let i = 0; i < level.length; i += 2) {
      nxt.push(hashPair(level[i], level[i + 1] || level[i]));
    }
    level = nxt;
    levels.push(level);
  }
  return levels;
}
function merkleRootOf(hashes) {
  if (!hashes.length) return '0'.repeat(64);
  const levels = buildLevels(hashes);
  return levels[levels.length - 1][0];
}
function inclusionProof(hashes, index) {
  const levels = buildLevels(hashes);
  const path = [];
  let idx = index;
  for (const level of levels.slice(0, -1)) {
    const even = idx % 2 === 0;
    const sib = even ? (idx + 1 < level.length ? idx + 1 : idx) : idx - 1;
    path.push({ sibling: level[sib], side: even ? 'R' : 'L' });
    idx = Math.floor(idx / 2);
  }
  return { root: levels[levels.length - 1][0], path };
}
function verifyInclusion(hash, index, path, root) {
  let running = leafHash(hash);
  let idx = index;
  for (const step of path) {
    const expected = idx % 2 === 0 ? 'R' : 'L';
    if (step.side !== expected) return false;
    running = step.side === 'L' ? hashPair(step.sibling, running) : hashPair(running, step.sibling);
    idx = Math.floor(idx / 2);
  }
  return idx === 0 && running === root;
}
function uuid() {
  return crypto.randomUUID();
}
function appendCoreEvent(type, payload, actor) {
  const prev_hash = LOG.length ? LOG[LOG.length - 1].hash : '0'.repeat(64);
  const draft = {
    event_id: uuid(),
    event_type: type,
    payload,
    actor: actor || 'elena.hartmann',
    timestamp: Date.now() / 1000,
    prev_hash,
  };
  const { signature, hash } = signAndHash(draft);
  const event = { ...draft, signature, hash };
  LOG.push(event);
  return event;
}
function verifyChain() {
  const errors = [];
  let prev = '0'.repeat(64);
  for (let i = 0; i < LOG.length; i++) {
    const e = LOG[i];
    if (e.prev_hash !== prev) errors.push('link ' + i + ': prev_hash mismatch');
    const { signature, hash } = signAndHash(e);
    if (signature !== e.signature) errors.push('link ' + i + ': hmac mismatch');
    if (hash !== e.hash) errors.push('link ' + i + ': hash mismatch');
    prev = e.hash;
  }
  return { ok: errors.length === 0, bad: errors.length, errors, depth: LOG.length };
}
function eventHashes() {
  return LOG.map((e) => e.hash);
}
function listEvents() {
  return LOG.map((e) => ({
    id: e.event_id,
    type: e.event_type,
    hash: e.hash,
    mac: e.signature.slice(0, 16),
    ts: new Date(e.timestamp * 1000).toISOString(),
  }));
}
function merkleSnapshot() {
  const hashes = eventHashes();
  return {
    version: CORE_VERSION,
    merkle_root: merkleRootOf(hashes),
    leaf_count: hashes.length,
    first_event_id: LOG[0] ? LOG[0].event_id : null,
    last_event_id: LOG.length ? LOG[LOG.length - 1].event_id : null,
    generated_at: new Date().toISOString(),
    mesh_peer: false,
    algorithm: 'HMAC-SHA256 + Merkle SHA256 domain-separated (0x00 leaf / 0x01 pair)',
    sha: CORE_SHA,
    repo: CORE_REPO,
  };
}
function doctor() {
  const chain = verifyChain();
  const snap = merkleSnapshot();
  return {
    overall: chain.ok ? 'ok' : 'fail',
    version: CORE_VERSION,
    sha: CORE_SHA,
    repo: CORE_REPO,
    mesh_peer: false,
    checks: {
      secret: { status: 'ok', bytes: SECRET.length },
      chain: { status: chain.ok ? 'ok' : 'fail', depth: chain.depth, bad: chain.bad },
      merkle: { status: 'ok', root: snap.merkle_root, leaves: snap.leaf_count },
      mesh: { status: 'ok', peer: false },
    },
  };
}
function ensureGenesis() {
  if (seeded || LOG.length) return;
  seeded = true;
  appendCoreEvent('system.ping', { ok: true, detail: 'local-core genesis' }, 'local-core');
  appendCoreEvent('session.mark', { label: 'desk-open', ns: 'siemens-gamesa' }, 'elena.hartmann');
  appendCoreEvent('memory.set', { ns: 'siemens-gamesa', key: 'desk', value: 'magnetics' }, 'mattboyer725');
  appendCoreEvent(
    'artifact.record',
    {
      title: 'verityx-local-core v1.6.0',
      location: 'https://github.com/mattboyer725-dev/verityx-local-core',
      kind: 'repo',
    },
    'mattboyer725',
  );
}

module.exports = {
  CORE_VERSION,
  CORE_SHA,
  CORE_REPO,
  LOCAL_CORE: { version: CORE_VERSION, repo: CORE_REPO, sha: CORE_SHA },
  merkleRootOf,
  inclusionProof,
  verifyInclusion,
  leafHash,
  hashPair,
  appendCoreEvent,
  verifyChain,
  eventHashes,
  listEvents,
  merkleSnapshot,
  merkleProofAt: (i) => {
    const hashes = eventHashes();
    const { root, path } = inclusionProof(hashes, i);
    return { index: i, root, path, valid: verifyInclusion(hashes[i], i, path, root), leaf: hashes[i] };
  },
  doctor,
  ensureGenesis,
};
