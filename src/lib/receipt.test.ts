import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { __resetForTests, appendCoreEvent, eventHashes, inclusionProof } from "./core-ledger.ts";
import { findReceipt, verifyReceipt, type SealReceipt } from "./receipt.ts";
import { issueReceipt, loadSealKey, publishedSealKey } from "./receipt.server.ts";

const SEED = "9f".repeat(32);
const saved = { k: process.env.VERITYX_SEAL_KEY, s: process.env.LOCAL_CORE_SECRET, n: process.env.NODE_ENV };
afterEach(() => {
  process.env.VERITYX_SEAL_KEY = saved.k ?? "";
  process.env.LOCAL_CORE_SECRET = saved.s ?? "";
  if (saved.n === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved.n;
  __resetForTests();
});

async function sealOne(context = "Acme · NdPr alloy · 1000 kg · €80,000"): Promise<SealReceipt> {
  process.env.LOCAL_CORE_SECRET = "a1".repeat(32);
  process.env.VERITYX_SEAL_KEY = SEED;
  await appendCoreEvent("note.append", { text: "genesis" }, "local-core");
  const e = await appendCoreEvent("decision.record", { title: "PO 4500187742", choice: "HOLD", context });
  await appendCoreEvent("note.append", { text: "after" }, "local-core");
  const hashes = eventHashes();
  const index = hashes.indexOf(e.hash);
  const { root, path } = await inclusionProof(hashes, index);
  const r = await issueReceipt(e, { root, index, leafCount: hashes.length, path });
  assert.ok(r);
  return r!;
}

test("a fresh receipt passes all three checks against the published key", async () => {
  const r = await sealOne();
  const pub = await publishedSealKey();
  assert.ok(pub.available);
  const v = await verifyReceipt(r, pub.available ? pub.publicKey : null);
  assert.equal(v.valid, true, JSON.stringify(v));
  // The test seed is not in the committed keyring, so its receipts say so…
  assert.equal(r.issuer, "https://verityx-portal.vercel.app (unpublished dev key)");
  // …and fail the keyring check while every cryptographic check still passes.
  const byRing = await verifyReceipt(r);
  assert.equal(byRing.content.ok && byRing.ledger.ok && byRing.signature.ok, true);
  assert.equal(byRing.key.ok, false);
  assert.match(byRing.key.detail, /not in VerityX’s published keyring/);
});

test("changing one character of the sealed payload fails the content and signature checks", async () => {
  const r = await sealOne();
  const pub = await publishedSealKey();
  const forged = structuredClone(r);
  forged.entry.payload.choice = "PROCEED";
  const v = await verifyReceipt(forged, pub.available ? pub.publicKey : null);
  assert.equal(v.valid, false);
  assert.equal(v.content.ok, false);
  assert.equal(v.signature.ok, false);
});

test("a swapped ledger root fails both the ledger and signature checks", async () => {
  const r = await sealOne();
  const forged = structuredClone(r);
  forged.merkle.root = "ab".repeat(32);
  const v = await verifyReceipt(forged, r.publicKey);
  assert.equal(v.ledger.ok, false);
  assert.equal(v.signature.ok, false);
});

test("a receipt re-signed with someone else's key is caught by the published-key check", async () => {
  const r = await sealOne();
  process.env.VERITYX_SEAL_KEY = "11".repeat(32);
  const other = await issueReceipt(r.entry, r.merkle);
  const v = await verifyReceipt(other!, r.publicKey);
  assert.equal(v.signature.ok, true, "self-consistent");
  assert.equal(v.key.ok, false, "but not VerityX's key");
  assert.equal(v.valid, false);
});

test("production without a seal key issues nothing; a malformed key is refused", async () => {
  process.env.NODE_ENV = "production";
  process.env.VERITYX_SEAL_KEY = "";
  assert.equal(await loadSealKey(), null);
  process.env.VERITYX_SEAL_KEY = "not-hex";
  assert.equal(await loadSealKey(), null);
});

test("a receipt is found inside an exported packet", async () => {
  const r = await sealOne();
  assert.equal(findReceipt({ message: "x", proof: { receipt: r } })?.signature, r.signature);
  assert.equal(findReceipt({ nothing: true }), null);
});
