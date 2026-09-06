/**
 * Faithful port of mattboyer725-dev/verityx-local-core v1.6.0
 * SHA 319af22fc87271665ec0e453a73b9946a4473104
 *
 * Crypto matches event_store.py + merkle.py:
 *   canonical = JSON(body without signature/hash, sort_keys, separators=(",", ":"))
 *   signature = HMAC-SHA256(secret, canonical)
 *   hash      = SHA256(canonical || signature)
 *   leaf      = SHA256(0x00 || hash_bytes)
 *   pair      = SHA256(0x01 || left || right)
 *
 * In-memory (Vercel has no durable local FS). Not a mesh peer.
 */

export const CORE_VERSION = "1.6.0";
export const CORE_SHA = "319af22fc87271665ec0e453a73b9946a4473104";
export const CORE_REPO = "mattboyer725-dev/verityx-local-core";

const CORE_SECRET = new TextEncoder().encode(
  "verityx-desk-local-core-hmac-v1.6.0-siemens-gamesa-magnetics",
);

export type CoreEventType =
  | "system.ping"
  | "session.mark"
  | "session.close"
  | "decision.record"
  | "artifact.record"
  | "note.append"
  | "memory.set"
  | "memory.delete";

export type CoreEvent = {
  event_id: string;
  event_type: CoreEventType;
  payload: Record<string, unknown>;
  actor: string;
  timestamp: number;
  prev_hash: string;
  signature: string;
  hash: string;
};

export type CoreEventView = {
  id: string;
  type: CoreEventType;
  hash: string;
  mac: string;
  ts: string;
  actor: string;
  payload: Record<string, string>;
};

export type MerklePath = { sibling: string; side: "L" | "R" };

const LOG: CoreEvent[] = [];
const ALLOWED = new Set<CoreEventType>([
  "system.ping",
  "session.mark",
  "session.close",
  "decision.record",
  "artifact.record",
  "note.append",
  "memory.set",
  "memory.delete",
]);

function hex(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function bytes(hexStr: string) {
  const out = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sha256(data: Uint8Array) {
  return hex(await crypto.subtle.digest("SHA-256", data as unknown as BufferSource));
}

async function hmacSha256(message: string) {
  const key = await crypto.subtle.importKey("raw", CORE_SECRET, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return hex(sig);
}

function macEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sorted(o[k])]));
  }
  return v;
}

/** Python json.dumps(..., sort_keys=True, separators=(",", ":"), allow_nan=False) */
export function canonicalJson(obj: Record<string, unknown>) {
  return JSON.stringify(sorted(obj));
}

function envelopeBody(e: Omit<CoreEvent, "signature" | "hash"> | CoreEvent) {
  return {
    actor: e.actor,
    event_id: e.event_id,
    event_type: e.event_type,
    payload: e.payload,
    prev_hash: e.prev_hash,
    timestamp: e.timestamp,
  };
}

function extraKeys(payload: Record<string, unknown>, allowed: string[]) {
  return Object.keys(payload).filter((k) => !allowed.includes(k));
}

function isName(v: unknown, max: number) {
  return typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= max && !v.includes("/");
}

