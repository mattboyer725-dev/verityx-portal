import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can } from "./rbac.ts";

describe("rbac", () => {
  it("viewers cannot write or approve", () => {
    assert.equal(can("viewer", "prospect.write"), false);
    assert.equal(can("viewer", "decision.approve"), false);
    assert.equal(can("viewer", "audit.read"), true);
  });

  it("analysts write decisions but cannot approve BLOCK or mark paid", () => {
    assert.equal(can("analyst", "decision.write"), true);
    assert.equal(can("analyst", "decision.approve"), false);
    assert.equal(can("analyst", "payment.manual"), false);
  });

  it("founder and admin can approve and record payment", () => {
    assert.equal(can("founder", "decision.approve"), true);
    assert.equal(can("admin", "payment.manual"), true);
  });
});
