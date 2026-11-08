import assert from "node:assert/strict";
import { test } from "node:test";
import { checkQuote, DEFAULT_ASSUMPTIONS, modelFor, shouldCost } from "./should-cost.ts";

const LIVE = { ndprOxideUsdKg: 60, dyOxideUsdKg: 300, copperUsdT: 10_000, usdEur: 0.9, asOf: "2026-11-08T18:00:00Z" };

test("maps the desk commodities to models and leaves the rest unmodelled", () => {
  assert.equal(modelFor("NdFeB magnet"), "ndfeb");
  assert.equal(modelFor("NdPr alloy"), "ndpr-alloy");
  assert.equal(modelFor("Dy metal"), "dy-metal");
  assert.equal(modelFor("Cu CTC"), "copper-ctc");
  assert.equal(modelFor("IGBT module"), null);
  assert.equal(modelFor("S355 plate"), null);
  const r = shouldCost("IGBT module", LIVE);
  assert.equal(r.ok, false);
});

test("never prices on a placeholder: a missing live price stops the model", () => {
  const r = shouldCost("NdFeB magnet", { copperUsdT: 10_000 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /standby/);
});

test("NdPr metal: hand calculation at the mid assumptions", () => {
  const r = shouldCost("NdPr alloy", { ndprOxideUsdKg: 60 });
  assert.ok(r.ok);
  if (!r.ok) return;
  // metal = 60 / 0.85 / (1 - 0.04) = 73.529…; + conversion 10 = 83.529…; × 1.07 = 89.376…
  assert.equal(r.currency, "USD");
  assert.equal(r.perKg.mid, 89.38);
  assert.ok(r.perKg.low < r.perKg.mid && r.perKg.mid < r.perKg.high);
});

test("copper CTC: hand calculation, converted to EUR", () => {
  const r = shouldCost("Cu CTC", { copperUsdT: 10_000, usdEur: 0.9 });
  assert.ok(r.ok);
  if (!r.ok) return;
  // cu = 0.97 × 10 / 0.98 = 9.8979…; + 1.6 = 11.4979…; × 1.07 = 12.3028… USD; × 0.9 = 11.07 EUR
  assert.equal(r.currency, "EUR");
  assert.equal(r.perKg.mid, 11.07);
});

test("NdFeB breakdown lines add up to the mid price", () => {
  const r = shouldCost("NdFeB magnet", LIVE);
  assert.ok(r.ok);
  if (!r.ok) return;
  const sum = r.breakdownMid.reduce((a, l) => a + l.usdPerKg, 0);
  assert.ok(Math.abs(sum - r.perKg.mid) < 0.05, `${sum} vs ${r.perKg.mid}`);
});

test("rare-earth price moves flow through: doubling NdPr raises the magnet should-cost", () => {
  const a = shouldCost("NdFeB magnet", LIVE);
  const b = shouldCost("NdFeB magnet", { ...LIVE, ndprOxideUsdKg: 120 });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.ok(b.perKg.mid > a.perKg.mid * 1.2);
});

test("edited assumptions are validated", () => {
  const bad = DEFAULT_ASSUMPTIONS["ndpr-alloy"].map((x) => (x.key === "loss" ? { ...x, band: { low: 5, mid: 3, high: 8 } } : x));
  const r = shouldCost("NdPr alloy", { ndprOxideUsdKg: 60 }, bad);
  assert.equal(r.ok, false);
});

test("quote check: above, inside and below the fair range", () => {
  const r = shouldCost("NdPr alloy", { ndprOxideUsdKg: 60 });
  assert.ok(r.ok);
  if (!r.ok) return;
  const kg = 1000;
  assert.equal(checkQuote(r, kg, r.perKg.mid * kg)!.verdict, "IN_RANGE");
  const high = checkQuote(r, kg, r.perKg.high * kg * 1.5)!;
  assert.equal(high.verdict, "ABOVE_RANGE");
  assert.ok(high.overHigh > 0);
  assert.equal(checkQuote(r, kg, r.perKg.low * kg * 0.5)!.verdict, "BELOW_RANGE");
  assert.equal(checkQuote(r, 0, 100), null);
});
