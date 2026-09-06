import assert from "node:assert/strict";
import { test } from "node:test";
import {
  __resetForTests,
  appendCoreEvent,
  doctor,
  hashPair,
  inclusionProof,
  leafHash,
  merkleRootOf,
  verifyChain,
  verifyInclusion,
} from "./core-ledger.ts";

const AA = "aa".repeat(32);
const BB = "bb".repeat(32);
const CC = "cc".repeat(32);

test("merkle empty root is 64 zeros (python merkle.py)", async () => {
  assert.equal(await merkleRootOf([]), "0".repeat(64));
});

test("merkle leaf/pair/root match python fixtures from v1.6.0", async () => {
  assert.equal(await leafHash(AA), "e0bb82791bae3c50bd9c20fa4ccdcb8064a56e5c12bc69b07e6712ac9b4429e6");
  assert.equal(
    await hashPair(
      "e0bb82791bae3c50bd9c20fa4ccdcb8064a56e5c12bc69b07e6712ac9b4429e6",
      await leafHash(BB),
    ),
    "03938e2c8f758e6cae443d499b41c899c373eb0c0198bae61796a069f2b05904",
  );
  assert.equal(await merkleRootOf([AA, BB, CC]), "2f76bf7e7413d28edd1e7b531c6b023d2e9460bf8df9943d59594d72f055a446");
});

test("inclusion proof for index 1 matches python", async () => {
  const { root, path } = await inclusionProof([AA, BB, CC], 1);
  assert.equal(root, "2f76bf7e7413d28edd1e7b531c6b023d2e9460bf8df9943d59594d72f055a446");
  assert.equal(path[0].side, "L");
  assert.equal(path[0].sibling, "e0bb82791bae3c50bd9c20fa4ccdcb8064a56e5c12bc69b07e6712ac9b4429e6");
  assert.equal(path[1].side, "R");
  assert.equal(path[1].sibling, "1f5ba75e25a9b6b62e394b4ae418039696925ed27b500605749f57bd2e5e0dde");
  assert.equal(await verifyInclusion(BB, 1, path, root), true);
  assert.equal(await verifyInclusion("ab".repeat(32), 1, path, root), false);
});

test("HMAC chain append + verify + tamper detect", async () => {
  __resetForTests();
  const a = await appendCoreEvent("system.ping", { ok: true, detail: "t" }, "local-core");
  const b = await appendCoreEvent("note.append", { text: "hello" }, "elena.hartmann");
  assert.equal(a.hash.length, 64);
  assert.equal(b.signature.length, 64);
  const ok = await verifyChain();
  assert.equal(ok.ok, true);
  assert.equal(ok.depth, 2);
  b.payload.text = "tampered";
  const broken = await verifyChain();
  assert.equal(broken.ok, false);
  assert.ok(broken.bad >= 1);
  __resetForTests();
});

test("schema rejects unknown type and incomplete decision", async () => {
  __resetForTests();
  await assert.rejects(() => appendCoreEvent("hack.execute" as never, { cmd: "rm" }));
  await assert.rejects(() => appendCoreEvent("decision.record", { title: "x", choice: "y" }));
  await appendCoreEvent("decision.record", { title: "PO", choice: "HOLD_PO", context: "NdFeB" });
  const d = await doctor();
  assert.equal(d.overall, "ok");
  assert.equal(d.version, "1.6.0");
  __resetForTests();
});
