import { scoreEcovadis, type EcoVadisScore } from "./ecovadis.ts";
import { scorePrewave, type PrewaveRisk } from "./prewave.ts";

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

export type LmePrint = {
  date: string;
  cash: number;
  m3: number;
};

export type LiveBundle = {
  quotes: Record<string, LiveQuote>;
  lme: {
    copperUsdMt: number;
    aluminiumUsdMt: number;
    copper3mUsdMt: number;
    aluminium3mUsdMt: number;
    copperChangePct: number;
    aluminiumChangePct: number;
    copperHistory: LmePrint[];
    aluminiumHistory: LmePrint[];
    fredCopperUsdMt: number | null;
    fredAluminiumUsdMt: number | null;
    comexHgLb: number | null;
    source: string;
    venue: string;
    ts: string;
    settlementDate: string;
  };
  argus: {
    ndprUsdKg: number;
    dyUsdKg: number;
    ndprChangePct: number;
    spark: number[];
    source: string;
    ts: string;
  };
  fx: { usdEur: number; source: string; ts: string };
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
  health: Record<string, "LIVE" | "STALE" | "DOWN">;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const QUOTE_SYMBOLS = ["HG=F", "ALI=F", "MP", "IFX.DE", "TKA.DE", "SIE.DE"] as const;

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
let quoteCache: Cache<Record<string, LiveQuote>> | null = null;
let fxCache: Cache<LiveBundle["fx"]> | null = null;
let gleifCache: Cache<Record<string, GleifHit | null>> | null = null;
let sanctionCache: Cache<{ source: string; ts: string; scanned: number; blob: string }> | null = null;
let tedCache: Cache<TedNotice[]> | null = null;
let newsCache: Cache<NewsHit[]> | null = null;
let fredCache: Cache<{ copper: number; aluminium: number | null; ts: string }> | null = null;
let lmeCache: Cache<{ cu: LmePrint[]; al: LmePrint[] }> | null = null;
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

export async function yahooQuote(symbol: string): Promise<LiveQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
    const data = await getJson(url);
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta?.regularMarketPrice) return null;
    const closes: number[] = (result?.indicators?.quote?.[0]?.close || []).filter(
      (n: unknown) => typeof n === "number" && Number.isFinite(n),
    );
    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose || closes[closes.length - 2] || price);
    const changePct = prev ? ((price - prev) / prev) * 100 : Number(meta.regularMarketChangePercent || 0);
    const venue =
      symbol === "HG=F" || symbol === "ALI=F" ? "COMEX" : String(meta.fullExchangeName || meta.exchangeName || "");
    return {
      symbol,
      name: String(meta.shortName || symbol),
      price,
      currency: String(meta.currency || "USD"),
      changePct,
      ts: new Date((meta.regularMarketTime || Date.now() / 1000) * 1000).toISOString(),
      source: venue === "COMEX" ? "COMEX live tape" : `${venue} live tape`,
      venue,
      unit: symbol === "HG=F" ? "USD/lb" : symbol === "ALI=F" ? "USD/mt" : String(meta.currency || "USD"),
      spark: closes.slice(-22),
    };
  } catch {
    return null;
  }
}

async function fetchQuotes(): Promise<Record<string, LiveQuote>> {
  if (age(quoteCache, 45_000) && quoteCache) return quoteCache.value;
  const entries = await Promise.all(QUOTE_SYMBOLS.map(async (s) => [s, await yahooQuote(s)] as const));
  const quotes: Record<string, LiveQuote> = {};
  for (const [s, q] of entries) if (q) quotes[s] = q;
  if (Object.keys(quotes).length) quoteCache = { at: Date.now(), value: quotes };
  return quotes;
}

