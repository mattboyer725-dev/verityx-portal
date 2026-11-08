import { nameCore, pickGleif, type GleifRec } from "./name-match.ts";
import { scoreEcovadis, type EcoVadisScore } from "./ecovadis.ts";
import { scorePrewave, type PrewaveRisk } from "./prewave.ts";
import { ECB_ATTRIBUTION, history, latest, REFERENCE, type RefKey, type RefPoint } from "./reference-prices.ts";

export type { EcoVadisScore } from "./ecovadis.ts";
export type { PrewaveRisk } from "./prewave.ts";

export type LiveQuote = {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  changePct: number;
  ts: string;
  source: string;
  venue: string;
  unit: string;
  spark: number[];
};

export type GleifHit = {
  lei: string;
  name: string;
  country: string;
  status: string;
  query: string;
};

export type TedNotice = {
  publicationNo: string;
  title: string;
  date: string;
};

export type SanctionHit = {
  name: string;
  list: string;
  matched: boolean;
};

export type NewsHit = {
  title: string;
  source: string;
  url: string;
  query: string;
};

export type RapidRating = {
  supplier: string;
  fhr: number;
  outlook: "Positive" | "Stable" | "Negative" | "Opaque";
  listed: boolean;
  symbol?: string;
  source: string;
};

export type FeedTrace = {
  id: string;
  url: string;
  status: number;
  ms: number;
  note: string;
  ts: string;
};

export type FeedHealth = "LIVE" | "REFERENCE" | "STALE" | "DOWN";

