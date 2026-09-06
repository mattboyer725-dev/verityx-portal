import type { LiveBundle, LiveQuote } from "@/lib/feeds";
import { scaleByLive, SUPPLIER_GLEIF } from "@/lib/feeds";
import {
  appendCoreEvent,
  ensureGenesis,
  eventHashes,
  inclusionProof,
  listEvents,
  merkleRootOf,
  merkleSnapshot,
  verifyChain,
  verifyInclusion,
  LOCAL_CORE,

} from "@/lib/core-ledger";
import { runPbft, PBFT_N, PBFT_QUORUM, clusterSnapshot, type PbftRound } from "@/lib/pbft";
import { getAriba, getSapPo, seedSapPo, sapWriteback as postSap, sapWritebackLog as sapLog, type SapPO, type AribaRfq } from "@/lib/sap";

export type ScreenLevel = "CLEAR" | "LOW" | "MED" | "HIGH" | "WATCH";

export type Tier = {
  tier: number;
  role: string;
  name: string;
  country: string;
  evidence: string;
  lat: number;
  lng: number;
};

export type Screens = {
  exportPermit: ScreenLevel;
  esg: ScreenLevel;
  financial: ScreenLevel;
  dualUse: ScreenLevel;
};

export type Scenario = {
  id: string;
  desk: "metals" | "energy" | "composites";
  title: string;
  supplier: string;
  proposed: number;
  observations: number[];
  observationSources: string[];
  assumptions: string[];
  tenant: string;
  commodity: string;
  po: string;
  plant: string;
  buyer: string;
  currency: string;
  due: string;
  tiers: Tier[];
  screens: Screens;
  oracleSymbol: string;
  baselinePx: number;
};

export const BUYER = {
  name: "Elena Hartmann",
  title: "Head of Magnetics Procurement",
  email: "elena.hartmann@siemensgamesa.com",
  password: "demo2026",
  tenant: "SIEMENS-GAMESA",
  plant: "Hamburg · Brande · Hull",
  org: "Siemens Gamesa Renewable Energy",
};

