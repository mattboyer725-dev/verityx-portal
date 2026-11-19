import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysUntilDeadline } from "./deadline.ts";

describe("daysUntilDeadline", () => {
  it("counts whole days, rounding up", () => {
    assert.equal(daysUntilDeadline(Date.UTC(2026, 10, 19, 23, 50)), 43);
    assert.equal(daysUntilDeadline(Date.UTC(2026, 11, 31, 0, 0)), 1);
    assert.equal(daysUntilDeadline(Date.UTC(2026, 11, 31, 23, 59)), 1);
  });
  it("is zero on and after the date", () => {
    assert.equal(daysUntilDeadline(Date.UTC(2027, 0, 1)), 0);
    assert.equal(daysUntilDeadline(Date.UTC(2027, 5, 1)), 0);
  });
});
