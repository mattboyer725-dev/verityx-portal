import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, createHash } from "node:crypto";
import { afterEach, test } from "node:test";
import { activeKey, checkReceiptKey, KEYRING, validateKeyring, validateTransition, type Keyring, type KeyringKey } from "./seal-keyring.ts";
import { issueReceipt, keyringRefusal, loadSealKey, publishedSealKey } from "./receipt.server.ts";

const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
function keyFromSeed(seedHex: string) {
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(seedHex, "hex")]), format: "der", type: "pkcs8" });
  const x = (createPublicKey(priv).export({ format: "jwk" }) as { x: string }).x;
  const kid = createHash("sha256").update(Buffer.from(x, "base64url")).digest("hex").slice(0, 16);
  return { x, kid };
}
const A = keyFromSeed("11".repeat(32));
const B = keyFromSeed("22".repeat(32));
const T0 = "2026-01-01T00:00:00Z";
const T1 = "2026-06-01T00:00:00Z";
const k = (o: Partial<KeyringKey> & { kid: string; publicKey: string }): KeyringKey => ({ alg: "Ed25519", status: "active", activatedAt: T0, ...o });
const ring = (keys: KeyringKey[]): Keyring => ({ issuer: "x", policy: "p", keys });

const saved = { k: process.env.VERITYX_SEAL_KEY, n: process.env.NODE_ENV };
afterEach(() => {
  process.env.VERITYX_SEAL_KEY = saved.k ?? "";
  if (saved.n === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved.n;
});

test("the committed keyring is valid: one active Ed25519 key whose kid matches its public key", async () => {
  assert.deepEqual(await validateKeyring(KEYRING), []);
  assert.ok(activeKey());
});

test("keyring structure rules", async () => {
  assert.deepEqual(await validateKeyring(ring([k({ kid: A.kid, publicKey: A.x })])), []);
  assert.match((await validateKeyring(ring([k({ kid: "0000000000000000", publicKey: A.x })]))).join(), /kid does not match/);
  assert.match((await validateKeyring(ring([k({ kid: A.kid, publicKey: A.x }), k({ kid: B.kid, publicKey: B.x })]))).join(), /exactly one key/);
  assert.match((await validateKeyring(ring([k({ kid: A.kid, publicKey: A.x, status: "retired" })]))).join(), /needs retiredAt/);
});

test("rotation is append-only and monotonic", () => {
  const before = ring([k({ kid: A.kid, publicKey: A.x })]);
  const rotated = ring([k({ kid: A.kid, publicKey: A.x, status: "retired", retiredAt: T1 }), k({ kid: B.kid, publicKey: B.x, activatedAt: T1 })]);
  assert.deepEqual(validateTransition(before, rotated), []);
  assert.match(validateTransition(rotated, ring([k({ kid: B.kid, publicKey: B.x, activatedAt: T1 })])).join(), /removed/);
  assert.match(validateTransition(rotated, ring([k({ kid: A.kid, publicKey: A.x }), k({ kid: B.kid, publicKey: B.x, activatedAt: T1 })])).join(), /backwards/);
  assert.match(validateTransition(before, ring([k({ kid: A.kid, publicKey: B.x })])).join(), /key material/);
});

test("rotation never invalidates old receipts; revocation does; strangers never pass", () => {
  const rotated = ring([k({ kid: A.kid, publicKey: A.x, status: "retired", retiredAt: T1 }), k({ kid: B.kid, publicKey: B.x, activatedAt: T1 })]);
  assert.equal(checkReceiptKey({ kid: A.kid, publicKey: A.x, issuedAt: "2026-03-01T00:00:00Z" }, rotated).ok, true, "old receipt still valid");
  assert.equal(checkReceiptKey({ kid: A.kid, publicKey: A.x, issuedAt: "2026-07-01T00:00:00Z" }, rotated).ok, false, "retired key cannot sign new receipts");
  assert.equal(checkReceiptKey({ kid: B.kid, publicKey: B.x, issuedAt: "2026-07-01T00:00:00Z" }, rotated).ok, true);
  assert.equal(checkReceiptKey({ kid: B.kid, publicKey: A.x, issuedAt: "2026-07-01T00:00:00Z" }, rotated).ok, false, "kid/key mismatch");
  assert.equal(checkReceiptKey({ kid: "ffffffffffffffff", publicKey: A.x, issuedAt: T1 }, rotated).ok, false, "unknown key");
  const revoked = ring([
    k({ kid: A.kid, publicKey: A.x, status: "revoked", retiredAt: T1, revokedAt: T1, revokedReason: "seed exposed" }),
    k({ kid: B.kid, publicKey: B.x, activatedAt: T1 }),
  ]);
  const r = checkReceiptKey({ kid: A.kid, publicKey: A.x, issuedAt: "2026-03-01T00:00:00Z" }, revoked);
  assert.equal(r.ok, false);
  assert.match(r.detail, /seed exposed/);
});

test("production fails closed: a key that is not the keyring's active key cannot sign", async () => {
  process.env.NODE_ENV = "production";
  process.env.VERITYX_SEAL_KEY = "33".repeat(32);
  const key = await loadSealKey();
  assert.ok(key && !key.ephemeral);
  assert.match(keyringRefusal(key!) ?? "", /not in the published keyring/);
  const pub = await publishedSealKey();
  assert.equal(pub.available, false);
  assert.ok(pub.keyring.keys.length >= 1, "the keyring is still published so old receipts verify");
  const entry = { event_id: "e", event_type: "t", payload: {}, actor: "a", timestamp: 1, prev_hash: "0".repeat(64), signature: "0".repeat(64), hash: "0".repeat(64) };
  assert.equal(await issueReceipt(entry, { root: "0".repeat(64), index: 0, leafCount: 1, path: [] }), null);
});
