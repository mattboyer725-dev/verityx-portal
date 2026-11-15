import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdapterCards, seedAdapterCards } from "./adapters.ts";

const VENDOR_NAMES = /SAP|Ariba|EcoVadis|Prewave|Circulor|Minespider|Okta|PBFT|RapidRatings/i;

describe("data-source cards", () => {
  it("lists only sources this site actually calls or bundles", () => {
    const cards = buildAdapterCards({ prices: "LIVE", gleif: "LIVE", sanctions: "LIVE", news: "LIVE" });
    assert.deepEqual(
      cards.map((c) => c.id),
      ["prices", "gleif", "sanctions", "media"],
    );
    assert.ok(cards.every((c) => c.status === "LIVE"));
  });

  it("never names a vendor product as a connected source", () => {
    for (const c of seedAdapterCards()) {
      assert.doesNotMatch(`${c.name} ${c.protocol} ${c.detail} ${c.path}`, VENDOR_NAMES);
    }
  });

  it("first paint: bundled references, fetched sources stale", () => {
    const cards = seedAdapterCards();
    assert.equal(cards.find((c) => c.id === "prices")?.status, "REFERENCE");
    assert.ok(cards.filter((c) => c.id !== "prices").every((c) => c.status === "STALE"));
  });
});
