/**
 * PRICE HISTORY + DRIFT — dated market history behind every verdict, and a
 * flag on open orders when a price their should-cost depends on has moved.
 *
 * Pure. Snapshots hold LIVE values only (null when a feed was on standby), so
 * a gap is a gap, never a placeholder. Drift needs a real baseline at least
 * `minAgeHours` old; until the history is that deep, it says so.
 */
import { modelFor, type ModelId } from "./should-cost.ts";

export type Driver = "ndpr" | "dy" | "cu" | "al" | "usdEur";

export type Snapshot = {
  takenAt: string; // ISO
  ndpr: number | null;
  dy: number | null;
  cu: number | null;
  al: number | null;
  usdEur: number | null;
};

export const DRIVER_LABEL: Record<Driver, string> = {
  ndpr: "NdPr index (USD/kg)",
  dy: "Dy index (USD/kg)",
  cu: "LME copper cash (USD/t)",
  al: "LME aluminium cash (USD/t)",
  usdEur: "USD → EUR",
};

/** Which prices move each should-cost model. */
export const MODEL_DRIVERS: Record<ModelId, Driver[]> = {
  ndfeb: ["ndpr", "dy"],
  "ndpr-alloy": ["ndpr"],
  "dy-metal": ["dy"],
  "copper-ctc": ["cu"],
};

export type DriverMove = {
  driver: Driver;
  from: number;
  fromAt: string;
  to: number;
  toAt: string;
  changePct: number;
};

/**
 * Change of one driver from the oldest value at least `minAgeHours` before the
 * latest value, within `windowDays`. Null when there is no such baseline.
 */
export function driverMove(series: Snapshot[], driver: Driver, opts: { windowDays?: number; minAgeHours?: number } = {}): DriverMove | null {
  const windowMs = (opts.windowDays ?? 30) * 86_400_000;
  const minAgeMs = (opts.minAgeHours ?? 24) * 3_600_000;
  const pts = series
    .filter((s) => typeof s[driver] === "number" && Number.isFinite(s[driver] as number) && (s[driver] as number) > 0)
    .map((s) => ({ t: Date.parse(s.takenAt), v: s[driver] as number, at: s.takenAt }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const base = pts.find((p) => p.t >= last.t - windowMs && last.t - p.t >= minAgeMs);
  if (!base) return null;
  return {
    driver,
    from: base.v,
    fromAt: base.at,
    to: last.v,
    toAt: last.at,
    changePct: Math.round(((last.v - base.v) / base.v) * 1000) / 10,
  };
}

export type OpenOrder = { id: string; po: string; title: string; commodity: string };

export type DriftAlert = {
  order: OpenOrder;
  moves: DriverMove[];
  /** Largest absolute move among the order's drivers. */
  worstPct: number;
};

export type DriftReport = {
  thresholdPct: number;
  historyFrom: string | null;
  historyTo: string | null;
  snapshots: number;
  /** False until at least one driver has a baseline old enough to compare. */
  enoughHistory: boolean;
  alerts: DriftAlert[];
  moves: DriverMove[];
};

export function driftReport(series: Snapshot[], orders: OpenOrder[], opts: { thresholdPct?: number; windowDays?: number; minAgeHours?: number } = {}): DriftReport {
  const thresholdPct = opts.thresholdPct ?? 10;
  const drivers: Driver[] = ["ndpr", "dy", "cu", "al", "usdEur"];
  const moves = drivers.map((d) => driverMove(series, d, opts)).filter((m): m is DriverMove => m !== null);
  const byDriver = new Map(moves.map((m) => [m.driver, m]));
  const alerts: DriftAlert[] = [];
  for (const order of orders) {
    const model = modelFor(order.commodity);
    if (!model) continue;
    const relevant = MODEL_DRIVERS[model].map((d) => byDriver.get(d)).filter((m): m is DriverMove => !!m);
    const over = relevant.filter((m) => Math.abs(m.changePct) >= thresholdPct);
    if (over.length) {
      alerts.push({ order, moves: over, worstPct: Math.max(...over.map((m) => Math.abs(m.changePct))) });
    }
  }
  alerts.sort((a, b) => b.worstPct - a.worstPct);
  const times = series.map((s) => s.takenAt).sort();
  return {
    thresholdPct,
    historyFrom: times[0] ?? null,
    historyTo: times[times.length - 1] ?? null,
    snapshots: series.length,
    enoughHistory: moves.length > 0,
    alerts,
    moves,
  };
}

/** Should a new snapshot be written? At most one per `minMinutes`. */
export function snapshotDue(lastTakenAt: string | null, now: Date, minMinutes = 15): boolean {
  if (!lastTakenAt) return true;
  const last = Date.parse(lastTakenAt);
  return !Number.isFinite(last) || now.getTime() - last >= minMinutes * 60_000;
}