export const SCENARIOS: Scenario[] = [
  {
    id: "SG-4782",
    desk: "metals",
    title: "Rare Earth Permanent Magnets",
    supplier: "Nanjing RareTech Ltd.",
    proposed: 6_950_000,
    observations: [5_680_000, 5_712_000, 5_594_000, 5_748_000, 8_120_000],
    observationSources: [
      "Argus NdPr oxide live",
      "Asian Metal NdFeB print",
      "Internal last-buy SAP",
      "LME-adjacent magnet index",
      "Supplier quote (unverified)",
    ],
    assumptions: ["China processing share ~90%", "Sintered NdFeB N48H"],
    tenant: "SIEMENS-GAMESA",
    commodity: "NdFeB magnet",
    po: "4500187742",
    plant: "Brande, DK",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-10-14",
    oracleSymbol: "MP",
    baselinePx: 54.53,
    tiers: [
      { tier: 0, role: "Mine", name: "Bayan Obo pit", country: "CN", evidence: "lot weighbridge", lat: 41.769, lng: 109.973 },
      { tier: 1, role: "Separator", name: "Inner Mongolia REE mill", country: "CN", evidence: "assay cert", lat: 40.657, lng: 109.84 },
      { tier: 2, role: "Magnet OEM", name: "Nanjing RareTech Ltd.", country: "CN", evidence: "quote + ISO 9001", lat: 32.061, lng: 118.778 },
      { tier: 3, role: "OEM plant", name: "Siemens Gamesa Brande", country: "DK", evidence: "SAP PO", lat: 55.947, lng: 9.128 },
    ],
    screens: { exportPermit: "WATCH", esg: "HIGH", financial: "MED", dualUse: "CLEAR" },
  },
  {
    id: "SG-5191",
    desk: "metals",
    title: "Neodymium Alloy Procurement",
    supplier: "Baotou Rare Earth Co.",
    proposed: 12_400_000,
    observations: [10_350_000, 10_420_000, 10_180_000, 10_660_000],
    observationSources: ["Argus NdPr oxide live", "Asian Metal alloy", "Last SAP GR", "Trader offer"],
    assumptions: ["Single-origin melt lot"],
    tenant: "SIEMENS-GAMESA",
    commodity: "NdPr alloy",
    po: "4500188011",
    plant: "Hamburg, DE",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-11-02",
    oracleSymbol: "MP",
    baselinePx: 54.53,
    tiers: [
      { tier: 0, role: "Mine", name: "Baotou pit feed", country: "CN", evidence: "origin declaration", lat: 40.657, lng: 109.84 },
      { tier: 1, role: "Alloy", name: "Baotou Rare Earth Co.", country: "CN", evidence: "melt heat number", lat: 40.657, lng: 109.84 },
      { tier: 2, role: "OEM plant", name: "Siemens Gamesa Hamburg", country: "DE", evidence: "Ariba RFQ", lat: 53.546, lng: 9.993 },
    ],
    screens: { exportPermit: "WATCH", esg: "MED", financial: "HIGH", dualUse: "CLEAR" },
  },
  {
    id: "SG-6033",
    desk: "metals",
    title: "Offshore Generator Copper CTC",
    supplier: "Nordic Conductor AB",
    proposed: 4_820_000,
    observations: [4_610_000, 4_598_000, 4_632_000, 4_605_000],
    observationSources: ["LME Cu cash live", "Boliden mill", "Nordic Conductor offer", "SAP last GR"],
    assumptions: ["EU origin claimed"],
    tenant: "SIEMENS-GAMESA",
    commodity: "Cu CTC",
    po: "4500191044",
    plant: "Hull, GB",
    buyer: "Mads Sørensen",
    currency: "EUR",
    due: "2026-09-28",
    oracleSymbol: "HG=F",
    baselinePx: 6.6825,
    tiers: [
      { tier: 0, role: "Cathode", name: "Boliden Rönnskär", country: "SE", evidence: "LME warrant", lat: 64.665, lng: 21.266 },
      { tier: 1, role: "Drawer", name: "Nordic Conductor AB", country: "SE", evidence: "mill cert", lat: 59.329, lng: 18.068 },
      { tier: 2, role: "OEM plant", name: "Siemens Gamesa Hull", country: "GB", evidence: "SAP GR", lat: 53.744, lng: -0.331 },
    ],
    screens: { exportPermit: "CLEAR", esg: "LOW", financial: "LOW", dualUse: "CLEAR" },
  },
  {
    id: "SG-7104",
    desk: "metals",
    title: "Tower Steel Plate S355",
    supplier: "Dillinger Hütte",
    proposed: 8_240_000,
    observations: [8_110_000, 8_085_000, 8_152_000, 8_098_000],
    observationSources: ["thyssenkrupp TKA.DE live", "Dillinger quote", "MEPS plate EU", "SAP last-buy"],
    assumptions: ["EU mill of origin", "EN 10025-2"],
    tenant: "SIEMENS-GAMESA",
    commodity: "S355 plate",
    po: "4500193301",
    plant: "Le Havre, FR",
    buyer: "Claire Moreau",
    currency: "EUR",
    due: "2026-10-30",
    oracleSymbol: "TKA.DE",
    baselinePx: 15.21,
    tiers: [
      { tier: 0, role: "Iron ore", name: "LKAB Kiruna", country: "SE", evidence: "origin cert", lat: 67.851, lng: 20.198 },
      { tier: 1, role: "Mill", name: "Dillinger Hütte", country: "DE", evidence: "heat number", lat: 49.355, lng: 6.728 },
      { tier: 2, role: "OEM plant", name: "SGRE tower line Le Havre", country: "FR", evidence: "SAP PO", lat: 49.494, lng: 0.108 },
    ],
    screens: { exportPermit: "CLEAR", esg: "LOW", financial: "LOW", dualUse: "CLEAR" },
  },
  {
    id: "SG-8221",
    desk: "composites",
    title: "Blade Infusion Resin",
    supplier: "Hexion GmbH",
    proposed: 3_180_000,
    observations: [2_940_000, 2_975_000, 3_410_000, 2_960_000],
    observationSources: ["LME Al cash live", "Hexion offer", "Olin analog", "SAP last GR"],
    assumptions: ["Epoxy + hardener kit"],
    tenant: "SIEMENS-GAMESA",
    commodity: "Epoxy resin kit",
    po: "4500194418",
    plant: "Aalborg, DK",
    buyer: "Ingrid Dahl",
    currency: "EUR",
    due: "2026-09-18",
    oracleSymbol: "ALI=F",
    baselinePx: 3473.25,
    tiers: [
      { tier: 0, role: "Feedstock", name: "BPA / ECH Duisburg", country: "DE", evidence: "REACH dossier", lat: 51.434, lng: 6.762 },
      { tier: 1, role: "Formulator", name: "Hexion GmbH", country: "DE", evidence: "batch COA", lat: 51.376, lng: 7.703 },
      { tier: 2, role: "Blade plant", name: "SGRE Aalborg", country: "DK", evidence: "Ariba contract", lat: 57.048, lng: 9.919 },
    ],
    screens: { exportPermit: "CLEAR", esg: "MED", financial: "LOW", dualUse: "CLEAR" },
  },
  {
    id: "SG-9012",
    desk: "energy",
    title: "Converter IGBT Modules",
    supplier: "Infineon Technologies AG",
    proposed: 5_460_000,
    observations: [5_410_000, 5_388_000, 5_425_000, 5_402_000],
    observationSources: ["IFX.DE live", "Distributor print", "Last SAP GR", "Peer OEM"],
    assumptions: ["Automotive-grade dual-use screen required"],
    tenant: "SIEMENS-GAMESA",
    commodity: "IGBT module",
    po: "4500195520",
    plant: "Zamudio, ES",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-12-01",
    oracleSymbol: "IFX.DE",
    baselinePx: 56.86,
    tiers: [
      { tier: 0, role: "Wafer", name: "Infineon Villach", country: "AT", evidence: "lot traveler", lat: 46.61, lng: 13.856 },
      { tier: 1, role: "Module OEM", name: "Infineon Warstein", country: "DE", evidence: "PPAP", lat: 51.444, lng: 8.349 },
      { tier: 2, role: "OEM plant", name: "SGRE Zamudio", country: "ES", evidence: "SAP PO", lat: 43.283, lng: -2.867 },
    ],
    screens: { exportPermit: "CLEAR", esg: "LOW", financial: "LOW", dualUse: "WATCH" },
  },
  {
    id: "SG-9304",
    desk: "metals",
    title: "Dysprosium Metal for H-grade Magnets",
    supplier: "China Northern Rare Earth",
    proposed: 9_180_000,
    observations: [7_420_000, 7_385_000, 7_510_000, 7_460_000, 11_200_000],
    observationSources: ["Argus Dy oxide live", "Asian Metal Dy metal", "Internal last-buy SAP", "Trader offer EU bonded", "Supplier quote (unverified)"],
    assumptions: ["Heavy REE, export-licence sensitive", "H-grade NdFeB dopant"],
    tenant: "SIEMENS-GAMESA",
    commodity: "Dy metal",
    po: "4500196604",
    plant: "Brande, DK",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-11-20",
    oracleSymbol: "MP",
    baselinePx: 54.53,
    tiers: [
      { tier: 0, role: "Mine", name: "Bayan Obo heavy-REE cut", country: "CN", evidence: "lot assay", lat: 41.769, lng: 109.973 },
      { tier: 1, role: "Separator", name: "Northern REE solvent mill", country: "CN", evidence: "export licence", lat: 40.657, lng: 109.84 },
      { tier: 2, role: "Metal", name: "China Northern Rare Earth", country: "CN", evidence: "ingot heat", lat: 40.657, lng: 109.84 },
      { tier: 3, role: "OEM plant", name: "Siemens Gamesa Brande", country: "DK", evidence: "SAP PO", lat: 55.947, lng: 9.128 },
    ],
    screens: { exportPermit: "WATCH", esg: "HIGH", financial: "MED", dualUse: "CLEAR" },
  },
  {
    id: "SG-7440",
    desk: "energy",
    title: "Generator Electrical Steel M400-50A",
    supplier: "thyssenkrupp Steel Europe",
    proposed: 3_640_000,
    observations: [3_580_000, 3_595_000, 3_572_000, 3_610_000],
    observationSources: ["TKA.DE live", "tkSE mill quote", "voestalpine analog", "SAP last GR"],
    assumptions: ["EU mill of origin", "EN 10106"],
    tenant: "SIEMENS-GAMESA",
    commodity: "NGO electrical steel",
    po: "4500194410",
    plant: "Cuxhaven, DE",
    buyer: "Mads Sørensen",
    currency: "EUR",
    due: "2026-10-08",
    oracleSymbol: "TKA.DE",
    baselinePx: 15.21,
    tiers: [
      { tier: 0, role: "Iron ore", name: "LKAB Kiruna", country: "SE", evidence: "origin cert", lat: 67.851, lng: 20.198 },
      { tier: 1, role: "Mill", name: "thyssenkrupp Steel Europe", country: "DE", evidence: "coil heat", lat: 51.492, lng: 6.775 },
      { tier: 2, role: "OEM plant", name: "SGRE Cuxhaven", country: "DE", evidence: "SAP GR", lat: 53.861, lng: 8.694 },
    ],
    screens: { exportPermit: "CLEAR", esg: "LOW", financial: "LOW", dualUse: "CLEAR" },
  },
];

