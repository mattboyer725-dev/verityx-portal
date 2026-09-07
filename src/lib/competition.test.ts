import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITIES, FIELD, competitionNotes, competitionPayload, deskTabForProve, fieldIdForAdapter, provePath, proveSearch } from "./competition.ts";
import { LOOP } from "./nav.ts";
import { seedAdapterCards } from "./adapters.ts";

describe("competitor field", () => {
  it("covers every class the desk was built against", () => {
    const blob = FIELD.map((r) => `${r.names} ${r.category}`).join(" ").toLowerCase();
    for (const name of [
      "ariba",
      "coupa",
      "ecovadis",
      "prewave",
      "resilinc",
      "circulor",
      "minespider",
      "rapidratings",
      "sourcemap",
      "hyperledger",
      "argus",
      "okta",
      "verityx-local-core",
    ]) {
      assert.match(blob, new RegExp(name));
    }
  });

  it("contrasts as well as compares — every class has they / we / contrast", () => {
    for (const row of FIELD) {
      assert.ok(row.they.length > 40, row.id);
      assert.ok(row.we.length > 40, row.id);
      assert.ok(row.contrast.length > 40, row.id);
      assert.match(row.contrast, /not |do not |n.t /i);
    }
  });

  it("keeps the portal notes shape and a live analog on protocol classes", () => {
    const notes = competitionNotes();
    assert.equal(notes.length, FIELD.length);
    assert.ok(FIELD.filter((r) => r.analogPath).every((r) => r.analogPath!.startsWith("/")));
    assert.ok(
      FIELD.filter((r) => r.analogPath && r.analogPath !== "/core").every((r) => r.adapterId),
      "protocol analogs bind to a live adapter card",
    );
    const payload = competitionPayload();
    assert.ok(payload.honest.length >= 6);
    assert.ok(payload.wedge.includes("purchase-order"));
    assert.ok(CAPABILITIES.some((c) => c.vx === "native" && c.s2p !== "native"));
  });

  it("binds every live adapter card onto a field class and a numbered loop", () => {
    assert.equal(LOOP.length, 5);
    assert.deepEqual(
      LOOP.map((s) => s.to),
      ["/field", "/desk", "/work", "/core", "/admin"],
    );
    for (const card of seedAdapterCards()) {
      const id = fieldIdForAdapter(card.id);
      assert.ok(id, card.id);
      const row = FIELD.find((r) => r.id === id);
      assert.equal(row?.adapterId, card.id);
    }
    assert.equal(provePath(FIELD.find((r) => r.id === "core")!), "/core");
    assert.equal(provePath(FIELD.find((r) => r.id === "s2p")!), "/desk");
    assert.equal(deskTabForProve("s2p"), "sap");
    assert.equal(deskTabForProve("sap"), "sap");
    assert.equal(deskTabForProve("oracles"), "mkt");
    assert.equal(deskTabForProve("minerals"), "prov");
    assert.equal(deskTabForProve("consensus"), "seal");
    assert.equal(deskTabForProve("esg"), "screen");
    assert.equal(deskTabForProve("ecovadis"), "screen");
    assert.equal(deskTabForProve("prewave"), "screen");
    assert.equal(fieldIdForAdapter("ecovadis"), "esg");
    assert.equal(fieldIdForAdapter("prewave"), "prewave");
    assert.deepEqual(proveSearch(FIELD.find((r) => r.id === "s2p")!), { prove: "sap" });
    assert.equal(proveSearch(FIELD.find((r) => r.id === "core")!), undefined);
  });
});
