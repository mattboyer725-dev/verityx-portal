import assert from "node:assert/strict";
import { test } from "node:test";
import { history, latest, periodLabel, REFERENCE, referenceSources } from "./reference-prices.ts";

test("bundled reference prices are present, positive, dated and licensed", () => {
  for (const k of ["copper", "aluminium", "ndprOxide", "dyOxide"] as const) {
    const l = latest(k);
    assert.ok(l && l.value > 0, `${k} has a latest value`);
    assert.ok(l!.source.license.length > 0 && l!.source.attribution.startsWith("Source:"), `${k} carries a licence and attribution`);
  }
  assert.equal(REFERENCE.series.copper.frequency, "monthly");
  assert.equal(REFERENCE.series.ndprOxide.frequency, "annual");
  assert.match(latest("copper")!.source.license, /CC BY 4\.0/);
  assert.match(latest("ndprOxide")!.source.license, /Public domain/);
});

test("no unlicensed source names appear in the bundled data", () => {
  const blob = JSON.stringify(REFERENCE);
  for (const banned of ["westmetall", "yahoo", "MP Materials", "comex"]) assert.ok(!blob.toLowerCase().includes(banned.toLowerCase()), banned);
});

test("period labels say what the number is", () => {
  assert.equal(periodLabel({ period: "2026-10", value: 1 }, "monthly"), "Oct 2026 avg");
  assert.equal(periodLabel({ period: "2025", value: 1, estimated: true }, "annual"), "2025 avg (est.)");
  assert.ok(history("copper", 12).length === 12);
  assert.ok(referenceSources().length >= 2);
});
