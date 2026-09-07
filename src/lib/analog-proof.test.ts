import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analogSummary, sapEntityPath } from "./analog.ts";

describe("analog summary", () => {
  it("reads SAP OData POs, Circulor lots, and PBFT quorum", () => {
    assert.deepEqual(
      analogSummary("sap", {
        d: { results: [{ PurchaseOrder: "4500187742", Supplier: "Nanjing RareTech Ltd.", ReleaseStatus: "OPEN" }] },
      }),
      ["1 purchase orders", "4500187742 · Nanjing RareTech Ltd. · OPEN"],
    );
    assert.deepEqual(analogSummary("circulor", { lots: [{ lot: "CIR-SGRE-00194410" }, { lot: "x" }] }), [
      "2 hashed lots",
      "CIR-SGRE-00194410",
    ]);
    assert.equal(analogSummary("pbft", { n: 27, f: 8, quorum: 19, seq: 1 })[0], "27 voters · f=8 · quorum 19 · seq 1");
    assert.deepEqual(
      analogSummary("ecovadis", {
        scorecards: [{ supplier: "Nanjing RareTech Ltd.", score: 42, medal: "None" }],
      }),
      ["1 scorecards", "Nanjing RareTech Ltd. · 42 None", "21-criteria · NACE 27 · GLEIF + news"],
    );
    assert.deepEqual(
      analogSummary("prewave", {
        risks: [{ supplier: "Nanjing RareTech Ltd.", level: "HIGH", heat: 58, po: "4500187742" }],
      }),
      ["1 supplier heats", "Nanjing RareTech Ltd. · HIGH 58", "PO 4500187742"],
    );
    assert.match(sapEntityPath("/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV"), /A_PurchaseOrder$/);
  });
});
