import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { ids, isUuidV4 } from "./validate.ts";

test("SEC-01: v4 UUIDs pass; everything sovereign's test_protocols rejects is rejected", () => {
  assert.equal(isUuidV4(randomUUID()), true);
  assert.equal(isUuidV4(randomUUID().toUpperCase()), true);
  for (const bad of [
    "",
    null,
    undefined,
    42,
    { toString: () => randomUUID() },
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8", // v1
    "00000000-0000-0000-0000-000000000000",
    "abc; rm -rf /",
    "' or 1=1 --",
    randomUUID() + "\n",
    " " + randomUUID(),
  ]) {
    assert.equal(isUuidV4(bad), false, String(bad));
  }
});

test("ids() validator guards only the named fields and refuses non-objects", () => {
  const v = ids<{ id: string; scenarioId?: string }>("id");
  const ok = { id: randomUUID(), scenarioId: "S1" };
  assert.equal(v(ok), ok);
  assert.throws(() => v({ id: "S1" }), /invalid id/);
  assert.throws(() => v(null as never), /invalid request/);
  assert.throws(() => v([] as never), /invalid request/);
  const two = ids<{ pilotId: string; prospectId: string }>("pilotId", "prospectId");
  assert.throws(() => two({ pilotId: randomUUID(), prospectId: "x" }), /invalid prospectId/);
});
