/**
 * Issue seal receipts with VerityX's Ed25519 seal key. Server-only.
 *
 * VERITYX_SEAL_KEY = 64 hex characters (the 32-byte Ed25519 seed). Same
 * policy as the ledger secret: required in production; outside production a
 * per-process ephemeral key is used and marked as such, so a dev receipt can
 * never pass as a production one.
 *
 * FAIL CLOSED: in production the server signs only when its key is the one
 * marked active in the committed keyring (src/data/seal-keyring.json). A key
 * set in the environment but not published in the keyring — by mistake or by
 * someone with access to the hosting settings — cannot issue receipts.
 * Rotate with scripts/rotate-seal-key.mjs, which updates both together.
 */
import { createPrivateKey, createPublicKey, randomBytes, sign, type KeyObject } from "node:crypto";
import { b64url, fromB64url, keyId, receiptSigningBytes, type ReceiptEntry, type SealReceipt } from "./receipt.ts";
import type { MerklePath } from "./merkle.ts";
import { activeKey, KEYRING, KEYRING_HISTORY_URL, KEYRING_URL } from "./seal-keyring.ts";

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
export const SEAL_ISSUER = "https://verityx-portal.vercel.app";

type SealKey = { priv: KeyObject; publicKey: string; kid: string; ephemeral: boolean };

const inKeyringAsActive = (k: { kid: string; publicKey: string }) => {
  const a = activeKey(KEYRING);
  return !!a && a.kid === k.kid && a.publicKey === k.publicKey;
};

/**
 * Why the configured key may not sign, or null when it may. Production only:
 * elsewhere an unpublished key may sign for testing, and its receipts say so
 * in the issuer and fail the keyring check.
 */
export function keyringRefusal(k: { kid: string; publicKey: string; ephemeral: boolean }): string | null {
  if (k.ephemeral || process.env.NODE_ENV !== "production") return null;
  const a = activeKey(KEYRING);
  if (!a) return "The published keyring has no active key.";
  if (a.kid !== k.kid || a.publicKey !== k.publicKey) {
    const listed = KEYRING.keys.find((x) => x.kid === k.kid);
    return listed
      ? `The configured seal key ${k.kid} is ${listed.status} in the published keyring; only ${a.kid} may sign.`
      : `The configured seal key ${k.kid} is not in the published keyring; only ${a.kid} may sign.`;
  }
  return null;
}
let cached: { seed: string; key: SealKey } | null = null;
const g = globalThis as { __vxEphemeralSeal__?: string };

async function fromSeed(seedHex: string, ephemeral: boolean): Promise<SealKey> {
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seedHex, "hex")]), format: "der", type: "pkcs8" });
  const jwk = createPublicKey(priv).export({ format: "jwk" }) as { x: string };
  return { priv, publicKey: jwk.x, kid: await keyId(jwk.x), ephemeral };
}

export async function loadSealKey(): Promise<SealKey | null> {
  const raw = (process.env.VERITYX_SEAL_KEY ?? "").trim().toLowerCase();
  let seed: string;
  let ephemeral = false;
  if (/^[0-9a-f]{64}$/.test(raw)) seed = raw;
  else if (raw) return null; // malformed: refuse rather than guess
  else if (process.env.NODE_ENV !== "production") {
    g.__vxEphemeralSeal__ ??= randomBytes(32).toString("hex");
    seed = g.__vxEphemeralSeal__;
    ephemeral = true;
  } else return null;
  if (cached?.seed === seed) return cached.key;
  const key = await fromSeed(seed, ephemeral);
  cached = { seed, key };
  return key;
}

export async function publishedSealKey() {
  const keyring = { ...KEYRING, source: KEYRING_URL, history: KEYRING_HISTORY_URL };
  const k = await loadSealKey();
  if (!k) return { available: false as const, reason: "No seal key is configured on this server.", keyring };
  const refusal = keyringRefusal(k);
  if (refusal) return { available: false as const, reason: refusal, keyring };
  return { available: true as const, alg: "Ed25519" as const, kid: k.kid, publicKey: k.publicKey, ephemeral: k.ephemeral, issuer: SEAL_ISSUER, keyring };
}

export async function issueReceipt(
  entry: ReceiptEntry,
  merkle: { root: string; index: number; leafCount: number; path: MerklePath[] },
): Promise<SealReceipt | null> {
  const k = await loadSealKey();
  if (!k || keyringRefusal(k)) return null;
  const body: Omit<SealReceipt, "signature"> = {
    v: 1,
    type: "verityx.seal-receipt",
    issuer: k.ephemeral
      ? `${SEAL_ISSUER} (ephemeral dev key)`
      : inKeyringAsActive(k)
        ? SEAL_ISSUER
        : `${SEAL_ISSUER} (unpublished dev key)`,
    alg: "Ed25519",
    kid: k.kid,
    publicKey: k.publicKey,
    issuedAt: new Date().toISOString(),
    entry: {
      event_id: entry.event_id,
      event_type: entry.event_type,
      payload: entry.payload,
      actor: entry.actor,
      timestamp: entry.timestamp,
      prev_hash: entry.prev_hash,
      signature: entry.signature,
      hash: entry.hash,
    },
    merkle,
  };
  const sig = sign(null, Buffer.from(receiptSigningBytes(body)), k.priv);
  return { ...body, signature: b64url(new Uint8Array(sig)) };
}

/** For tests: the raw public key bytes. */
export function publicKeyBytes(publicKey: string) {
  return fromB64url(publicKey);
}
