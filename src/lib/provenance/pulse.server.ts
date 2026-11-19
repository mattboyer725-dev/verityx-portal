/**
 * The home page's data strip. Every figure is real and carries its source and date:
 * - NdPr / Dy oxide: USGS annual reference averages bundled with the app (dated, estimated flag kept)
 * - EUR/USD: ECB reference rate fetched live (cached 30 min; STALE when only an old rate is available)
 * - Ledger: entry count and chain check from the VerityX ledger
 * - Passports: how many lots are sealed and by how many supplier organizations (aggregate only)
 */
import { fetchFx, referenceBlocks } from "@/lib/feeds";
import { merkleSnapshot, verifyChain } from "@/lib/core-ledger";

export type Pulse = {
  ndpr: { usdKg: number; dyUsdKg: number; period: string; estimated: boolean; source: string } | null;
  fx: { eurUsd: number; date: string; source: string } | null;
  ledger: { entries: number; intact: boolean } | null;
  passports: { sealed: number; suppliers: number } | null;
  fetchedAt: string;
};

function budget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function ledger() {
  try {
    const { refreshLedger } = await import("@/lib/core-store.server");
    await Promise.race([refreshLedger(), new Promise<void>((r) => setTimeout(r, 2500))]);
  } catch {
    /* report what is loaded */
  }
  const [snap, chain] = await Promise.all([merkleSnapshot(), verifyChain()]);
  return { entries: snap.leaf_count, intact: !!chain.ok };
}

async function passports() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql`
    select count(*)::int as sealed, count(distinct organization_id)::int as suppliers
    from lot_passports where status = 'sealed'`;
  const r = rows[0] as { sealed: number; suppliers: number } | undefined;
  return { sealed: r?.sealed ?? 0, suppliers: r?.suppliers ?? 0 };
}

let cache: { at: number; value: Pulse } | null = null;

export async function getPulse(): Promise<Pulse> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const ref = referenceBlocks().rareEarths;
  const [fx, led, pass] = await Promise.all([budget(fetchFx(), 3500), budget(ledger(), 3500), budget(passports(), 3000)]);
  const value: Pulse = {
    ndpr:
      ref.ndprUsdKg > 0
        ? { usdKg: ref.ndprUsdKg, dyUsdKg: ref.dyUsdKg, period: ref.periodLabel || ref.period, estimated: ref.estimated, source: ref.source }
        : null,
    fx: fx ? { eurUsd: fx.eurUsd, date: fx.date, source: fx.source } : null,
    ledger: led,
    passports: pass,
    fetchedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), value };
  return value;
}
