/**
 * local-core v1.7.0 parity: the fixes from the line-by-line review of v1.6.0,
 * applied to the portal's TypeScript port.
 */
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { afterEach, test } from "node:test";
import {
  __resetForTests,
  appendCoreEvent,
  appendCoreEvents,
  canonicalJson,
  doctor,
  dumpLog,
  loadKeys,
  loadLog,
  verifyChain,
} from "./core-ledger.ts";

const REAL = "a1".repeat(32); // 64 bytes, not public
const REAL_NEXT = "b2".repeat(32);
const LEGACY = "verityx-desk-local-core-hmac-v1.6.0-siemens-gamesa-magnetics";
const ENV_KEYS = ["LOCAL_CORE_SECRET", "LOCAL_CORE_SECRET_PREVIOUS", "LOCAL_CORE_ALLOW_DEV_SECRET", "NODE_ENV"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

function setEnv(vars: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    const v = k in vars ? vars[k] : saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  setEnv({});
  __resetForTests();
});

test("known public secrets never sign — including the legacy portal key and the .env.example placeholder", async () => {
  for (const pub of [
    LEGACY,
    "verityx-local-core-dev-secret-change-me",
    "replace-with-a-real-random-secret-do-not-use-this-value",
  ]) {
    setEnv({ LOCAL_CORE_SECRET: pub });
    assert.equal(loadKeys().signing, null, pub);
    await assert.rejects(() => appendCoreEvent("note.append", { text: "x" }), /signing refused: .*publicly known/);
    assert.equal((await doctor()).checks.secret.status, "fail");
  }
  assert.equal(dumpLog().length, 0);
});

test("short secret is rejected", async () => {
  setEnv({ LOCAL_CORE_SECRET: "too-short" });
  await assert.rejects(() => appendCoreEvent("note.append", { text: "x" }), /at least 32 bytes/);
});

test("production with no secret fails closed; the dev key needs an explicit opt-in there", async () => {
  setEnv({ LOCAL_CORE_SECRET: undefined, NODE_ENV: "production" });
  await assert.rejects(() => appendCoreEvent("note.append", { text: "x" }), /required in production/);
  assert.equal((await doctor()).overall, "fail");
  setEnv({ LOCAL_CORE_SECRET: undefined, NODE_ENV: "production", LOCAL_CORE_ALLOW_DEV_SECRET: "1" });
  await appendCoreEvent("note.append", { text: "x" });
  assert.equal((await doctor()).overall, "warn");
});

test("a real server secret gives a clean doctor", async () => {
  setEnv({ LOCAL_CORE_SECRET: REAL, NODE_ENV: "production" });
  await appendCoreEvent("note.append", { text: "sealed" });
  const d = await doctor();
  assert.equal(d.overall, "ok");
  assert.equal(d.checks.secret.status, "ok");
});

test("rotation: LOCAL_CORE_SECRET_PREVIOUS verifies history but never signs", async () => {
  setEnv({ LOCAL_CORE_SECRET: REAL });
  await appendCoreEvent("note.append", { text: "before rotation" });
  const history = dumpLog();
  __resetForTests();

  // Rotated with no previous key: old history no longer verifies, and appends refuse.
  setEnv({ LOCAL_CORE_SECRET: REAL_NEXT });
  loadLog(history);
  assert.equal((await verifyChain()).ok, false);
  await assert.rejects(() => appendCoreEvent("note.append", { text: "after" }), /damaged existing chain/);
  __resetForTests();

  setEnv({ LOCAL_CORE_SECRET: REAL_NEXT, LOCAL_CORE_SECRET_PREVIOUS: REAL });
  loadLog(history);
  const after = await appendCoreEvent("note.append", { text: "after rotation" });
  const chain = await verifyChain();
  assert.equal(chain.ok, true);
  assert.equal(chain.previous_signed, 1);
  assert.equal(after.prev_hash, history[0].hash);
  assert.equal((await doctor()).overall, "ok");
});

test("rotation away from the public legacy key: v1.0 history verifies, doctor warns while it rests on that key", async () => {
  // A genuine v1.0 portal event: signed with the legacy key exactly as the old code did.
  const draft = {
    actor: "elena.hartmann",
    event_id: "00000000-0000-4000-8000-000000000001",
    event_type: "note.append" as const,
    payload: { text: "v1.0 desk-open" },
    prev_hash: "0".repeat(64),
    timestamp: 1788717427.071,
  };
  const body = canonicalJson(draft);
  const signature = createHmac("sha256", LEGACY).update(body).digest("hex");
  const hash = createHash("sha256").update(body + signature).digest("hex");
  const legacyEvent = { ...draft, signature, hash };

  setEnv({ LOCAL_CORE_SECRET: REAL });
  loadLog([legacyEvent]);
  assert.equal((await verifyChain()).ok, false, "without the previous key the legacy event does not verify");
  __resetForTests();

  setEnv({ LOCAL_CORE_SECRET: REAL, LOCAL_CORE_SECRET_PREVIOUS: LEGACY });
  loadLog([legacyEvent]);
  const next = await appendCoreEvent("note.append", { text: "first event under the real key" });
  assert.equal(next.prev_hash, legacyEvent.hash);
  const d = await doctor();
  assert.equal(d.checks.chain.status, "ok");
  assert.equal(d.checks.chain.previous_signed, 1);
  assert.equal(d.checks.secret.status, "warn");
  assert.match(d.checks.secret.note, /public key/);
  assert.equal(d.overall, "warn");
});