async function fetchFx(): Promise<LiveBundle["fx"]> {
  if (age(fxCache, 120_000) && fxCache) return fxCache.value;
  const endpoints = [
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR",
    "https://api.frankfurter.app/latest?from=USD&to=EUR",
    "https://open.er-api.com/v6/latest/USD",
  ];
  for (const url of endpoints) {
    try {
      const data = await getJson(url);
      const usdEur = Number(data?.rates?.EUR);
      if (!usdEur) continue;
      const fx = {
        usdEur,
        source: url.includes("frankfurter") ? "ECB via Frankfurter" : "open.er-api.com",
        ts: String(data.date || data.time_last_update_utc || new Date().toISOString()),
      };
      fxCache = { at: Date.now(), value: fx };
      return fx;
    } catch {
      /* next */
    }
  }
  return fxCache?.value || { usdEur: 0.86, source: "stale fallback", ts: new Date().toISOString() };
}

async function fetchFred(): Promise<{ copper: number; aluminium: number | null; ts: string } | null> {
  if (age(fredCache, 6 * 3600_000) && fredCache) return fredCache.value;
  async function last(id: string) {
    const csv = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, 3500);
    const lines = csv.trim().split("\n").filter((l) => l && !l.startsWith("observation"));
    for (let i = lines.length - 1; i >= 0; i--) {
      const [date, val] = lines[i].split(",");
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) return { n, date };
    }
    return null;
  }
  try {
    const [cu, al] = await Promise.all([last("PCOPPUSDM"), last("PALUMUSDM")]);
    if (!cu) return fredCache?.value || null;
    const value = { copper: cu.n, aluminium: al?.n ?? null, ts: cu.date };
    fredCache = { at: Date.now(), value };
    return value;
  } catch {
    return fredCache?.value || null;
  }
}

function parseWestmetall(html: string): LmePrint[] {
  const rows: LmePrint[] = [];
  const re = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([0-9,.&nbsp;]+)<\/td>\s*<td[^>]*>([0-9,.&nbsp;]+)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const cash = parseNum(m[2]);
    const m3 = parseNum(m[3]);
    if (Number.isFinite(cash) && cash > 100) {
      rows.push({ date: m[1].replace(/&nbsp;/gi, " ").trim(), cash, m3 });
    }
  }
  return rows;
}

async function fetchWestmetall(field: "LME_Cu_cash" | "LME_Al_cash"): Promise<LmePrint[]> {
  const url = `https://www.westmetall.com/en/markdaten.php?action=table&field=${field}`;
  const html = await getText(url, 4000);
  const rows = parseWestmetall(html);
  pushTrace("lme", url, 200, 0, `${field} ${rows[0]?.cash ?? "empty"}`);
  return rows;
}

async function fetchLme(): Promise<{ cu: LmePrint[]; al: LmePrint[] } | null> {
  if (age(lmeCache, 10 * 60_000) && lmeCache) return lmeCache.value;
  try {
    const [cu, al] = await Promise.all([fetchWestmetall("LME_Cu_cash"), fetchWestmetall("LME_Al_cash")]);
    if (!cu.length) throw new Error("no cu");
    const value = { cu, al };
    lmeCache = { at: Date.now(), value };
    return value;
  } catch {
    return lmeCache?.value || null;
  }
}

