const https = require('https');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (compatible; VerityXDesk/7.0)';
const QUOTE_SYMBOLS = ['HG=F', 'ALI=F', 'MP', 'IFX.DE', 'TKA.DE', 'SIE.DE'];
const SCREEN_NAMES = ['Nanjing RareTech','Baotou Rare Earth','China Northern Rare Earth','Infineon Technologies','Hexion','Dillinger','thyssenkrupp','Nordic Conductor','Siemens Gamesa'];
const GLEIF_Q = {
  'Infineon Technologies AG': 'Infineon Technologies AG',
  'thyssenkrupp Steel Europe': 'thyssenkrupp AG',
  'Hexion GmbH': 'Hexion',
  'Dillinger Hütte': 'Dillinger',
  'Siemens Gamesa': 'Siemens Gamesa Renewable Energy',
  'Nanjing RareTech Ltd.': 'Nanjing',
  'Baotou Rare Earth Co.': 'China Northern Rare Earth',
  'China Northern Rare Earth': 'China Northern Rare Earth',
  'Nordic Conductor AB': 'Boliden'
};

let quoteCache = null, fxCache = null, gleifCache = null, sanctionCache = null, bundleCache = null;

function age(c, ms){ return c && Date.now() - c.at < ms; }

function getJson(url, headers){
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, headers || {})
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => {
        if (res.statusCode >= 300) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function getText(url){
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': UA }
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return getText(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode >= 300) return reject(new Error('HTTP ' + res.statusCode));
        resolve(d);
      });
    });
    req.setTimeout(18000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function yahooQuote(symbol){
  try {
    const data = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=5d');
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    if (!meta || !meta.regularMarketPrice) return null;
    return {
      symbol, name: String(meta.shortName || symbol), price: Number(meta.regularMarketPrice),
      currency: String(meta.currency || 'USD'), changePct: Number(meta.regularMarketChangePercent || 0),
      ts: new Date((meta.regularMarketTime || Date.now()/1000) * 1000).toISOString(), source: 'Yahoo Finance'
    };
  } catch { return null; }
}

async function fetchQuotes(){
  if (age(quoteCache, 45000)) return quoteCache.value;
  const quotes = {};
  await Promise.all(QUOTE_SYMBOLS.map(async (s) => { const q = await yahooQuote(s); if (q) quotes[s] = q; }));
  if (Object.keys(quotes).length) quoteCache = { at: Date.now(), value: quotes };
  return quotes;
}

async function fetchFx(){
  if (age(fxCache, 120000)) return fxCache.value;
  try {
    const data = await getJson('https://open.er-api.com/v6/latest/USD');
    const usdEur = Number(data && data.rates && data.rates.EUR);
    if (!usdEur) throw new Error('no EUR');
    const fx = { usdEur, source: 'open.er-api.com (open FX)', ts: String(data.time_last_update_utc || new Date().toISOString()) };
    fxCache = { at: Date.now(), value: fx };
    return fx;
  } catch {
    return (fxCache && fxCache.value) || { usdEur: 0.86, source: 'stale fallback', ts: new Date().toISOString() };
  }
}

async function gleifLookup(query){
  try {
    const url = 'https://api.gleif.org/api/v1/lei-records?page%5Bsize%5D=1&filter%5Bentity.legalName%5D=' + encodeURIComponent(query);
    const data = await getJson(url, { Accept: 'application/vnd.api+json' });
    const rec = data && data.data && data.data[0];
    if (!rec) return null;
    const ent = rec.attributes && rec.attributes.entity;
    return {
      lei: (rec.attributes && rec.attributes.lei) || rec.id,
      name: (ent && ent.legalName && ent.legalName.name) || query,
      country: (ent && ent.legalAddress && ent.legalAddress.country) || '',
      status: (ent && ent.status) || '',
      query
    };
  } catch { return null; }
}

async function fetchGleif(){
  if (age(gleifCache, 30*60*1000)) return gleifCache.value;
  const names = [...new Set(Object.values(GLEIF_Q))];
  const map = {};
  await Promise.all(names.map(async (n) => { map[n] = await gleifLookup(n); }));
  gleifCache = { at: Date.now(), value: map };
  return map;
}

async function screenSanctions(){
  try {
    if (!age(sanctionCache, 30*60*1000)) {
      const blob = (await getText('https://scsanctions.un.org/resources/xml/en/consolidated.xml')).toUpperCase();
      sanctionCache = { at: Date.now(), value: { source: 'UN Security Council Consolidated List', ts: new Date().toISOString(), scanned: blob.length, blob } };
    }
    const pack = sanctionCache.value;
    return {
      source: pack.source, ts: pack.ts, scanned: pack.scanned,
      hits: SCREEN_NAMES.map((name) => ({ name, list: pack.source, matched: pack.blob.includes(name.toUpperCase()) }))
    };
  } catch {
    return { source: 'UN Security Council Consolidated List', ts: new Date().toISOString(), scanned: 0, hits: SCREEN_NAMES.map((name) => ({ name, list: 'UN', matched: false })) };
  }
}

async function fetchLiveBundle(){
  if (age(bundleCache, 40000)) return bundleCache.value;
  const [quotes, fx, gleif, sanctions] = await Promise.all([fetchQuotes(), fetchFx(), fetchGleif(), screenSanctions()]);
  const health = {
    yahoo: Object.keys(quotes).length >= 3 ? 'LIVE' : 'DOWN',
    fx: fx.source.indexOf('stale') >= 0 ? 'STALE' : 'LIVE',
    gleif: Object.values(gleif).some(Boolean) ? 'LIVE' : 'DOWN',
    sanctions: sanctions.scanned > 1000 ? 'LIVE' : 'STALE',
    ted: 'STALE'
  };
  const bundle = { quotes, fx, gleif, sanctions, ted: [], fetchedAt: new Date().toISOString(), health };
  bundleCache = { at: Date.now(), value: bundle };
  return bundle;
}

function scaleByLive(base, symbol, baselinePx, quotes){
  const q = quotes && quotes[symbol];
  if (!q || !baselinePx) return Math.round(base);
  return Math.round(base * (q.price / baselinePx));
}

module.exports = { fetchLiveBundle, scaleByLive, GLEIF_Q };
