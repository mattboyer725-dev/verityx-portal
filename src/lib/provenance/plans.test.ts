import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkPack, checkPortfolio, checkSeal, limitsFor, planInForce, storedPlanFromStripe } from "./plans.ts";

describe("limits", () => {
  it("free: 5 seals, 25 parts, 1 program, 1 pack", () => {
    assert.deepEqual(limitsFor({ supplierPlan: "free", buyerPlan: "free" }), { sealsPerYear: 5, maxParts: 25, maxPrograms: 1, maxPacks: 1 });
  });
  it("supplier plan lifts seals only", () => {
    assert.deepEqual(limitsFor({ supplierPlan: "supplier", buyerPlan: "free" }), { sealsPerYear: null, maxParts: 25, maxPrograms: 1, maxPacks: 1 });
  });
  it("team: 250 parts, 1 program, unlimited packs; program includes supplier", () => {
    assert.deepEqual(limitsFor({ supplierPlan: "free", buyerPlan: "team" }), { sealsPerYear: 5, maxParts: 250, maxPrograms: 1, maxPacks: null });
    assert.deepEqual(limitsFor({ supplierPlan: "free", buyerPlan: "program" }), { sealsPerYear: null, maxParts: 2500, maxPrograms: null, maxPacks: null });
    assert.deepEqual(limitsFor({ supplierPlan: "free", buyerPlan: "enterprise" }), { sealsPerYear: null, maxParts: null, maxPrograms: null, maxPacks: null });
  });
});

describe("checks", () => {
  const free = limitsFor({ supplierPlan: "free", buyerPlan: "free" });
  it("seal: fifth allowed, sixth refused with an upgrade", () => {
    assert.equal(checkSeal(free, 4).ok, true);
    const c = checkSeal(free, 5);
    assert.equal(c.ok, false);
    if (!c.ok) assert.equal(c.upgrade, "supplier");
  });
  it("portfolio: parts then programs, pointing at the next plan up", () => {
    const parts = checkPortfolio(free, { parts: 26, programs: 1 }, "free");
    assert.ok(!parts.ok && parts.upgrade === "team");
    const programs = checkPortfolio(limitsFor({ supplierPlan: "free", buyerPlan: "team" }), { parts: 10, programs: 2 }, "team");
    assert.ok(!programs.ok && programs.upgrade === "program");
    assert.equal(checkPortfolio(free, { parts: 25, programs: 1 }, "free").ok, true);
  });
  it("pack: one free, then Team", () => {
    assert.equal(checkPack(free, 0).ok, true);
    const c = checkPack(free, 1);
    assert.ok(!c.ok && c.upgrade === "team");
  });
});

describe("plan in force", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  it("active until period end plus grace; past_due only within grace; canceled never", () => {
    assert.equal(planInForce({ status: "active", periodEnd: "2027-11-15T00:00:00Z", now }), true);
    assert.equal(planInForce({ status: "active", periodEnd: "2026-10-01T00:00:00Z", now }), false);
    assert.equal(planInForce({ status: "past_due", periodEnd: "2026-11-10T00:00:00Z", now }), true);
    assert.equal(planInForce({ status: "past_due", periodEnd: "2026-10-01T00:00:00Z", now }), false);
    assert.equal(planInForce({ status: "canceled", periodEnd: "2027-11-15T00:00:00Z", now }), false);
    assert.equal(planInForce({ status: "manual", periodEnd: null, now }), true);
    assert.equal(planInForce({ status: null, periodEnd: null, now }), false);
  });
  it("maps Stripe statuses; ended subscriptions fall back to free; unknown plans ignored", () => {
    assert.deepEqual(storedPlanFromStripe({ plan: "team" }, "active"), { side: "buyer", plan: "team", status: "active" });
    assert.deepEqual(storedPlanFromStripe({ plan: "supplier" }, "canceled"), { side: "supplier", plan: "free", status: "canceled" });
    assert.equal(storedPlanFromStripe({ plan: "gold" }, "active"), null);
  });
});