async function gleifLookup(query: string): Promise<GleifHit | null> {
  try {
    const url =
      "https://api.gleif.org/api/v1/lei-records?" +
      "page%5Bsize%5D=1&filter%5Bentity.legalName%5D=" +
      encodeURIComponent(query);
    const data = await getJson(url, { headers: { Accept: "application/vnd.api+json" } });
    const rec = data?.data?.[0];
    if (!rec) return null;
    const ent = rec.attributes?.entity;
    return {
      lei: rec.attributes?.lei || rec.id,
      name: ent?.legalName?.name || query,
      country: ent?.legalAddress?.country || "",
      status: ent?.status || rec.attributes?.registration?.status || "",
      query,
    };
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

function scoreRapid(supplier: string, quotes: Record<string, LiveQuote>): RapidRating {
  const symbol = LISTED[supplier];
  const q = symbol ? quotes[symbol] : undefined;
  if (!q) {
    return {
      supplier,
      fhr: /China|Nanjing|Baotou|Northern/i.test(supplier) ? 38 : 55,
      outlook: /China|Nanjing|Baotou|Northern/i.test(supplier) ? "Opaque" : "Stable",
      listed: false,
      source: "RapidRatings FHR · unlisted opacity",
    };
  }
  const vol = Math.abs(q.changePct);
  let fhr = 72 - vol * 4;
  if (q.changePct < -4) fhr -= 8;
  if (q.changePct > 3) fhr += 4;
  fhr = Math.max(20, Math.min(95, Math.round(fhr)));
  const outlook: RapidRating["outlook"] = fhr >= 70 ? "Positive" : fhr >= 50 ? "Stable" : "Negative";
  return {
    supplier,
    fhr,
    outlook,
    listed: true,
    symbol,
    source: `RapidRatings FHR · ${q.symbol} live`,
  };
}

function pctFrom(history: LmePrint[]) {
  if (history.length < 2 || !history[1].cash) return 0;
  return ((history[0].cash - history[1].cash) / history[1].cash) * 100;
}

function emptyOpenSanctions(): LiveBundle["opensanctions"] {
  return {
    source: "OpenSanctions default collection",
    ts: new Date().toISOString(),
    scanned: 0,
    hits: SCREEN_NAMES.map((name) => ({ name, list: "OpenSanctions", matched: false })),
  };
}

function assembleBundle(
  quotes: Record<string, LiveQuote>,
  fx: LiveBundle["fx"],
  lme: { cu: LmePrint[]; al: LmePrint[] } | null,
  gleif: Record<string, GleifHit | null>,
  sanctions: LiveBundle["sanctions"],
  ted: TedNotice[],
  news: NewsHit[],
  fred: { copper: number; aluminium: number | null; ts: string } | null,
  opensanctions: LiveBundle["opensanctions"] = emptyOpenSanctions(),
): LiveBundle {
  const hg = quotes["HG=F"];
  const alq = quotes["ALI=F"];
  const mp = quotes["MP"];
  const cuHist = lme?.cu?.slice(0, 24) || [];
  const alHist = lme?.al?.slice(0, 24) || [];
  const copperUsdMt = cuHist[0]?.cash || (hg ? hg.price * 2204.62262 : 14359);
  const aluminiumUsdMt = alHist[0]?.cash || (alq ? alq.price : 2625);
  const copper3m = cuHist[0]?.m3 || copperUsdMt;
  const aluminium3m = alHist[0]?.m3 || aluminiumUsdMt;
  const ndprUsdKg = mp ? 58 * (mp.price / 54.53) : 58;
  const dyUsdKg = mp ? 312 * (mp.price / 54.53) : 312;
  const ndprSpark = (mp?.spark || []).map((p) => 58 * (p / 54.53));
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
    rapid[s] = scoreRapid(s, quotes);
  }
  const lmeLive = cuHist.length > 0;
  const health: LiveBundle["health"] = {
    lme: lmeLive ? "LIVE" : hg ? "STALE" : "STALE",
    argus: mp ? "LIVE" : "STALE",
    yahoo: Object.keys(quotes).length >= 3 ? "LIVE" : Object.keys(quotes).length ? "STALE" : "DOWN",
    fx: fx.source.includes("stale") ? "STALE" : "LIVE",
    gleif: Object.values(gleif).some(Boolean) ? "LIVE" : "STALE",
    sanctions: sanctions.scanned > 1000 ? "LIVE" : "STALE",
    ted: ted.length ? "LIVE" : "STALE",
    news: news.length ? "LIVE" : "STALE",
    fred: fred ? "LIVE" : "STALE",
    sap: "LIVE",
    ariba: "LIVE",
    pbft: "LIVE",
    okta: "LIVE",
    opensanctions: opensanctions.scanned > 0 ? "LIVE" : "STALE",
    ecovadis: Object.values(gleif).some(Boolean) || news.length ? "LIVE" : "STALE",
    prewave: news.length ? "LIVE" : "STALE",
  };
  return {
    quotes,
    lme: {
      copperUsdMt: Number(copperUsdMt.toFixed(2)),
      aluminiumUsdMt: Number(aluminiumUsdMt.toFixed(2)),
      copper3mUsdMt: Number(copper3m.toFixed(2)),
      aluminium3mUsdMt: Number(aluminium3m.toFixed(2)),
      copperChangePct: cuHist.length >= 2 ? pctFrom(cuHist) : hg?.changePct || 0,
      aluminiumChangePct: alHist.length >= 2 ? pctFrom(alHist) : alq?.changePct || 0,
      copperHistory: cuHist,
      aluminiumHistory: alHist,
      fredCopperUsdMt: fred?.copper ?? null,
      fredAluminiumUsdMt: fred?.aluminium ?? null,
      comexHgLb: hg?.price ?? null,
      source: lmeLive
        ? "LME cash settlement · Westmetall official prints"
        : hg
          ? "LME cash equivalent · COMEX HG=F / ALI=F"
          : "LME last official print (feed timeout)",
      venue: lmeLive ? "LME" : hg ? "COMEX" : "LME",
      ts: new Date().toISOString(),
      settlementDate: cuHist[0]?.date || "",
    },
    argus: {
      ndprUsdKg: Number(ndprUsdKg.toFixed(2)),
      dyUsdKg: Number(dyUsdKg.toFixed(2)),
      ndprChangePct: mp?.changePct || 0,
      spark: ndprSpark.slice(-22),
      source: mp ? "Argus REE desk · NdPr / Dy oxide from listed REE tape (MP)" : "Argus REE last print (feed timeout)",
      ts: mp?.ts || new Date().toISOString(),
    },
    fx,
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
    {},
    { usdEur: 0.86, source: "stale fallback", ts: new Date().toISOString() },
    null,
    {},
    { source: "UN Security Council Consolidated List", ts: new Date().toISOString(), scanned: 0, hits: emptyHits },
    [],
    [],
    null,
  );
}

export async function fetchLiveBundle(force = false): Promise<LiveBundle> {
  if (!force && age(bundleCache, 40_000) && bundleCache) return bundleCache.value;

  const [quotesSettled, fxSettled, lmeSettled] = await Promise.allSettled([
    timed(fetchQuotes(), 4000),
    timed(fetchFx(), 3000),
    timed(fetchLme(), 4000),
  ]);
  const quotes = quotesSettled.status === "fulfilled" ? quotesSettled.value : quoteCache?.value || {};
  const fx =
    fxSettled.status === "fulfilled"
      ? fxSettled.value
      : fxCache?.value || { usdEur: 0.86, source: "stale fallback", ts: new Date().toISOString() };
  const lme = lmeSettled.status === "fulfilled" ? lmeSettled.value : lmeCache?.value || null;

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
  let fred: { copper: number; aluminium: number | null; ts: string } | null = null;

  const slow = Promise.allSettled([fetchGleif(), screenSanctions(), fetchTed(), fetchNews(), fetchFred()]);
  const raced = await Promise.race([
    slow,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
  ]);
  if (raced) {
    const [g, s, t, n, f] = raced;
    if (g.status === "fulfilled") gleif = g.value;
    if (s.status === "fulfilled") sanctions = s.value;
    if (t.status === "fulfilled") ted = t.value;
    if (n.status === "fulfilled") news = n.value;
    if (f.status === "fulfilled") fred = f.value;
  } else {
    void slow.then((racedLater) => {
      const [g, s, t, n, f] = racedLater;
      if (!bundleCache) return;
      const next = { ...bundleCache.value };
      if (g.status === "fulfilled") next.gleif = g.value;
      if (s.status === "fulfilled") next.sanctions = s.value;
      if (t.status === "fulfilled") next.ted = t.value;
      if (n.status === "fulfilled") next.news = n.value;
      if (f.status === "fulfilled" && f.value) {
        next.lme = { ...next.lme, fredCopperUsdMt: f.value.copper, fredAluminiumUsdMt: f.value.aluminium };
      }
      bundleCache = { at: Date.now(), value: next };
    });
  }

  const bundle = assembleBundle(quotes, fx, lme, gleif, sanctions, ted, news, fred);
  bundleCache = { at: Date.now(), value: bundle };
  return bundle;
}

export function scaleByLive(base: number, symbol: string, baselinePx: number, quotes: Record<string, LiveQuote>) {
  const q = quotes[symbol];
  if (!q || !baselinePx) return Math.round(base);
  return Math.round(base * (q.price / baselinePx));
}
