/**
 * REFERENCE PRICES — licensed public sources only, bundled with the build.
 *
 *   copper, aluminium    World Bank Commodity Price Data (The Pink Sheet),
 *                        monthly averages, CC BY 4.0.
 *   ndprOxide, dyOxide   USGS Mineral Commodity Summaries, annual averages,
 *                        public domain (latest year is a USGS estimate).
 *
 * src/data/reference-prices.json is written only by
 * scripts/refresh_reference_prices.py (monthly GitHub Action). These are
 * averages, not spot quotes, and every display carries its period and
 * attribution. Nothing here is fetched at request time, so nothing here can
 * silently fall back to an invented number.
 *
 * Browser-safe and dependency-free so the client and node --test can load it.
 */
import data from "../data/reference-prices.json" with { type: "json" };

export type RefKey = "copper" | "aluminium" | "ndprOxide" | "dyOxide";
export type RefPoint = { period: string; value: number; estimated?: boolean };
export type RefSource = {
  name: string;
  url: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  dataUrl?: string;
};
export type RefSeries = {
  label: string;
  unit: string;
  frequency: "monthly" | "annual";
  points: RefPoint[];
  source: RefSource;
};
export type ReferenceDoc = { generatedAt: string; note: string; series: Record<RefKey, RefSeries> };

export const REFERENCE = data as unknown as ReferenceDoc;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" → "Oct 2026 avg"; "2025" (+estimated) → "2025 avg (est.)". */
export function periodLabel(p: RefPoint, frequency: RefSeries["frequency"]): string {
  if (frequency === "monthly") {
    const [y, m] = p.period.split("-");
    return `${MONTHS[Number(m) - 1] ?? m} ${y} avg`;
  }
  return `${p.period} avg${p.estimated ? " (est.)" : ""}`;
}

export type RefLatest = {
  key: RefKey;
  value: number;
  unit: string;
  period: string;
  periodLabel: string;
  estimated: boolean;
  frequency: RefSeries["frequency"];
  /** Change against the previous period, in %. */
  changePct: number;
  source: RefSource;
};

export function latest(key: RefKey, doc: ReferenceDoc = REFERENCE): RefLatest | null {
  const s = doc.series[key];
  const pts = s?.points ?? [];
  const last = pts[pts.length - 1];
  if (!last || !(last.value > 0)) return null;
  const prev = pts[pts.length - 2];
  const changePct = prev && prev.value > 0 ? Math.round(((last.value - prev.value) / prev.value) * 10000) / 100 : 0;
  return {
    key,
    value: last.value,
    unit: s.unit,
    period: last.period,
    periodLabel: periodLabel(last, s.frequency),
    estimated: !!last.estimated,
    frequency: s.frequency,
    changePct,
    source: s.source,
  };
}

export function history(key: RefKey, n = 24, doc: ReferenceDoc = REFERENCE): RefPoint[] {
  return (doc.series[key]?.points ?? []).slice(-n);
}

/** Every source the product shows, de-duplicated, for the /sources page and exports. */
export function referenceSources(doc: ReferenceDoc = REFERENCE) {
  const seen = new Map<string, RefSource & { series: string[] }>();
  for (const [k, s] of Object.entries(doc.series)) {
    const prev = seen.get(s.source.name);
    if (prev) prev.series.push(`${s.label} (${k})`);
    else seen.set(s.source.name, { ...s.source, series: [`${s.label} (${k})`] });
  }
  return [...seen.values()];
}

/** ECB reuse condition: credit exactly this line and do not modify the figures. */
export const ECB_ATTRIBUTION = "Source: ECB statistics.";
export const ECB_URL = "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html";