function validatePayload(type: CoreEventType, payload: Record<string, unknown>) {
  if (!ALLOWED.has(type)) throw new Error(`unsupported event_type: ${type}`);
  switch (type) {
    case "system.ping": {
      if (typeof payload.ok !== "boolean" || extraKeys(payload, ["ok", "detail"]).length) {
        throw new Error("system.ping requires 'ok' and only allows optional 'detail'");
      }
      if (payload.detail != null && (typeof payload.detail !== "string" || payload.detail.length > 500)) {
        throw new Error("detail must be a string up to 500 characters");
      }
      return;
    }
    case "session.mark": {
      const label = payload.label;
      if (typeof label !== "string" || !label.trim() || label.length > 80) throw new Error("invalid label");
      if (payload.ns != null && (typeof payload.ns !== "string" || !payload.ns.trim() || payload.ns.length > 80)) {
        throw new Error("invalid ns");
      }
      if (extraKeys(payload, ["label", "ns"]).length) throw new Error("unexpected session.mark keys");
      return;
    }
    case "session.close": {
      if (typeof payload.summary !== "string" || payload.summary.length > 500) throw new Error("invalid summary");
      if (typeof payload.project !== "string" || !payload.project.trim()) throw new Error("invalid project");
      if (!Array.isArray(payload.open_threads) || payload.open_threads.length > 10) throw new Error("invalid open_threads");
      if (extraKeys(payload, ["summary", "project", "open_threads"]).length) throw new Error("unexpected session.close keys");
      return;
    }
    case "decision.record": {
      if (Object.keys(payload).sort().join() !== "choice,context,title") {
        throw new Error("decision.record requires exactly: title, choice, context");
      }
      if (typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 200) throw new Error("invalid title");
      if (typeof payload.choice !== "string" || !payload.choice.trim() || payload.choice.length > 500) throw new Error("invalid choice");
      if (typeof payload.context !== "string" || payload.context.length > 2000) throw new Error("invalid context");
      return;
    }
    case "artifact.record": {
      if (typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 200) throw new Error("invalid title");
      if (typeof payload.location !== "string" || !payload.location.trim() || payload.location.length > 500) throw new Error("invalid location");
      if (typeof payload.kind !== "string" || !payload.kind.trim() || payload.kind.length > 40) throw new Error("invalid kind");
      if (payload.notes != null && (typeof payload.notes !== "string" || payload.notes.length > 500)) throw new Error("invalid notes");
      if (extraKeys(payload, ["title", "location", "kind", "notes"]).length) throw new Error("unexpected artifact keys");
      return;
    }
    case "note.append": {
      if (typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 2000) throw new Error("invalid text");
      const tags = payload.tags ?? [];
      if (!Array.isArray(tags) || tags.length > 10) throw new Error("invalid tags");
      if (extraKeys(payload, ["text", "tags"]).length) throw new Error("unexpected note keys");
      return;
    }
    case "memory.set": {
      if (Object.keys(payload).sort().join() !== "key,ns,value") throw new Error("memory.set requires exactly: ns, key, value");
      if (!isName(payload.ns, 120) || !isName(payload.key, 120)) throw new Error("invalid ns/key");
      JSON.stringify(payload.value);
      return;
    }
    case "memory.delete": {
      if (Object.keys(payload).sort().join() !== "key,ns") throw new Error("memory.delete requires exactly: ns, key");
      if (!isName(payload.ns, 120) || !isName(payload.key, 120)) throw new Error("invalid ns/key");
    }
  }
}

/** merkle.py leaf_hash: H(0x00 || event_hash_bytes) */
export async function leafHash(eventHash: string) {
  const tagged = new Uint8Array(1 + 32);
  tagged[0] = 0x00;
  tagged.set(bytes(eventHash), 1);
  return sha256(tagged);
}

/** merkle.py hash_pair: H(0x01 || left || right) */
export async function hashPair(left: string, right: string) {
  const tagged = new Uint8Array(1 + 32 + 32);
  tagged[0] = 0x01;
  tagged.set(bytes(left), 1);
  tagged.set(bytes(right), 33);
  return sha256(tagged);
}

export async function buildLevels(eventHashes: string[]) {
  if (!eventHashes.length) return [] as string[][];
  let level = await Promise.all(eventHashes.map(leafHash));
  const levels = [level];
  while (level.length > 1) {
    const nxt: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const L = level[i];
      const R = level[i + 1] ?? L;
      nxt.push(await hashPair(L, R));
    }
    level = nxt;
    levels.push(level);
  }
  return levels;
}

export async function merkleRootOf(eventHashes: string[]) {
  if (!eventHashes.length) return "0".repeat(64);
  const levels = await buildLevels(eventHashes);
  return levels[levels.length - 1][0];
}

export async function inclusionProof(eventHashes: string[], index: number) {
  if (index < 0 || index >= eventHashes.length) throw new Error("leaf index out of range");
  const levels = await buildLevels(eventHashes);
  const path: MerklePath[] = [];
  let idx = index;
  for (const level of levels.slice(0, -1)) {
    const even = idx % 2 === 0;
    const sibIdx = even ? (idx + 1 < level.length ? idx + 1 : idx) : idx - 1;
    path.push({ sibling: level[sibIdx], side: even ? "R" : "L" });
    idx = Math.floor(idx / 2);
  }
  return { root: levels[levels.length - 1][0], path };
}

export async function verifyInclusion(eventHash: string, index: number, path: MerklePath[], root: string) {
  if (index < 0) return false;
  let running = await leafHash(eventHash);
  let idx = index;
  for (const step of path) {
    const expected = idx % 2 === 0 ? "R" : "L";
    if (step.side !== expected) return false;
    running = step.side === "L" ? await hashPair(step.sibling, running) : await hashPair(running, step.sibling);
    idx = Math.floor(idx / 2);
  }
  return idx === 0 && macEqual(running, root);
}

async function signAndHash(draft: Omit<CoreEvent, "signature" | "hash">) {
  const body = canonicalJson(envelopeBody(draft));
  const signature = await hmacSha256(body);
  const joined = new TextEncoder().encode(body + signature);
  const hash = await sha256(joined);
  return { signature, hash };
}