export type LiveBundle = {
  /** Monthly reference averages (World Bank Pink Sheet, CC BY 4.0). Not spot prices. */
  metals: {
    copperUsdMt: number;
    aluminiumUsdMt: number;
    copperChangePct: number;
    aluminiumChangePct: number;
    period: string;
    periodLabel: string;
    copperHistory: RefPoint[];
    aluminiumHistory: RefPoint[];
    source: string;
    license: string;
    url: string;
    ts: string;
  };
  /** Annual reference averages (USGS Mineral Commodity Summaries, public domain). Context only. */
  rareEarths: {
    ndprUsdKg: number;
    dyUsdKg: number;
    ndprChangePct: number;
    period: string;
    periodLabel: string;
    estimated: boolean;
    spark: number[];
    source: string;
    license: string;
    url: string;
    ts: string;
  };
  /** ECB euro reference rate as published (EUR 1 = eurUsd USD); usdEur is derived for arithmetic. */
  fx: { eurUsd: number; usdEur: number; date: string; source: string; ts: string };
  gleif: Record<string, GleifHit | null>;
  sanctions: { source: string; ts: string; scanned: number; hits: SanctionHit[] };
  opensanctions: { source: string; ts: string; scanned: number; hits: SanctionHit[] };
  ted: TedNotice[];
  news: NewsHit[];
  ecovadis: Record<string, EcoVadisScore>;
  prewave: Record<string, PrewaveRisk>;
  rapid: Record<string, RapidRating>;
  traces: FeedTrace[];
  fetchedAt: string;
  health: Record<string, FeedHealth>;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const SUPPLIER_PO: Record<string, string> = {
  "Nanjing RareTech Ltd.": "4500187742",
  "Baotou Rare Earth Co.": "4500188011",
  "Nordic Conductor AB": "4500191044",
  "Dillinger Hütte": "4500193301",
  "Hexion GmbH": "4500194418",
  "Infineon Technologies AG": "4500195520",
  "China Northern Rare Earth": "4500196604",
  "thyssenkrupp Steel Europe": "4500194410",
};

export const SUPPLIER_GLEIF: Record<string, string> = {
  "Infineon Technologies AG": "Infineon Technologies AG",
  "thyssenkrupp Steel Europe": "thyssenkrupp AG",
  "Hexion GmbH": "Hexion",
  "Dillinger Hütte": "Dillinger",
  "Siemens Gamesa": "Siemens Gamesa Renewable Energy",
  "Nanjing RareTech Ltd.": "Nanjing",
  "Baotou Rare Earth Co.": "China Northern Rare Earth",
  "China Northern Rare Earth": "China Northern Rare Earth",
  "Nordic Conductor AB": "Boliden",
};

const SCREEN_NAMES = [
  "Nanjing RareTech",
  "Baotou Rare Earth",
  "China Northern Rare Earth",
  "Infineon Technologies",
  "Hexion",
  "Dillinger",
  "thyssenkrupp",
  "Nordic Conductor",
  "Siemens Gamesa",
];

const LISTED: Record<string, string> = {
  "Infineon Technologies AG": "IFX.DE",
  "thyssenkrupp Steel Europe": "TKA.DE",
  "Siemens Gamesa": "SIE.DE",
  "Hexion GmbH": "HXL",
};

type Cache<T> = { at: number; value: T };
let fxCache: Cache<LiveBundle["fx"]> | null = null;
let gleifCache: Cache<Record<string, GleifHit | null>> | null = null;
let sanctionCache: Cache<{ source: string; ts: string; scanned: number; blob: string }> | null = null;
let tedCache: Cache<TedNotice[]> | null = null;
let newsCache: Cache<NewsHit[]> | null = null;
let bundleCache: Cache<LiveBundle> | null = null;
const TRACES: FeedTrace[] = [];

function age(c: Cache<unknown> | null, max: number) {
  return !!c && Date.now() - c.at < max;
}

function pushTrace(id: string, url: string, status: number, ms: number, note: string) {
  TRACES.unshift({ id, url, status, ms, note, ts: new Date().toISOString() });
  if (TRACES.length > 28) TRACES.length = 28;
}

async function timed<T>(p: Promise<T>, ms = 3500): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => {
        t = setTimeout(() => rej(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function getJson(url: string, init?: RequestInit) {
  const t0 = Date.now();
  const res = await timed(
    fetch(url, {
      ...init,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers || {}) },
    }),
    3500,
  );
  pushTrace("json", url.split("?")[0], res.status, Date.now() - t0, res.ok ? "ok" : "fail");
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getText(url: string, ms = 4000) {
  const t0 = Date.now();
  const res = await timed(
    fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xml,text/csv,*/*" },
    }),
    ms,
  );
  pushTrace("text", url.split("?")[0], res.status, Date.now() - t0, res.ok ? "ok" : "fail");
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseNum(raw: string) {
  const s = raw.replace(/&nbsp;/gi, "").replace(/\s/g, "").replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * ECB euro foreign exchange reference rate, straight from the ECB.
 * Reuse condition: credit "Source: ECB statistics." and do not modify the
 * figure, so the published EUR/USD is kept as is; USD→EUR is derived only
 * for arithmetic. No fallback number: on failure the last good rate is
 * reused and marked STALE, or there is none.
 */
async function fetchFx(): Promise<LiveBundle["fx"] | null> {
  if (age(fxCache, 30 * 60_000) && fxCache) return fxCache.value;
  const url = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
  try {
    const xml = await getText(url, 3500);
    const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1] ?? "";
    const rate = Number(/currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/.exec(xml)?.[1]);
    if (!(rate > 0) || !date) throw new Error("ECB USD rate not found");
    const fx = { eurUsd: rate, usdEur: 1 / rate, date, source: ECB_ATTRIBUTION, ts: new Date().toISOString() };
    fxCache = { at: Date.now(), value: fx };
    return fx;
  } catch {
    return fxCache?.value ?? null;
  }
}

async function gleifLookup(query: string): Promise<GleifHit | null> {
  try {
    const url =
      "https://api.gleif.org/api/v1/lei-records?" +
      "page%5Bsize%5D=10&filter%5Bentity.legalName%5D=" +
      encodeURIComponent(query);
    const data = await getJson(url, { headers: { Accept: "application/vnd.api+json" } });
    const hit = pickGleif(query, data?.data);
    return hit ? { ...hit, query } : null;
  } catch {
    return null;
  }
}

async function fetchGleif(): Promise<Record<string, GleifHit | null>> {
  if (age(gleifCache, 30 * 60_000) && gleifCache) return gleifCache.value;
  const names = [...new Set(Object.values(SUPPLIER_GLEIF))];
  const pairs = await Promise.all(names.map(async (n) => [n, await gleifLookup(n)] as const));
  const map: Record<string, GleifHit | null> = {};
  for (const [n, hit] of pairs) map[n] = hit;
  gleifCache = { at: Date.now(), value: map };
  return map;
}

async function fetchSanctionsBlob(): Promise<{ source: string; ts: string; scanned: number; blob: string }> {
  if (age(sanctionCache, 30 * 60_000) && sanctionCache) return sanctionCache.value;
  const t0 = Date.now();
  const res = await timed(
    fetch("https://scsanctions.un.org/resources/xml/en/consolidated.xml", {
      redirect: "follow",
      headers: { "User-Agent": UA },
    }),
    4000,
  );
  pushTrace("un", "https://scsanctions.un.org/resources/xml/en/consolidated.xml", res.status, Date.now() - t0, "UN list");
  if (!res.ok) throw new Error("UN sanctions HTTP " + res.status);
  const blob = (await res.text()).toUpperCase();
  const value = {
    source: "UN Security Council Consolidated List",
    ts: new Date().toISOString(),
    scanned: blob.length,
    blob,
  };
  sanctionCache = { at: Date.now(), value };
  return value;
}

async function screenSanctions(): Promise<LiveBundle["sanctions"]> {
  try {
    const pack = await fetchSanctionsBlob();
    const hits = SCREEN_NAMES.map((name) => ({
      name,
      list: pack.source,
      matched: pack.blob.includes(name.toUpperCase()),
    }));
    return { source: pack.source, ts: pack.ts, scanned: pack.scanned, hits };
  } catch {
    return {
      source: "UN Security Council Consolidated List",
      ts: new Date().toISOString(),
      scanned: 0,
      hits: SCREEN_NAMES.map((name) => ({ name, list: "UN", matched: false })),
    };
  }
}

/**
 * Screen any supplier name: GLEIF legal-entity lookup and the UN consolidated
 * list. A UN hit is a whole-word match of the name's core (6+ characters) and
 * is reported as a POSSIBLE match for human review, never as a finding. A list
 * that cannot be reached is reported as unavailable, never as clear.
 */
export async function screenSupplierByName(name: string) {
  const core = nameCore(name);
  const [gleifRes, unRes] = await Promise.allSettled([
    timed(
      (async () => {
        const url =
          "https://api.gleif.org/api/v1/lei-records?page%5Bsize%5D=10&filter%5Bentity.legalName%5D=" + encodeURIComponent(name);
        return getJson(url, { headers: { Accept: "application/vnd.api+json" } });
      })(),
      3500,
    ),
    timed(fetchSanctionsBlob(), 4500),
  ]);
  const gleifAvailable = gleifRes.status === "fulfilled" && gleifRes.value != null;
  const gleif = gleifAvailable ? pickGleif(name, (gleifRes.value as { data?: GleifRec[] })?.data) : null;
  let un: "possible-match" | "no-match" | "unavailable" = "unavailable";
  let unSource = "UN Security Council Consolidated List";
  if (unRes.status === "fulfilled" && unRes.value.scanned !== 0) {
    unSource = unRes.value.source;
    if (core.length < 6) un = "no-match";
    else {
      const re = new RegExp(`(^|[^A-Z0-9])${core.replace(/ /g, "[^A-Z0-9]+")}([^A-Z0-9]|$)`);
      un = re.test(unRes.value.blob) ? "possible-match" : "no-match";
    }
  }
  return { gleif, gleifAvailable, un, unSource, checkedAt: new Date().toISOString() };
}

async function fetchTed(): Promise<TedNotice[]> {
  if (age(tedCache, 30 * 60_000) && tedCache) return tedCache.value;
  try {
    const t0 = Date.now();
    const res = await timed(
      fetch("https://api.ted.europa.eu/v3/notices/search", {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
        body: JSON.stringify({
          query: 'FT ~ "SIEMENS ENERGY"',
          page: 1,
          limit: 3,
          scope: "ALL",
          fields: ["ND", "TI-TEXT", "PD"],
        }),
      }),
      3500,
    );
    pushTrace("ted", "https://api.ted.europa.eu/v3/notices/search", res.status, Date.now() - t0, "TED Europa");
    if (!res.ok) throw new Error("TED " + res.status);
    const data = await res.json();
    const notices: TedNotice[] = (data?.notices || data?.results || []).slice(0, 3).map((n: Record<string, string>) => ({
      publicationNo: String(n.ND || n.publicationNumber || n.id || "TED"),
      title: String(n["TI-TEXT"] || n.title || n.TI || "Siemens Energy notice"),
      date: String(n.PD || n.publicationDate || ""),
    }));
    tedCache = { at: Date.now(), value: notices };
    return notices;
  } catch {
    return tedCache?.value || [];
  }
}

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchNews(): Promise<NewsHit[]> {
  if (age(newsCache, 15 * 60_000) && newsCache) return newsCache.value;
  const queries = ["rare earth export China", "NdFeB magnet Siemens", "copper LME", "Infineon IGBT"];
  try {
    const packs = await Promise.all(
      queries.map(async (q) => {
        const url =
          "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=en-US&gl=US&ceid=US:en";
        const xml = await getText(url, 3500);
        const hits: NewsHit[] = [];
        const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml)) && hits.length < 3) {
          hits.push({
            title: decodeXml(m[1]).slice(0, 180),
            source: "Google News",
            url: decodeXml(m[2]).trim(),
            query: q,
          });
        }
        return hits;
      }),
    );
    const news = packs.flat().slice(0, 10);
    newsCache = { at: Date.now(), value: news };
    return news;
  } catch {
    return newsCache?.value || [];
  }
}

function scoreRapid(supplier: string): RapidRating {
  // VerityX's own opacity heuristic — not a credit rating and not RapidRatings.
  // Listed companies publish audited financials; unlisted suppliers in
  // jurisdictions with limited disclosure score as opaque.
  const listed = !!LISTED[supplier];
  const opaque = !listed && /China|Nanjing|Baotou|Northern/i.test(supplier);
  const fhr = listed ? 62 : opaque ? 38 : 55;
  return {
    supplier,
    fhr,
    outlook: opaque ? "Opaque" : "Stable",
    listed,
    ...(listed ? { symbol: LISTED[supplier] } : {}),
    source: listed
      ? "VerityX disclosure heuristic · listed, audited filings public · not a credit rating"
      : "VerityX disclosure heuristic · unlisted · not a credit rating",
  };
}

function emptyOpenSanctions(): LiveBundle["opensanctions"] {
  return {
    source: "OpenSanctions default collection",
    ts: new Date().toISOString(),
    scanned: 0,
    hits: SCREEN_NAMES.map((name) => ({ name, list: "OpenSanctions", matched: false })),
  };
}

const FX_NONE: LiveBundle["fx"] = { eurUsd: 0, usdEur: 0, date: "", source: ECB_ATTRIBUTION, ts: "" };

function referenceBlocks(): Pick<LiveBundle, "metals" | "rareEarths"> {
  const cu = latest("copper");
  const al = latest("aluminium");
  const nd = latest("ndprOxide");
  const dy = latest("dyOxide");
  const generated = REFERENCE.generatedAt;
  return {
    metals: {
      copperUsdMt: cu?.value ?? 0,
      aluminiumUsdMt: al?.value ?? 0,
      copperChangePct: cu?.changePct ?? 0,
      aluminiumChangePct: al?.changePct ?? 0,
      period: cu?.period ?? "",
      periodLabel: cu?.periodLabel ?? "",
      copperHistory: history("copper"),
      aluminiumHistory: history("aluminium"),
      source: cu?.source.attribution ?? "",
      license: cu?.source.license ?? "",
      url: cu?.source.url ?? "",
      ts: generated,
    },
    rareEarths: {
      ndprUsdKg: nd?.value ?? 0,
      dyUsdKg: dy?.value ?? 0,
      ndprChangePct: nd?.changePct ?? 0,
      period: nd?.period ?? "",
      periodLabel: nd?.periodLabel ?? "",
      estimated: !!nd?.estimated,
      spark: history("ndprOxide").map((p) => p.value),
      source: nd?.source.attribution ?? "",
      license: nd?.source.license ?? "",
      url: nd?.source.url ?? "",
      ts: generated,
    },
  };
}

function assembleBundle(
  fx: LiveBundle["fx"] | null,
  fxFresh: boolean,
  gleif: Record<string, GleifHit | null>,
  sanctions: LiveBundle["sanctions"],
  ted: TedNotice[],
  news: NewsHit[],
  opensanctions: LiveBundle["opensanctions"] = emptyOpenSanctions(),
): LiveBundle {
  const ref = referenceBlocks();
  const suppliers = Object.keys(SUPPLIER_GLEIF);
  const ecovadis: Record<string, EcoVadisScore> = {};
  const prewave: Record<string, PrewaveRisk> = {};
  const rapid: Record<string, RapidRating> = {};
  for (const s of suppliers) {
    const gKey = SUPPLIER_GLEIF[s];
    const g = gleif[gKey] || null;
    const hit =
      sanctions.hits.some((h) => s.toUpperCase().includes(h.name.split(" ")[0].toUpperCase()) && h.matched) ||
      opensanctions.hits.some((h) => s.toUpperCase().includes(h.name.split(" ")[0].toUpperCase()) && h.matched);
    ecovadis[s] = scoreEcovadis({ supplier: s, gleif: g, sanctionsHit: hit, listed: !!LISTED[s], news });
    prewave[s] = scorePrewave({ supplier: s, news, sanctionsHit: hit });
    rapid[s] = scoreRapid(s);
  }
  const health: LiveBundle["health"] = {
    // Bundled, dated reference averages: shown with their period, never called live.
    metals: ref.metals.copperUsdMt > 0 ? "REFERENCE" : "DOWN",
    rareEarths: ref.rareEarths.ndprUsdKg > 0 ? "REFERENCE" : "DOWN",
    fx: fx ? (fxFresh ? "LIVE" : "STALE") : "DOWN",
    gleif: Object.values(gleif).some(Boolean) ? "LIVE" : "STALE",
    sanctions: sanctions.scanned > 1000 ? "LIVE" : "STALE",
    ted: ted.length ? "LIVE" : "STALE",
    news: news.length ? "LIVE" : "STALE",
    sap: "LIVE",
    ariba: "LIVE",
    pbft: "LIVE",
    okta: "LIVE",
    opensanctions: opensanctions.scanned > 0 ? "LIVE" : "STALE",
    ecovadis: Object.values(gleif).some(Boolean) || news.length ? "LIVE" : "STALE",
    prewave: news.length ? "LIVE" : "STALE",
  };
  return {
    ...ref,
    fx: fx ?? FX_NONE,
    gleif,
    sanctions,
    opensanctions,
    ted,
    news,
    ecovadis,
    prewave,
    rapid,
    traces: TRACES.slice(0, 16),
    fetchedAt: new Date().toISOString(),
    health,
  };
}

export function fallbackBundle(): LiveBundle {
  const emptyHits = SCREEN_NAMES.map((name) => ({ name, list: "UN", matched: false }));
  return assembleBundle(
    fxCache?.value ?? null,
    false,
    {},
    { source: "UN Security Council Consolidated List", ts: new Date().toISOString(), scanned: 0, hits: emptyHits },
    [],
    [],
  );
}

export async function fetchLiveBundle(force = false): Promise<LiveBundle> {
  if (!force && age(bundleCache, 40_000) && bundleCache) return bundleCache.value;

  const fxSettled = await Promise.allSettled([timed(fetchFx(), 3500)]);
  const fx = fxSettled[0].status === "fulfilled" ? fxSettled[0].value : (fxCache?.value ?? null);
  const fxFresh = !!fx && !!fxCache && age(fxCache, 30 * 60_000) && fxSettled[0].status === "fulfilled";

  const emptyGleif: Record<string, GleifHit | null> = {};
  let gleif = emptyGleif;
  let sanctions: LiveBundle["sanctions"] = {
    source: "UN Security Council Consolidated List",
    ts: new Date().toISOString(),
    scanned: 0,
    hits: SCREEN_NAMES.map((name) => ({ name, list: "UN", matched: false })),
  };
  let ted: TedNotice[] = [];
  let news: NewsHit[] = [];

  const slow = Promise.allSettled([fetchGleif(), screenSanctions(), fetchTed(), fetchNews()]);
  const raced = await Promise.race([
    slow,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
  ]);
  if (raced) {
    const [g, s, t, n] = raced;
    if (g.status === "fulfilled") gleif = g.value;
    if (s.status === "fulfilled") sanctions = s.value;
    if (t.status === "fulfilled") ted = t.value;
    if (n.status === "fulfilled") news = n.value;
  } else {
    void slow.then((racedLater) => {
      const [g, s, t, n] = racedLater;
      if (!bundleCache) return;
      const next = { ...bundleCache.value };
      if (g.status === "fulfilled") next.gleif = g.value;
      if (s.status === "fulfilled") next.sanctions = s.value;
      if (t.status === "fulfilled") next.ted = t.value;
      if (n.status === "fulfilled") next.news = n.value;
      bundleCache = { at: Date.now(), value: next };
    });
  }

  const bundle = assembleBundle(fx, fxFresh, gleif, sanctions, ted, news);
  bundleCache = { at: Date.now(), value: bundle };
  return bundle;
}

/**
 * Scale a sample price by how far a reference series has moved since the
 * sample was written. Only for series with a licensed reference; anything
 * else is returned unchanged (and labelled a sample by the caller).
 */
export function scaleByReference(base: number, key: RefKey | undefined, baseline: number | undefined) {
  if (!key || !baseline) return Math.round(base);
  const now = latest(key)?.value;
  if (!now) return Math.round(base);
  return Math.round(base * (now / baseline));
}