function median(s: number[]) {
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function madFilter(values: number[]) {
  if (values.length < 3) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
  if (mad === 0) return values;
  const f = values.filter((v) => (0.6745 * Math.abs(v - med)) / mad <= 3.5);
  return f.length >= 2 ? f : values;
}

function stdev(values: number[]) {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

export type Consensus = {
  confidence: number;
  cv: number;
  verdict: "VERIFIED" | "DISPUTED" | "INSUFFICIENT_DATA";
  market: number;
  n: number;
  dropped: number;
  kept: number[];
};

export function consensusAgent(observations: number[]): Consensus {
  if (!observations || observations.length < 2) {
    return { confidence: 0, cv: 0, verdict: "INSUFFICIENT_DATA", market: 0, n: 0, dropped: 0, kept: [] };
  }
  const filtered = madFilter(observations);
  const market = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  if (Math.abs(market) < 0.01) {
    return { confidence: 0, cv: 0, verdict: "INSUFFICIENT_DATA", market: 0, n: 0, dropped: 0, kept: filtered };
  }
  const cv = stdev(filtered) / Math.abs(market);
  const confidence = Math.max(0, Math.min(1, 1 - cv));
  return {
    confidence,
    cv,
    verdict: confidence >= 0.8 ? "VERIFIED" : "DISPUTED",
    market,
    n: filtered.length,
    dropped: observations.length - filtered.length,
    kept: filtered,
  };
}

function liveScenario(scenario: Scenario, live?: LiveBundle): Scenario {
  if (!live) return scenario;
  const obs = scenario.observations.map((v) => scaleByLive(v, scenario.oracleSymbol, scenario.baselinePx, live.quotes));
  const proposed = scaleByLive(scenario.proposed, scenario.oracleSymbol, scenario.baselinePx, live.quotes);
  return { ...scenario, observations: obs, proposed };
}

function ensureSap(scenario: Scenario) {
  return seedSapPo({
    po: scenario.po,
    id: scenario.id,
    supplier: scenario.supplier,
    title: scenario.title,
    plant: scenario.plant,
    commodity: scenario.commodity,
    amount: scenario.proposed,
    currency: scenario.currency,
  });
}

export function ingestAgent(scenario: Scenario, live?: LiveBundle) {
  const sap = ensureSap(scenario);
  const ariba = getAriba(scenario.po);
  return {
    agent: "INGEST" as const,
    sources: ["SAP S/4HANA OData", "Ariba RFQ", "LME/Argus oracles", "GLEIF"],
    po: scenario.po,
    sap,
    ariba,
    ted: live?.ted ?? [],
    observations: scenario.observations,
    ts: new Date().toISOString(),
  };
}

export function oracleAgent(scenario: Scenario, live?: LiveBundle) {
  const q: LiveQuote | undefined = live?.quotes[scenario.oracleSymbol];
  const prints = scenario.observations.map((value, i) => ({
    source: scenario.observationSources[i] || `oracle-${i + 1}`,
    value,
    outlier: false,
    live: i === 0 && !!q,
  }));
  if (live?.lme && scenario.oracleSymbol === "HG=F") {
    prints.unshift({
      source: `LME Cu cash ${live.lme.copperUsdMt.toFixed(0)} USD/mt`,
      value: scaleByLive(scenario.observations[0], scenario.oracleSymbol, scenario.baselinePx, live.quotes),
      outlier: false,
      live: true,
    });
  }
  if (live?.lme && scenario.oracleSymbol === "ALI=F") {
    prints.unshift({
      source: `LME Al cash ${live.lme.aluminiumUsdMt.toFixed(0)} USD/mt`,
      value: scaleByLive(scenario.observations[0], scenario.oracleSymbol, scenario.baselinePx, live.quotes),
      outlier: false,
      live: true,
    });
  }
  if (live?.argus && scenario.oracleSymbol === "MP") {
    prints.unshift({
      source: `Argus NdPr ${live.argus.ndprUsdKg.toFixed(1)} USD/kg`,
      value: scaleByLive(scenario.observations[0], scenario.oracleSymbol, scenario.baselinePx, live.quotes),
      outlier: false,
      live: true,
    });
  }
  return {
    agent: "ORACLE" as const,
    prints,
    quote: q || null,
    lme: live?.lme || null,
    argus: live?.argus || null,
    fx: live?.fx || null,
    pattern: live?.lme ? "Live LME cash + Argus REE + ECB FX" : "Waiting on live tape",
  };
}

export function riskAgent(scenario: Scenario, consensus: Consensus) {
  const savings = Math.max(0, scenario.proposed - consensus.market);
  const anomaly = consensus.market ? ((scenario.proposed - consensus.market) / consensus.market) * 100 : 0;
  let level: "MED" | "HIGH" | "CRITICAL" | "LOW" = "MED";
  if (anomaly >= 18 || consensus.verdict !== "VERIFIED" || scenario.screens.exportPermit === "WATCH") level = "CRITICAL";
  else if (anomaly >= 8 || scenario.screens.esg === "HIGH") level = "HIGH";
  else if (anomaly < 5 && consensus.verdict === "VERIFIED") level = "LOW";
  return {
    agent: "RISK" as const,
    level,
    anomalyPct: Number(anomaly.toFixed(1)),
    savings: Math.round(savings),
    screens: scenario.screens,
    action: level === "CRITICAL" || level === "HIGH" ? "HOLD_PO" : "RELEASE_PO",
  };
}

export function provenanceAgent(scenario: Scenario) {
  const lot = scenario.po.slice(-8);
  const now = Date.now();
  const custody = scenario.tiers.map((t, i) => ({
    step: i + 1,
    from: t.name,
    event: `${t.role} handoff`,
    evidence: t.evidence,
    country: t.country,
    lat: t.lat,
    lng: t.lng,
    at: new Date(now - (scenario.tiers.length - i) * 86400000 * 11).toISOString(),
  }));
  return {
    agent: "PROVENANCE" as const,
    pattern: "Circulor mass-balance + Minespider batch hash + EU DPP",
    commodity: scenario.commodity,
    dppId: `dpp:eu:sgre:${scenario.id.toLowerCase()}:${lot}`,
    gs1: `https://id.gs1.org/01/04012345678901/21/${lot}`,
    circulorLot: `CIR-SGRE-${lot}`,
    minespiderBatch: `MS-${scenario.id}-${lot}`,
    tiers: scenario.tiers,
    custody,
  };
}

export function screenAgent(scenario: Scenario, live?: LiveBundle) {
  const gleifKey = SUPPLIER_GLEIF[scenario.supplier] || scenario.supplier;
  const gleif = live?.gleif[gleifKey] || null;
  const hit = live?.sanctions.hits.find((h) => scenario.supplier.toUpperCase().includes(h.name.split(" ")[0].toUpperCase()));
  const listed = live?.quotes[scenario.oracleSymbol];
  const eco = live?.ecovadis[scenario.supplier] || live?.ecovadis[gleifKey];
  const pre = live?.prewave[scenario.supplier] || live?.prewave[gleifKey];
  const rapid = live?.rapid[scenario.supplier] || live?.rapid[gleifKey];
  const alerts = [
    scenario.screens.exportPermit !== "CLEAR" && { type: "EXPORT", text: "China rare-earth export permit lag" },
    eco && eco.score < 50 && { type: "ESG", text: `EcoVadis ${eco.medal} · ${eco.score}` },
    pre && (pre.level === "HIGH" || pre.level === "CRITICAL") && { type: "MEDIA", text: `Prewave ${pre.level} · ${pre.headlines[0] || "media risk"}` },
    rapid && rapid.fhr < 50 && { type: "FIN", text: `RapidRatings FHR ${rapid.fhr} · ${rapid.outlook}` },
    scenario.screens.dualUse !== "CLEAR" && { type: "DUAL_USE", text: "Dual-use / export-control watch" },
    hit?.matched && { type: "SANCTIONS", text: `UN consolidated hit on ${hit.name}` },
  ].filter(Boolean) as { type: string; text: string }[];
  return {
    agent: "SCREEN" as const,
    pattern: "EcoVadis + Prewave + RapidRatings + GLEIF + UN",
    screens: scenario.screens,
    alerts,
    gleif,
    ecovadis: eco || null,
    prewave: pre || null,
    rapid: rapid || null,
    sanctions: {
      source: live?.sanctions.source || "UN",
      matched: !!hit?.matched,
      ts: live?.sanctions.ts,
    },
    financial: listed
      ? { symbol: listed.symbol, price: listed.price, currency: listed.currency, changePct: listed.changePct, source: listed.source }
      : null,
  };
}

export function complianceAgent(scenario: Scenario) {
  const cnShare = scenario.tiers.filter((t) => t.country === "CN").length / scenario.tiers.length;
  return {
    agent: "COMPLIANCE" as const,
    dualUse: scenario.screens.dualUse,
    exportPermit: scenario.screens.exportPermit,
    chinaProcessingShare: Number(cnShare.toFixed(2)),
    reach: scenario.desk === "composites" ? "DOSSIER_ON_FILE" : "N/A",
    cbam: scenario.desk === "metals" ? "IN_SCOPE" : "OUT_OF_SCOPE",
    gate: scenario.screens.exportPermit === "WATCH" || scenario.screens.dualUse === "WATCH" ? "REVIEW" : "PASS",
  };
}

export type SealBlock = {
  agent: "SEAL";
  algorithm: string;
  block: string;
  hash: string;
  prev: string;
  nodes: number;
  quorum: string;
  finality: string;
  ts: string;
  merkle: string;
  pbft: PbftRound;
  cluster: ReturnType<typeof clusterSnapshot>;
};

const CHAIN: SealBlock[] = [];

async function sha256Hex(payload: string) {
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sealAgent(scenario: Scenario, consensus: Consensus): Promise<SealBlock> {
  const prev = CHAIN.length ? CHAIN[CHAIN.length - 1].hash : "GENESIS";
  const payload = JSON.stringify({
    id: scenario.id,
    prev,
    market: Math.round(consensus.market),
    proposed: scenario.proposed,
    confidence: Number(consensus.confidence.toFixed(4)),
    verdict: consensus.verdict,
  });
  const pbft = await runPbft(payload);
  const hash = pbft.digest;
  const merkle = await sha256Hex(`${hash}:${scenario.po}:${consensus.n}`);
  const block: SealBlock = {
    agent: "SEAL",
    algorithm: "PBFT 27-node + hash chain",
    block: "VX-BLK-" + hash.slice(0, 12).toUpperCase(),
    hash,
    prev,
    nodes: PBFT_N,
    quorum: `2f+1=${PBFT_QUORUM}`,
    finality: pbft.committed ? "committed" : "view-change",
    ts: pbft.ts,
    merkle,
    pbft,
    cluster: clusterSnapshot(pbft),
  };
  CHAIN.push(block);
  return block;
}

export async function ledgerAgent() {
  const chain = await verifyChain();
  const snap = await merkleSnapshot();
  return {
    agent: "LEDGER" as const,
    pattern: "verityx-local-core v1.6.0 · HMAC-SHA256 append-only + Merkle inclusion",
    repo: LOCAL_CORE.repo,
    version: LOCAL_CORE.version,
    depth: chain.depth,
    intact: chain.ok,
    tip: eventHashes().at(-1) || "GENESIS",
    merkleRoot: snap.merkle_root,
    blocks: [...CHAIN],
    events: listEvents().slice(-8),
    errors: chain.errors,
  };
}

export function evidenceAgent(packet: PipelineResult) {
  return {
    agent: "EVIDENCE" as const,
    pattern: "Exportable evidence packet + local-core Merkle proof",
    filename: `${packet.scenario.id}-verityx-packet.json`,
  };
}

export function dualSourceAgent(scenario: Scenario, consensus: Consensus) {
  const quote = scenario.proposed;
  const market = consensus.market;
  const spread = market ? ((quote - market) / market) * 100 : 0;
  return {
    agent: "DUAL_SOURCE" as const,
    id: scenario.id,
    quote,
    market: Math.round(market),
    spreadPct: Number(spread.toFixed(1)),
    verdict: Math.abs(spread) >= 8 ? ("SPREAD_ALERT" as const) : ("ALIGNED" as const),
    sources: scenario.observationSources,
  };
}

export function authStamp(token?: { iss?: string; email?: string; sub?: string }) {
  return {
    agent: "AUTH" as const,
    ok: true,
    pattern: "Okta Workforce · OIDC RS256 JWT",
    issuer: token?.iss || "https://verityx.okta.com/oauth2/default",
    seat: {
      name: BUYER.name,
      title: BUYER.title,
      tenant: BUYER.tenant,
      email: BUYER.email,
      sub: token?.sub || "00u_elena_hartmann",
    },
  };
}

async function merkleRoot(leaves: string[]) {
  if (!leaves.length) return { root: "0".repeat(64), layers: 0 };
  const root = await merkleRootOf(leaves);
  return { root, layers: Math.ceil(Math.log2(Math.max(1, leaves.length))) + 1 };
}

async function merkleInclusion(leaf: string) {
  const leaves = eventHashes();
  const idx = leaves.lastIndexOf(leaf);
  if (idx < 0) {
    const chainLeaves = CHAIN.map((b) => b.hash);
    const cidx = chainLeaves.indexOf(leaf);
    if (cidx < 0) return { ok: false as const, leaf, error: "leaf not on chain" };
    const { root, path } = await inclusionProof(chainLeaves, cidx);
    const ok = await verifyInclusion(leaf, cidx, path, root);
    return { ok, leaf, index: cidx, root, proof: path };
  }
  const { root, path } = await inclusionProof(leaves, idx);
  const ok = await verifyInclusion(leaf, idx, path, root);
  return { ok, leaf, index: idx, root, proof: path };
}

export async function merkleAgent(leaf?: string) {
  await ensureGenesis();
  const leaves = eventHashes();
  const tree = await merkleRoot(leaves);
  const inclusion = leaf ? await merkleInclusion(leaf) : leaves.length ? await merkleInclusion(leaves[leaves.length - 1]) : null;
  const chain = await verifyChain();
  return {
    agent: "MERKLE" as const,
    pattern: "verityx-local-core · domain-separated SHA256 (0x00 leaf / 0x01 pair) + HMAC-SHA256",
    repo: LOCAL_CORE.repo,
    version: LOCAL_CORE.version,
    depth: leaves.length,
    intact: chain.ok,
    ...tree,
    inclusion,
  };
}

export function sapWriteback(scenario: Scenario, action: string, recommended: string) {
  ensureSap(scenario);
  return postSap(scenario.po, scenario.id, action, recommended);
}

export function sapWritebackLog() {
  return sapLog();
}

export type PipelineResult = {
  scenario: Scenario;
  ingest: ReturnType<typeof ingestAgent>;
  oracle: ReturnType<typeof oracleAgent>;
  consensus: Consensus;
  risk: ReturnType<typeof riskAgent>;
  provenance: ReturnType<typeof provenanceAgent>;
  screen: ReturnType<typeof screenAgent>;
  compliance: ReturnType<typeof complianceAgent>;
  dual: ReturnType<typeof dualSourceAgent>;
  seal: SealBlock;
  ledger: Awaited<ReturnType<typeof ledgerAgent>>;
  merkle: Awaited<ReturnType<typeof merkleAgent>>;
  auth: ReturnType<typeof authStamp>;
  sap: SapPO | null;
  ariba: AribaRfq | null;
  chainDepth: number;
  live: LiveBundle | null;
  message: string;
};

export async function runPipeline(scenarioId: string, live?: LiveBundle): Promise<PipelineResult> {
  await ensureGenesis();
  const raw = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const scenario = liveScenario(raw, live);
  const ingest = ingestAgent(scenario, live);
  const oracle = oracleAgent(scenario, live);
  const consensus = consensusAgent(scenario.observations);
  oracle.prints = oracle.prints.map((p) => ({
    ...p,
    outlier: !consensus.kept.includes(p.value) && !p.live,
  }));
  const risk = riskAgent(scenario, consensus);
  const provenance = provenanceAgent(scenario);
  const screen = screenAgent(scenario, live);
  const compliance = complianceAgent(scenario);
  const dual = dualSourceAgent(scenario, consensus);
  const seal = await sealAgent(scenario, consensus);
  const artifact = await appendCoreEvent(
    "artifact.record",
    {
      title: `${scenario.id} ${scenario.po}`,
      location: seal.hash,
      kind: "po-seal",
      notes: `${risk.action} ${consensus.verdict}`,
    },
    BUYER.email,
  );
  await appendCoreEvent(
    "decision.record",
    {
      title: scenario.po,
      choice: risk.action,
      context: `${scenario.title} · ${scenario.supplier}`,
    },
    BUYER.email,
  );
  const ledger = await ledgerAgent();
  const merkle = await merkleAgent(artifact.hash);
  const auth = authStamp();
  const tape = oracle.lme
    ? `LME Cu ${oracle.lme.copperUsdMt.toFixed(0)}`
    : oracle.quote
      ? `${oracle.quote.symbol} ${oracle.quote.price}`
      : "no tape";
  return {
    scenario,
    ingest,
    oracle,
    consensus,
    risk,
    provenance,
    screen,
    compliance,
    dual,
    seal,
    ledger,
    merkle,
    auth,
    sap: getSapPo(scenario.po),
    ariba: getAriba(scenario.po),
    chainDepth: CHAIN.length,
    live: live || null,
    message: `${risk.action.replace("_", " ")} · ${consensus.verdict} · ${tape} · PBFT ${seal.pbft.commitOk}/${PBFT_N} · core ${ledger.depth} HMAC.`,
  };
}

export function competitionNotes() {
  return [
    { name: "SAP Ariba / Coupa / GEP", take: "Verify sits on the PO path with an OData writeback, not a side dashboard." },
    { name: "EcoVadis / Prewave", take: "Live EcoVadis scorecard + Prewave media risk on every supplier." },
    { name: "Resilinc / Everstream / Sayari", take: "N-tier map with lat/lng custody events." },
    { name: "Circulor / Minespider / Everledger", take: "EU DPP + GS1 Digital Link + mass-balance lot." },
    { name: "RapidRatings / D&B", take: "Live FHR from listed tape; opacity flag if unlisted." },
    { name: "Sourcemap / Altana", take: "Exportable evidence packet." },
    { name: "Hyperledger samples", take: "Permissioned 27-node PBFT, not public PoW." },
    { name: "verityx-local-core", take: "HMAC-SHA256 append-only log + domain-separated Merkle inclusion (v1.6.0, SHA 319af22)." },
  ];
}

export const AGENTS = [
  { id: "INGEST", exists: true, role: "SAP S/4 + Ariba" },
  { id: "ORACLE", exists: true, role: "LME + Argus + ECB" },
  { id: "CONSENSUS", exists: true, role: "CoV + MAD filter" },
  { id: "RISK", exists: true, role: "Anomaly vs proposed" },
  { id: "PROVENANCE", exists: true, role: "Circulor + Minespider" },
  { id: "SCREEN", exists: true, role: "EcoVadis + Prewave + RapidRatings" },
  { id: "COMPLIANCE", exists: true, role: "CBAM / dual-use gate" },
  { id: "SEAL", exists: true, role: "27-node PBFT" },
  { id: "LEDGER", exists: true, role: "Local Core HMAC + Merkle" },
  { id: "EVIDENCE", exists: true, role: "Exportable packet" },
  { id: "AUTH", exists: true, role: "Okta OIDC RS256" },
] as const;

export function money(n: number, currency = "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}
