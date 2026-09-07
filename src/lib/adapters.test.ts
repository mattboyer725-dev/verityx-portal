import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdapterCards, seedAdapterCards } from "./adapters.ts";

describe("adapter cards", () => {
  it("names every former honest fake as a live protocol on this host", () => {
    const cards = buildAdapterCards({
      sapCount: 8,
      argus: "LIVE",
      gleif: "LIVE",
      sanctions: "LIVE",
      opensanctions: "LIVE",
      news: "LIVE",
      pbftSeq: 3,
      pbftCommitted: true,
      circulorLots: 4,
      okta: "LIVE",
    });
    const ids = cards.map((c) => c.id);
    assert.deepEqual(ids, ["sap", "argus", "ecovadis", "prewave", "screen", "circulor", "pbft", "okta"]);
    assert.ok(cards.every((c) => c.status === "LIVE"));
    assert.ok(cards.find((c) => c.id === "sap")?.path.includes("/sap/opu/odata"));
    assert.match(cards.find((c) => c.id === "sap")!.detail, /Ariba/i);
    assert.match(cards.find((c) => c.id === "circulor")!.detail, /Minespider/i);
    assert.ok(cards.find((c) => c.id === "okta")?.path.includes("openid-configuration"));
  });

  it("seeds hosted analogs live and market screens stale", () => {
    const cards = seedAdapterCards();
    assert.equal(cards.length, 8);
    assert.equal(cards.find((c) => c.id === "sap")?.status, "LIVE");
    assert.equal(cards.find((c) => c.id === "pbft")?.status, "LIVE");
    assert.equal(cards.find((c) => c.id === "circulor")?.status, "LIVE");
    assert.equal(cards.find((c) => c.id === "okta")?.status, "LIVE");
    assert.equal(cards.find((c) => c.id === "screen")?.status, "STALE");
    assert.equal(cards.find((c) => c.id === "argus")?.status, "STALE");
    assert.equal(cards.find((c) => c.id === "ecovadis")?.status, "STALE");
    assert.equal(cards.find((c) => c.id === "prewave")?.status, "STALE");
    assert.match(cards.find((c) => c.id === "ecovadis")!.path, /ecovadis\/api\/v2\/scorecards/);
    assert.match(cards.find((c) => c.id === "prewave")!.path, /prewave\/api\/v1\/risks/);
  });
});