export async function appendCoreEvent(
  type: CoreEventType,
  payload: Record<string, unknown>,
  actor = "elena.hartmann",
) {
  validatePayload(type, payload);
  if (LOG.length) {
    const last = LOG[LOG.length - 1];
    const expect = await signAndHash({
      event_id: last.event_id,
      event_type: last.event_type,
      payload: last.payload,
      actor: last.actor,
      timestamp: last.timestamp,
      prev_hash: last.prev_hash,
    });
    if (expect.hash !== last.hash || expect.signature !== last.signature) {
      throw new Error("append refused: damaged existing chain");
    }
  }
  const prev_hash = LOG.length ? LOG[LOG.length - 1].hash : "0".repeat(64);
  const draft: Omit<CoreEvent, "signature" | "hash"> = {
    event_id: crypto.randomUUID(),
    event_type: type,
    payload,
    actor,
    timestamp: Date.now() / 1000,
    prev_hash,
  };
  const { signature, hash } = await signAndHash(draft);
  const event: CoreEvent = { ...draft, signature, hash };
  LOG.push(event);
  return event;
}

export async function verifyChain() {
  const errors: string[] = [];
  let prev = "0".repeat(64);
  for (let i = 0; i < LOG.length; i++) {
    const e = LOG[i];
    if (e.prev_hash !== prev) errors.push(`link ${i}: prev_hash mismatch`);
    try {
      validatePayload(e.event_type, e.payload);
    } catch (err) {
      errors.push(`link ${i}: ${(err as Error).message}`);
    }
    const { signature, hash } = await signAndHash({
      event_id: e.event_id,
      event_type: e.event_type,
      payload: e.payload,
      actor: e.actor,
      timestamp: e.timestamp,
      prev_hash: e.prev_hash,
    });
    if (!macEqual(signature, e.signature)) errors.push(`link ${i}: hmac mismatch`);
    if (!macEqual(hash, e.hash)) errors.push(`link ${i}: hash mismatch`);
    prev = e.hash;
  }
  return { ok: errors.length === 0, bad: errors.length, errors, depth: LOG.length };
}

export function eventHashes() {
  return LOG.map((e) => e.hash);
}

export function asView(e: CoreEvent): CoreEventView {
  const payload: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.payload)) {
    payload[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return {
    id: e.event_id,
    type: e.event_type,
    hash: e.hash,
    mac: e.signature,
    ts: new Date(e.timestamp * 1000).toISOString(),
    actor: e.actor,
    payload,
  };
}

export function listEvents() {
  return LOG.map(asView);
}

export async function merkleSnapshot() {
  const hashes = eventHashes();
  const root = await merkleRootOf(hashes);
  return {
    version: CORE_VERSION,
    merkle_root: root,
    leaf_count: hashes.length,
    first_event_id: LOG[0]?.event_id || null,
    last_event_id: LOG[LOG.length - 1]?.event_id || null,
    generated_at: new Date().toISOString(),
    mesh_peer: false,
    writable: false,
    algorithm: "HMAC-SHA256 + Merkle SHA256 domain-separated (0x00 leaf / 0x01 pair)",
    sha: CORE_SHA,
    repo: CORE_REPO,
  };
}

export async function merkleProofAt(index: number) {
  const hashes = eventHashes();
  const { root, path } = await inclusionProof(hashes, index);
  const valid = await verifyInclusion(hashes[index], index, path, root);
  return { index, root, path, valid, leaf: hashes[index] };
}

export async function doctor() {
  const chain = await verifyChain();
  const snap = await merkleSnapshot();
  const secretOk = CORE_SECRET.byteLength >= 32;
  const overall = chain.ok && secretOk ? "ok" : "fail";
  return {
    overall,
    version: CORE_VERSION,
    sha: CORE_SHA,
    repo: CORE_REPO,
    mesh_peer: false,
    checks: {
      secret: { status: secretOk ? "ok" : "fail", bytes: CORE_SECRET.byteLength },
      chain: { status: chain.ok ? "ok" : "fail", depth: chain.depth, bad: chain.bad, errors: chain.errors },
      merkle: { status: snap.leaf_count >= 0 ? "ok" : "fail", root: snap.merkle_root, leaves: snap.leaf_count },
      mesh: { status: "ok" as const, peer: false, note: "local-only continuity plane" },
    },
  };
}

let seeded = false;
export async function ensureGenesis() {
  if (seeded || LOG.length) return;
  seeded = true;
  await appendCoreEvent("system.ping", { ok: true, detail: "local-core genesis" }, "local-core");
  await appendCoreEvent("session.mark", { label: "desk-open", ns: "siemens-gamesa" }, "elena.hartmann");
  await appendCoreEvent("memory.set", { ns: "siemens-gamesa", key: "desk", value: "magnetics" }, "mattboyer725");
  await appendCoreEvent(
    "artifact.record",
    {
      title: "verityx-local-core v1.6.0",
      location: "https://github.com/mattboyer725-dev/verityx-local-core",
      kind: "repo",
    },
    "mattboyer725",
  );
}

export function __resetForTests() {
  LOG.length = 0;
  seeded = false;
}

export const LOCAL_CORE = {
  version: CORE_VERSION,
  repo: CORE_REPO,
  sha: CORE_SHA,
};
