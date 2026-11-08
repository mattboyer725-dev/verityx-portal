import { getSql } from "@/lib/db";
import type { LiveBundle } from "@/lib/feeds";
import { newId } from "@/lib/verityx/format";
import { driftReport, snapshotDue, type OpenOrder, type Snapshot } from "@/lib/price-history";

const shown = (b: LiveBundle, k: string) => b.health?.[k] === "LIVE" || b.health?.[k] === "REFERENCE";

/** Write one snapshot of licensed prices (reference averages + same-day ECB FX) if the last is 15+ minutes old. Never throws. */
export async function recordSnapshotIfDue(b: LiveBundle): Promise<boolean> {
  try {
    const row = {
      ndpr: shown(b, "rareEarths") ? b.rareEarths?.ndprUsdKg || null : null,
      dy: shown(b, "rareEarths") ? b.rareEarths?.dyUsdKg || null : null,
      cu: shown(b, "metals") ? b.metals?.copperUsdMt || null : null,
      al: shown(b, "metals") ? b.metals?.aluminiumUsdMt || null : null,
      usdEur: b.health?.fx === "LIVE" ? b.fx?.usdEur || null : null,
    };
    if (Object.values(row).every((v) => v == null)) return false; // nothing live: store nothing
    const sql = await getSql();
    const last = await sql<{ t: string | null }>`select max(taken_at)::text as t from price_snapshots`;
    if (!snapshotDue(last[0]?.t ? new Date(last[0].t).toISOString() : null, new Date())) return false;
    const sources = [
      row.ndpr != null ? `USGS MCS ${b.rareEarths.periodLabel}` : null,
      row.cu != null ? `World Bank Pink Sheet ${b.metals.periodLabel}` : null,
      row.usdEur != null ? `ECB ${b.fx.date}` : null,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500);
    await sql`
      insert into price_snapshots (id, ndpr, dy, cu, al, usd_eur, sources)
      values (${newId()}, ${row.ndpr}, ${row.dy}, ${row.cu}, ${row.al}, ${row.usdEur}, ${sources})
    `;
    return true;
  } catch {
    return false;
  }
}

export async function loadHistory(days = 30): Promise<Snapshot[]> {
  const sql = await getSql();
  const rows = await sql<{ taken_at: string; ndpr: number | null; dy: number | null; cu: number | null; al: number | null; usd_eur: number | null }>`
    select taken_at::text as taken_at, ndpr, dy, cu, al, usd_eur
    from price_snapshots
    where taken_at >= now() - make_interval(days => ${Math.max(1, Math.min(365, Math.floor(days)))})
    order by taken_at asc
    limit 5000
  `;
  return rows.map((r) => ({
    takenAt: new Date(r.taken_at).toISOString(),
    ndpr: r.ndpr,
    dy: r.dy,
    cu: r.cu,
    al: r.al,
    usdEur: r.usd_eur,
  }));
}

export async function historyAndDrift(orders: OpenOrder[], days = 30) {
  const series = await loadHistory(days);
  return { series, report: driftReport(series, orders, { windowDays: days }) };
}
