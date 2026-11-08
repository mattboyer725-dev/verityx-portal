/**
 * Faithful port of mattboyer725-dev/verityx-local-core v1.7.0
 * SHA 0188c849fc4482a5a15cf2a9e624b3a8550978d6
 *
 * Crypto matches event_store.py + merkle.py byte for byte (cross-verified
 * against the Python EventStore):
 *   canonical = json.dumps(body without signature/hash, sort_keys=True,
 *               separators=(",", ":"), allow_nan=False)   # ensure_ascii=True
 *   signature = HMAC-SHA256(secret, canonical)
 *   hash      = SHA256(canonical || signature)
 *   leaf      = SHA256(0x00 || hash_bytes)
 *   pair      = SHA256(0x01 || left || right)
 *
 * Key: LOCAL_CORE_SECRET from the server environment only (config.py policy).
 * In-memory (Vercel has no durable local FS). Not a mesh peer.
 */

import { CORE_REPO, CORE_SHA, CORE_VERSION, LOCAL_CORE } from "./core-meta.ts";
import { canonicalJson, pyJson } from "./canonical.ts";
import { buildLevels, hashPair, hex, inclusionProof, leafHash, macEqual, merkleRootOf, sha256, verifyInclusion, type MerklePath } from "./merkle.ts";

export { CORE_REPO, CORE_SHA, CORE_VERSION, LOCAL_CORE };
export { canonicalJson };
export { buildLevels, hashPair, inclusionProof, leafHash, merkleRootOf, verifyInclusion, type MerklePath };

/* ------------------------------------------------------------------------- *
 * Secret policy — mirrors local-core v1.7.0 config.py.
 *
 * LOCAL_CORE_SECRET signs. LOCAL_CORE_SECRET_PREVIOUS verifies only (rotation)
 * and may be a public key so a log signed with one can be rotated away from;
 * it never signs. Known public values never sign. A missing secret falls back
 * to the public dev key only outside production, or with an explicit
 * LOCAL_CORE_ALLOW_DEV_SECRET=1 — and doctor reports that key as not
 * authentic either way.
 * ------------------------------------------------------------------------- */
export const MIN_SECRET_BYTES = 32;
const DEV_FALLBACK_SECRET = "verityx-local-core-dev-secret-change-me";
/** Signed every portal event through v1.0; committed to a public repo and shipped in a client chunk. */
const LEGACY_PORTAL_SECRET = "verityx-desk-local-core-hmac-v1.6.0-siemens-gamesa-magnetics";
export const KNOWN_PUBLIC_SECRETS: ReadonlySet<string> = new Set([
  DEV_FALLBACK_SECRET,
  "replace-with-a-real-random-secret-do-not-use-this-value",
  LEGACY_PORTAL_SECRET,
]);

type KeySource = "env" | "dev" | "none";
type KeyState = {
  signing: Uint8Array | null;
  source: KeySource;
  error: string | null;
  previous: Uint8Array | null;
  previousPublic: boolean;
};

function env(name: string) {
  return typeof process !== "undefined" ? (process.env?.[name] ?? "") : "";
}

const enc = new TextEncoder();

export function loadKeys(): KeyState {
  if (typeof window !== "undefined") {
    // A browser cannot hold a server key; anything it "signed" would be a public-key imitation.
    return { signing: null, source: "none", error: "signing is server-only", previous: null, previousPublic: false };
  }
  const raw = env("LOCAL_CORE_SECRET");
  const prevRaw = env("LOCAL_CORE_SECRET_PREVIOUS");
  const previous = prevRaw ? enc.encode(prevRaw) : null;
  const previousPublic = Boolean(prevRaw && KNOWN_PUBLIC_SECRETS.has(prevRaw));
  const base = { previous, previousPublic };
  if (!raw) {
    const allowDev = env("LOCAL_CORE_ALLOW_DEV_SECRET") === "1" || env("NODE_ENV") !== "production";
    if (allowDev) return { ...base, signing: enc.encode(DEV_FALLBACK_SECRET), source: "dev", error: null };
    return {
      ...base,
      signing: null,
      source: "none",
      error: "LOCAL_CORE_SECRET is required in production. Generate one: openssl rand -hex 32",
    };
  }
  if (KNOWN_PUBLIC_SECRETS.has(raw)) {
    return {
      ...base,
      signing: null,
      source: "none",
      error: "LOCAL_CORE_SECRET is a publicly known value. Generate a real one: openssl rand -hex 32",
    };
  }
  const signing = enc.encode(raw);
  if (signing.byteLength < MIN_SECRET_BYTES) {
    return { ...base, signing: null, source: "none", error: `LOCAL_CORE_SECRET must be at least ${MIN_SECRET_BYTES} bytes.` };
  }
  return { ...base, signing, source: "env", error: null };
}

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

