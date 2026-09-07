import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { handleSapHttp } from "./sap-http.ts";
import { handleAribaHttp } from "./ariba-http.ts";
import { __resetSapForTests, seedSapPo, issueCsrf, getSapPo } from "./sap.ts";

describe("SAP OData tenant", () => {
  beforeEach(() => {
    __resetSapForTests();
    seedSapPo({
      po: "4500187742",
      id: "SG-4782",
      supplier: "Nanjing RareTech Ltd.",
      title: "Rare Earth Permanent Magnets",
      plant: "Brande, DK",
      commodity: "NdFeB magnet",
      amount: 6_950_000,
      currency: "EUR",
    });
  });

  it("serves the entity set and a single PO", async () => {
    const list = await handleSapHttp(
      new Request("https://verityx.test/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder"),
    );
    assert.ok(list);
    const body = await list.json();
    assert.equal(body.d.results.length, 1);
    assert.equal(body.d.results[0].PurchaseOrder, "4500187742");

    const one = await handleSapHttp(
      new Request("https://verityx.test/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500187742')"),
    );
    assert.equal((await one!.json()).d.ReleaseStatus, "OPEN");
  });

  it("issues CSRF and patches HOLD with If-Match", async () => {
    const token = issueCsrf();
    const get = await handleSapHttp(
      new Request("https://verityx.test/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500187742')"),
    );
    const etag = (await get!.json()).d.ETag as string;
    const patch = await handleSapHttp(
      new Request("https://verityx.test/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500187742')", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": token, "if-match": etag },
        body: JSON.stringify({ ReleaseStatus: "HOLD" }),
      }),
    );
    assert.equal(patch!.status, 200);
    const rec = await patch!.json();
    assert.equal(rec.d.ReleaseStatus, "HOLD");
    assert.equal(rec.writeback.bapi.function, "BAPI_PO_CHANGE");
    assert.match(rec.writeback.idoc.xml, /ORDERS05/);
  });

  it("rejects a stale ETag", async () => {
    const token = issueCsrf();
    const patch = await handleSapHttp(
      new Request("https://verityx.test/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500187742')", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": token, "if-match": 'W/"stale"' },
        body: JSON.stringify({ ReleaseStatus: "HOLD" }),
      }),
    );
    assert.equal(patch!.status, 412);
  });
});

describe("Ariba sourcing tenant", () => {
  beforeEach(() => {
    __resetSapForTests();
    seedSapPo({
      po: "4500187742",
      id: "SG-4782",
      supplier: "Nanjing RareTech Ltd.",
      title: "Rare Earth Permanent Magnets",
      plant: "Brande, DK",
      commodity: "NdFeB magnet",
      amount: 6_950_000,
      currency: "EUR",
    });
  });

  it("lists RFQ events and holds a PO through the event", async () => {
    const list = await handleAribaHttp(new Request("https://verityx.test/ariba/api/sourcing/v2/events"));
    assert.ok(list);
    const body = await list.json();
    assert.equal(body.count, 1);
    assert.equal(body.d.results[0].eventId, "RFQ-187742");
    assert.equal(body.d.results[0].relatedDocument.id, "4500187742");

    const patch = await handleAribaHttp(
      new Request("https://verityx.test/ariba/api/sourcing/v2/events/RFQ-187742", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "OnHold" }),
      }),
    );
    assert.equal(patch!.status, 200);
    const rec = await patch!.json();
    assert.equal(rec.d.status, "OnHold");
    assert.equal(getSapPo("4500187742")?.ReleaseStatus, "HOLD");
  });
});
