import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { handleMinespiderHttp } from "./minespider-http.ts";
import { recordCirculorLot, __resetCirculorForTests } from "./circulor.ts";

describe("Minespider batch ledger", () => {
  beforeEach(() => __resetCirculorForTests());

  it("serves hashed batch passports over HTTP", async () => {
    const lot = await recordCirculorLot({
      id: "SG-4782",
      po: "4500187742",
      commodity: "NdFeB magnet",
      plant: "Brande, DK",
      tiers: [
        { role: "Mine", name: "Bayan Obo pit", country: "CN", evidence: "lot weighbridge", lat: 41.7, lng: 109.9 },
        { role: "Magnet OEM", name: "Nanjing RareTech Ltd.", country: "CN", evidence: "ISO 9001", lat: 32.0, lng: 118.7 },
      ],
    });
    const list = await handleMinespiderHttp(new Request("https://verityx.test/minespider/api/v1/batches"));
    assert.ok(list);
    const body = await list.json();
    assert.equal(body.count, 1);
    assert.equal(body.batches[0].batchId, lot.minespiderBatch);

    const one = await handleMinespiderHttp(
      new Request(`https://verityx.test/minespider/api/v1/batches/${lot.minespiderBatch}`),
    );
    const rec = await one!.json();
    assert.equal(rec.certificate.algorithm, "SHA-256");
    assert.equal(rec.events[0].prev, "GENESIS");
    assert.equal(rec.events[1].prev, rec.events[0].hash);

    const missing = await handleMinespiderHttp(
      new Request("https://verityx.test/minespider/api/v1/batches/MS-NONE"),
    );
    assert.equal(missing!.status, 404);
  });
});
