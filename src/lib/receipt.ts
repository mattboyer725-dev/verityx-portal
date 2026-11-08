/**
 * SEAL RECEIPT — proof anyone can check, without trusting VerityX.
 *
 * A receipt carries one ledger entry, its Merkle inclusion proof and an
 * Ed25519 signature by VerityX's published seal key. Three independent
 * checks, all runnable in a browser with WebCrypto:
 *
 *   1. CONTENT  — SHA-256(canonical entry ‖ HMAC) equals the entry's hash, so
 *                 the payload shown is exactly what was sealed.
 *   2. LEDGER   — the hash is a leaf of the Merkle root at the stated index.
 *   3. SIGNATURE — VerityX's Ed25519 key signed this receipt, root included;
 *                 compared against the key published at /api/seal-key.
 *
 * The HMAC on the entry itself needs the server's secret and is not
 * re-checked here; the public signature is what a third party relies on.
 * Pure: no secrets, no Node APIs.
 */
import { canonicalJson } from "./canonical.ts";
import { sha256, verifyInclusion, type MerklePath } from "./merkle.ts";

export type ReceiptEntry = {
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor: string;
  timestamp: number;
  prev_hash: string;
  signature: string;
  hash: string;
};

export type SealReceipt = {
  v: 1;
  type: "verityx.seal-receipt";
  issuer: string;
  alg: "Ed25519";
  kid: string;
  publicKey: string;
  issuedAt: string;
  entry: ReceiptEntry;
  merkle: { root: string; index: number; leafCount: number; path: MerklePath[] };
  signature: string;
};

export type CheckResult = { ok: boolean; detail: string };
export type ReceiptVerdict = {
  valid: boolean;
  content: CheckResult;
  ledger: CheckResult;
  signature: CheckResult;
  key: CheckResult;
};

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The exact bytes the seal key signs: the receipt minus its signature, canonical. */
export function receiptSigningBytes(r: Omit<SealReceipt, "signature"> | SealReceipt): Uint8Array {
  const { signature: _omit, ...body } = r as SealReceipt;
  void _omit;
  return enc.encode(canonicalJson(body as unknown as Record<string, unknown>));
}

export async function keyId(publicKeyB64url: string): Promise<string> {
  return (await sha256(fromB64url(publicKeyB64url))).slice(0, 16);
}

function isHex64(v: unknown) {
  return typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
}

/** Pull a receipt out of whatever was dropped in: a receipt, or an exported packet that carries one. */
export function findReceipt(json: unknown): SealReceipt | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): SealReceipt | null => {
    if (!v || typeof v !== "object" || depth > 6 || seen.has(v)) return null;
    seen.add(v);
    const o = v as Record<string, unknown>;
    if (o.type === "verityx.seal-receipt") return o as unknown as SealReceipt;
    for (const k of Object.keys(o)) {
      const hit = walk(o[k], depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(json, 0);
}

export async function verifyReceipt(r: SealReceipt, publishedKey?: string | null): Promise<ReceiptVerdict> {
  const fail = (detail: string): CheckResult => ({ ok: false, detail });
  const shapeOk =
    r &&
    r.v === 1 &&
    r.type === "verityx.seal-receipt" &&
    r.alg === "Ed25519" &&
    r.entry &&
    isHex64(r.entry.hash) &&
    isHex64(r.entry.signature) &&
    isHex64(r.entry.prev_hash) &&
    r.merkle &&
    isHex64(r.merkle.root) &&
    Number.isInteger(r.merkle.index) &&
    Array.isArray(r.merkle.path) &&
    typeof r.signature === "string" &&
    typeof r.publicKey === "string";
  if (!shapeOk) {
    const bad = fail("This is not a complete VerityX seal receipt.");
    return { valid: false, content: bad, ledger: bad, signature: bad, key: bad };
  }

  // 1. CONTENT
  let content: CheckResult;
  try {
    const e = r.entry;
    const body = canonicalJson({
      actor: e.actor,
      event_id: e.event_id,
      event_type: e.event_type,
      payload: e.payload,
      prev_hash: e.prev_hash,
      timestamp: e.timestamp,
    });
    const h = await sha256(enc.encode(body + e.signature));
    content =
      h === e.hash
        ? { ok: true, detail: "The entry’s contents produce exactly its recorded fingerprint." }
        : fail("The entry’s contents do not match its fingerprint — something in it was changed.");
  } catch {
    content = fail("The entry could not be read in canonical form.");
  }

  // 2. LEDGER
  let ledger: CheckResult;
  try {
    const inc = await verifyInclusion(r.entry.hash, r.merkle.index, r.merkle.path, r.merkle.root);
    ledger = inc
      ? { ok: true, detail: `The fingerprint is leaf ${r.merkle.index + 1} of ${r.merkle.leafCount} under the stated ledger root.` }
      : fail("The Merkle proof does not lead from this entry to the stated ledger root.");
  } catch {
    ledger = fail("The Merkle proof is malformed.");
  }

  // 3. SIGNATURE
  let signature: CheckResult;
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error("no webcrypto");
    const key = await subtle.importKey("raw", fromB64url(r.publicKey) as unknown as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    const ok = await subtle.verify(
      { name: "Ed25519" },
      key,
      fromB64url(r.signature) as unknown as BufferSource,
      receiptSigningBytes(r) as unknown as BufferSource,
    );
    signature = ok
      ? { ok: true, detail: "The receipt — entry, root and time — carries a valid Ed25519 signature." }
      : fail("The signature does not match: the receipt was altered or not signed by this key.");
  } catch {
    signature = fail("This browser cannot check Ed25519 signatures. Use a current Chrome, Edge, Safari or Firefox.");
  }

  // KEY — is it VerityX's published key?
  let key: CheckResult;
  if (!publishedKey) key = fail("The published VerityX key could not be fetched, so the signer was not compared.");
  else if (publishedKey === r.publicKey) key = { ok: true, detail: `Signed by VerityX’s published seal key ${r.kid}.` };
  else key = fail("Signed by a key that is not VerityX’s published seal key.");

  return { valid: content.ok && ledger.ok && signature.ok && key.ok, content, ledger, signature, key };
}
