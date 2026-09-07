import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { __resetCirculorForTests, recordCirculorLot, getCirculorLot } from "./circulor.ts";
import { getMinespiderBatch } from "./minespider.ts";

describe("Circulor lot ledger", () => {
  beforeEach(() => __resetCirculorForTests());

  it("hashes a mass-balance custody chain for a magnet lot", async () => {
    const lot = await recordCirculorLot({
      id: "SG-4782",
      po: "4500187742",
      commodity: "NdFeB magnet",
      plant: "Brande, DK",
      tiers: [
        { role: "Mine", name: "Bayan Obo pit", country: "CN", evidence: "lot weighbridge", lat: 41.7, lng: 109.9 },
        { role: "Magnet OEM", name: "Nanjing RareTech Ltd.", country: "CN", evidence: "ISO 9001", lat: 32.0, lng: 118.7 },
        { role: "OEM plant", name: "Siemens Gamesa Brande", country: "DK", evidence: "SAP PO", lat: 55.7, lng: 9.1 },
      ],
    });
    assert.match(lot.lot, /^CIR-SGRE-/);
    assert.match(lot.dppId, /^dpp:eu:sgre:/);
    assert.equal(lot.events.length, 3);
    assert.equal(new Set(lot.events.map((e) => e.hash)).size, 3);
    assert.equal(getCirculorLot(lot.lot)?.balanceKg, lot.massKg);
    const batch = getMinespiderBatch(lot.minespiderBatch);
    assert.ok(batch);
    assert.equal(batch.events.length, 3);
    assert.equal(batch.certificate.algorithm, "SHA-256");
    assert.equal(batch.events[1].prev, batch.events[0].hash);
  });
});