async function hmacSha256(secret: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hex(sig);
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
      // v1.7.0: reject values that cannot be canonically signed before anything is appended.
      pyJson(payload.value);
      return;
    }
    case "memory.delete": {
      if (Object.keys(payload).sort().join() !== "key,ns") throw new Error("memory.delete requires exactly: ns, key");
      if (!isName(payload.ns, 120) || !isName(payload.key, 120)) throw new Error("invalid ns/key");
    }
  }
}

/**
 * The portal's v1.0 serializer: JSON.stringify over sorted keys. It did not
 * escape non-ASCII the way Python does, so any event with "·", "—", "€" …
 * failed local-core verification. Kept for verification of pre-rotation
 * history under LOCAL_CORE_SECRET_PREVIOUS only; it never signs.
 */
function legacyCanonical(obj: Record<string, unknown>) {
  const sortDeep = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sortDeep)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sortDeep(obj));
}

type SignedBy = { by: "current" | "previous"; body: string } | null;

/** Which configured key produced this event's signature (event_store.verify_event with previous_secret). */
async function signedBy(e: CoreEvent, keys: KeyState): Promise<SignedBy> {
  const body = canonicalJson(envelopeBody(e));
  if (keys.signing && macEqual(await hmacSha256(keys.signing, body), e.signature)) return { by: "current", body };
  if (keys.previous) {
    if (macEqual(await hmacSha256(keys.previous, body), e.signature)) return { by: "previous", body };
    const legacy = legacyCanonical(envelopeBody(e));
    if (legacy !== body && macEqual(await hmacSha256(keys.previous, legacy), e.signature)) {
      return { by: "previous", body: legacy };
    }
  }
  return null;
}

/**
 * Content-verified tip cache (v1.7.0 append() tip cache). The tip is trusted
 * only while the stored event still hashes to the value it was verified at;
 * any edit to it — same length or not — forces a full re-verification.
 */
let verifiedTip: { index: number; hash: string; digest: string } | null = null;

async function tipDigest(e: CoreEvent) {
  return sha256(enc.encode(canonicalJson(envelopeBody(e)) + "|" + e.signature + "|" + e.hash));
}

async function assertTipIntact() {
  if (!LOG.length) return;
  const i = LOG.length - 1;
  const last = LOG[i];
  if (verifiedTip && verifiedTip.index === i && verifiedTip.hash === last.hash && verifiedTip.digest === (await tipDigest(last))) {
    return;
  }
  const chain = await verifyChain();
  if (!chain.ok) throw new Error("append refused: damaged existing chain");
  verifiedTip = { index: i, hash: last.hash, digest: await tipDigest(last) };
}

async function signDraft(draft: Omit<CoreEvent, "signature" | "hash">, signing: Uint8Array): Promise<CoreEvent> {
  const body = canonicalJson(envelopeBody(draft));
  const signature = await hmacSha256(signing, body);
  const hash = await sha256(enc.encode(body + signature));
  return { ...draft, signature, hash };
}

export type CoreDraft = { type: CoreEventType; payload: Record<string, unknown>; actor?: string };

let writer: Promise<unknown> = Promise.resolve();

/**
 * Append several events as one unit (v1.7.0 ritual.py fix): every payload is
 * validated and canonicalised before the first append, so a bad second event
 * can never leave a half-written pair in an append-only log. Appends are
 * serialised so concurrent requests cannot fork the chain.
 */
export function appendCoreEvents(drafts: CoreDraft[]): Promise<CoreEvent[]> {
  const run = async () => {
    if (!drafts.length) return [];
    for (const d of drafts) {
      validatePayload(d.type, d.payload);
      canonicalJson({ payload: d.payload, actor: d.actor ?? "elena.hartmann" });
    }
    const keys = loadKeys();
    if (!keys.signing) throw new Error(`signing refused: ${keys.error}`);
    await assertTipIntact();
    const out: CoreEvent[] = [];
    for (const d of drafts) {
      const prev_hash = LOG.length ? LOG[LOG.length - 1].hash : "0".repeat(64);
      const event = await signDraft(
        {
          event_id: crypto.randomUUID(),
          event_type: d.type,
          payload: d.payload,
          actor: d.actor ?? "elena.hartmann",
          timestamp: Date.now() / 1000,
          prev_hash,
        },
        keys.signing,
      );
      LOG.push(event);
      out.push(event);
    }
    const last = LOG[LOG.length - 1];
    verifiedTip = { index: LOG.length - 1, hash: last.hash, digest: await tipDigest(last) };
    return out;
  };
  const next = writer.then(run, run);
  writer = next.catch(() => undefined);
  return next;
}

