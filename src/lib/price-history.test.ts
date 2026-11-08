import assert from "node:assert/strict";
import { test } from "node:test";
import { driftReport, driverMove, snapshotDue, type Snapshot } from "./price-history.ts";

const snap = (daysAgo: number, v: Partial<Snapshot>): Snapshot => ({
  takenAt: new Date(Date.UTC(2026, 10, 8) - daysAgo * 86_400_000).toISOString(),
  ndpr: null,
  dy: null,
  cu: null,
  al: null,
  usdEur: null,
  ...v,
});

const ORDERS = [
  { id: "SG-4782", po: "4500187742", title: "Magnets", commodity: "NdFeB magnet" },
  { id: "SG-6033", po: "4500191044", title: "Copper CTC", commodity: "Cu CTC" },
  { id: "SG-9012", po: "4500195520", title: "IGBT", commodity: "IGBT module" },
];

test("no baseline old enough → no move, and the report says history is too short", () => {
  const s = [snap(0.2, { ndpr: 40 }), snap(0, { ndpr: 60 })];
  assert.equal(driverMove(s, "ndpr"), null);
  const r = driftReport(s, ORDERS);
  assert.equal(r.enoughHistory, false);
  assert.equal(r.alerts.length, 0);
});

test("a 12% NdPr rise over a week flags the magnet order, not copper or IGBT", () => {
  const s = [snap(7, { ndpr: 50, cu: 10_000 }), snap(3, { ndpr: 52, cu: 10_100 }), snap(0, { ndpr: 56, cu: 10_200 })];
  const r = driftReport(s, ORDERS);
  assert.equal(r.enoughHistory, true);
  assert.deepEqual(r.alerts.map((a) => a.order.id), ["SG-4782"]);
  assert.equal(r.alerts[0].moves[0].changePct, 12);
  assert.equal(r.alerts[0].moves[0].fromAt, s[0].takenAt);
});

test("standby gaps are skipped, never treated as zero", () => {
  const s = [snap(10, { cu: 10_000 }), snap(5, { cu: null }), snap(0, { cu: 8_800 })];
  const m = driverMove(s, "cu");
  assert.equal(m?.changePct, -12);
  assert.deepEqual(driftReport(s, ORDERS).alerts.map((a) => a.order.id), ["SG-6033"]);
});

test("moves older than the window are not used as a baseline", () => {
  const s = [snap(45, { ndpr: 30 }), snap(0, { ndpr: 60 })];
  assert.equal(driverMove(s, "ndpr", { windowDays: 30 }), null);
});

test("snapshots are throttled to one per 15 minutes", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(snapshotDue(null, now), true);
  assert.equal(snapshotDue("2026-11-08T11:50:00Z", now), false);
  assert.equal(snapshotDue("2026-11-08T11:44:59Z", now), true);
});