test("v1.0 history with non-ASCII (old serializer) still verifies under the previous key, and only there", async () => {
  // The old portal hashed with JSON.stringify: "·" raw, not \u00b7. Every desk decision context had one.
  const draft = {
    actor: "elena.hartmann@siemensgamesa.example",
    event_id: "00000000-0000-4000-8000-000000000002",
    event_type: "decision.record" as const,
    payload: { title: "4500196604", choice: "HOLD_PO", context: "NdFeB magnets · Ningbo" },
    prev_hash: "0".repeat(64),
    timestamp: 1788717427.5,
  };
  const sortDeep = (v: unknown): unknown =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]))
      : v;
  const oldBody = JSON.stringify(sortDeep(draft));
  assert.notEqual(oldBody, canonicalJson(draft), "fixture must exercise the serializer difference");
  const signature = createHmac("sha256", LEGACY).update(oldBody).digest("hex");
  const event = { ...draft, signature, hash: createHash("sha256").update(oldBody + signature).digest("hex") };

  setEnv({ LOCAL_CORE_SECRET: REAL, LOCAL_CORE_SECRET_PREVIOUS: LEGACY });
  loadLog([event]);
  const chain = await verifyChain();
  assert.equal(chain.ok, true, chain.errors.join("; "));
  assert.equal(chain.previous_signed, 1);
  __resetForTests();

  // The legacy serializer is never honoured for the current key: a forger cannot use it to sign new history.
  const forged = createHmac("sha256", REAL).update(oldBody).digest("hex");
  setEnv({ LOCAL_CORE_SECRET: REAL });
  loadLog([{ ...draft, signature: forged, hash: createHash("sha256").update(oldBody + forged).digest("hex") }]);
  assert.equal((await verifyChain()).ok, false);
});

test("batch is all-or-nothing: an invalid second payload appends nothing (ritual.py fix)", async () => {
  setEnv({ LOCAL_CORE_SECRET: REAL });
  await assert.rejects(() =>
    appendCoreEvents([
      { type: "decision.record", payload: { title: "PO", choice: "HOLD_PO", context: "NdFeB" } },
      { type: "decision.record", payload: { title: "no choice" } },
    ]),
  );
  assert.equal(dumpLog().length, 0);
  const pair = await appendCoreEvents([
    { type: "artifact.record", payload: { title: "seal", location: "ab".repeat(32), kind: "po-seal" } },
    { type: "decision.record", payload: { title: "PO", choice: "HOLD_PO", context: "x" } },
  ]);
  assert.equal(pair.length, 2);
  assert.equal(pair[1].prev_hash, pair[0].hash);
});

test("memory.set values that cannot be canonically signed are rejected up front", async () => {
  setEnv({ LOCAL_CORE_SECRET: REAL });
  for (const value of [NaN, Infinity, { a: undefined }, [1, () => 1]]) {
    await assert.rejects(() => appendCoreEvent("memory.set", { ns: "n", key: "k", value }));
  }
  assert.equal(dumpLog().length, 0);
});

test("a same-length edit to the tip is caught on the next append (content-keyed tip cache)", async () => {
  setEnv({ LOCAL_CORE_SECRET: REAL });
  const tip = await appendCoreEvent("note.append", { text: "abcd" });
  tip.payload.text = "abce"; // same length, same structure
  await assert.rejects(() => appendCoreEvent("note.append", { text: "next" }), /damaged existing chain/);
});

test("concurrent appends serialise into one unforked chain", async () => {
  setEnv({ LOCAL_CORE_SECRET: REAL });
  await Promise.all(Array.from({ length: 12 }, (_, i) => appendCoreEvent("note.append", { text: `n${i}` })));
  const chain = await verifyChain();
  assert.equal(chain.ok, true);
  assert.equal(chain.depth, 12);
});

test("canonical JSON is byte-identical to python json.dumps(sort_keys, separators, ensure_ascii)", () => {
  assert.equal(canonicalJson({ b: 1, a: "Hartmann — €12 · ü 😀" }), '{"a":"Hartmann \\u2014 \\u20ac12 \\u00b7 \\u00fc \\ud83d\\ude00","b":1}');
  assert.equal(canonicalJson({ t: 1e-7, u: 1.5e300, v: 0.1, w: -0 }), '{"t":1e-07,"u":1.5e+300,"v":0.1,"w":0}');
  assert.equal(canonicalJson({ s: 'q"\\\n\t\u0001/' }), '{"s":"q\\"\\\\\\n\\t\\u0001/"}');
  assert.throws(() => canonicalJson({ n: NaN }));
});