export async function appendCoreEvent(
  type: CoreEventType,
  payload: Record<string, unknown>,
  actor = "elena.hartmann",
) {
  const [event] = await appendCoreEvents([{ type, payload, actor }]);
  return event;
}

export async function verifyChain() {
  const keys = loadKeys();
  const errors: string[] = [];
  let previousSigned = 0;
  let prev = "0".repeat(64);
  for (let i = 0; i < LOG.length; i++) {
    const e = LOG[i];
    if (e.prev_hash !== prev) errors.push(`link ${i}: prev_hash mismatch`);
    try {
      validatePayload(e.event_type, e.payload);
      const signed = await signedBy(e, keys);
      // event_store._event_hash: sha256(canonical || signature), over the bytes that were signed.
      const body = signed?.body ?? canonicalJson(envelopeBody(e));
      if (!signed) errors.push(`link ${i}: hmac mismatch`);
      else if (signed.by === "previous") previousSigned++;
      if (!macEqual(await sha256(enc.encode(body + e.signature)), e.hash)) errors.push(`link ${i}: hash mismatch`);
    } catch (err) {
      errors.push(`link ${i}: ${(err as Error).message}`);
    }
    prev = e.hash;
  }
  return {
    ok: errors.length === 0,
    bad: errors.length,
    errors,
    depth: LOG.length,
    previous_signed: previousSigned,
    previous_public: keys.previousPublic,
  };
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
  const keys = loadKeys();
  const chain = await verifyChain();
  const snap = await merkleSnapshot();
  // fail: nothing authentic can be signed. warn: signing works but some or all
  // of the chain rests on a key that is public (dev fallback, or a public
  // previous key still carrying pre-rotation history).
  const secret =
    keys.source === "env"
      ? chain.previous_signed && chain.previous_public
        ? { status: "warn" as const, bytes: keys.signing!.byteLength, note: `${chain.previous_signed} pre-rotation event(s) verify only under a public key` }
        : { status: "ok" as const, bytes: keys.signing!.byteLength, note: chain.previous_signed ? `${chain.previous_signed} event(s) verified by LOCAL_CORE_SECRET_PREVIOUS` : "server-only key" }
      : keys.source === "dev"
        ? { status: "warn" as const, bytes: keys.signing!.byteLength, note: "public dev key — signatures are not authentic" }
        : { status: "fail" as const, bytes: 0, note: keys.error ?? "no signing key" };
  const statuses = [secret.status, chain.ok ? "ok" : "fail"];
  const overall = statuses.includes("fail") ? "fail" : statuses.includes("warn") ? "warn" : "ok";
  return {
    overall,
    version: CORE_VERSION,
    sha: CORE_SHA,
    repo: CORE_REPO,
    mesh_peer: false,
    checks: {
      secret,
      chain: {
        status: chain.ok ? "ok" : "fail",
        depth: chain.depth,
        bad: chain.bad,
        errors: chain.errors,
        previous_signed: chain.previous_signed,
      },
      merkle: { status: snap.leaf_count >= 0 ? "ok" : "fail", root: snap.merkle_root, leaves: snap.leaf_count },
      mesh: { status: "ok" as const, peer: false, note: "local-only continuity plane" },
    },
  };
}

let seeded = false;
export async function ensureGenesis() {
  if (seeded || LOG.length) return;
  if (!loadKeys().signing) return; // fail closed: doctor reports why; reads stay up
  seeded = true;
  await appendCoreEvents([
    { type: "system.ping", payload: { ok: true, detail: "local-core genesis" }, actor: "local-core" },
    { type: "session.mark", payload: { label: "desk-open", ns: "siemens-gamesa" }, actor: "elena.hartmann" },
    { type: "memory.set", payload: { ns: "siemens-gamesa", key: "desk", value: "magnetics" }, actor: "mattboyer725" },
    {
      type: "artifact.record",
      payload: {
        title: `verityx-local-core v${CORE_VERSION}`,
        location: `https://github.com/${CORE_REPO}`,
        kind: "repo",
      },
      actor: "mattboyer725",
    },
  ]);
}

export function dumpLog(): CoreEvent[] {
  return LOG.slice();
}

export function loadLog(events: CoreEvent[]) {
  if (LOG.length || !events.length) return;
  LOG.push(...events);
  verifiedTip = null; // loaded history is re-verified before the next append
  seeded = true;
}

export function __resetForTests() {
  LOG.length = 0;
  seeded = false;
  verifiedTip = null;
}
