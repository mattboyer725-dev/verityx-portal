import type { LiveBundle } from "@/lib/feeds";
import { scaleByReference, SUPPLIER_GLEIF } from "@/lib/feeds";
import type { RefKey } from "@/lib/reference-prices";
import {
  appendCoreEvents,
  type CoreEvent,
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
import { recordCirculorLot } from "@/lib/circulor";
import { evaluateDecision, type Evaluation } from "@/lib/verityx/decision-engine";
import { shouldCost, type LivePrices, type ShouldCost } from "@/lib/should-cost";
import type { EvidenceItem } from "@/lib/verityx/types";

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
  /** A licensed reference series the sample prices move with; none = prices stay as sampled. */
  refSeries?: RefKey;
  /** The reference value when the sample prices were written. */
  refBaseline?: number;
};

export const BUYER = {
  name: "Elena Hartmann",
  title: "Head of Magnetics Procurement",
  email: "elena.hartmann@siemensgamesa.example",
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
      "NdPr oxide print (sample)",
      "Regional NdFeB print (sample)",
      "Internal last-buy SAP (sample)",
      "Magnet cost index (sample)",
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
    observationSources: ["NdPr oxide print (sample)", "Regional alloy print (sample)", "Last SAP goods receipt (sample)", "Trader offer (sample)"],
    assumptions: ["Single-origin melt lot"],
    tenant: "SIEMENS-GAMESA",
    commodity: "NdPr alloy",
    po: "4500188011",
    plant: "Hamburg, DE",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-11-02",
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
    observationSources: ["Copper · World Bank monthly avg (scaled)", "Mill quote (sample)", "Supplier offer (sample)", "Last SAP goods receipt (sample)"],
    assumptions: ["EU origin claimed"],
    tenant: "SIEMENS-GAMESA",
    commodity: "Cu CTC",
    po: "4500191044",
    plant: "Hull, GB",
    buyer: "Mads Sørensen",
    currency: "EUR",
    due: "2026-09-28",
    refSeries: "copper",
    refBaseline: 14508,
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
    observationSources: ["Plate mill index print (sample)", "Mill quote (sample)", "EU plate index (sample)", "SAP last-buy (sample)"],
    assumptions: ["EU mill of origin", "EN 10025-2"],
    tenant: "SIEMENS-GAMESA",
    commodity: "S355 plate",
    po: "4500193301",
    plant: "Le Havre, FR",
    buyer: "Claire Moreau",
    currency: "EUR",
    due: "2026-10-30",
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
    observationSources: ["Resin index print (sample)", "Supplier offer (sample)", "Peer resin offer (sample)", "Last SAP goods receipt (sample)"],
    assumptions: ["Epoxy + hardener kit"],
    tenant: "SIEMENS-GAMESA",
    commodity: "Epoxy resin kit",
    po: "4500194418",
    plant: "Aalborg, DK",
    buyer: "Ingrid Dahl",
    currency: "EUR",
    due: "2026-09-18",
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
    observationSources: ["Distributor list price (sample)", "Distributor print (sample)", "Last SAP goods receipt (sample)", "Peer OEM price (sample)"],
    assumptions: ["Automotive-grade dual-use screen required"],
    tenant: "SIEMENS-GAMESA",
    commodity: "IGBT module",
    po: "4500195520",
    plant: "Zamudio, ES",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-12-01",
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
    observationSources: ["Dy oxide print (sample)", "Regional Dy metal print (sample)", "Internal last-buy SAP (sample)", "Trader offer EU bonded (sample)", "Supplier quote (unverified)"],
    assumptions: ["Heavy REE, export-licence sensitive", "H-grade NdFeB dopant"],
    tenant: "SIEMENS-GAMESA",
    commodity: "Dy metal",
    po: "4500196604",
    plant: "Brande, DK",
    buyer: "Elena Hartmann",
    currency: "EUR",
    due: "2026-11-20",
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
    observationSources: ["Plate mill index print (sample)", "Mill quote (sample)", "Peer mill offer (sample)", "Last SAP goods receipt (sample)"],
    assumptions: ["EU mill of origin", "EN 10106"],
    tenant: "SIEMENS-GAMESA",
    commodity: "NGO electrical steel",
    po: "4500194410",
    plant: "Cuxhaven, DE",
    buyer: "Mads Sørensen",
    currency: "EUR",
    due: "2026-10-08",
    tiers: [
      { tier: 0, role: "Iron ore", name: "LKAB Kiruna", country: "SE", evidence: "origin cert", lat: 67.851, lng: 20.198 },
      { tier: 1, role: "Mill", name: "thyssenkrupp Steel Europe", country: "DE", evidence: "coil heat", lat: 51.492, lng: 6.775 },
      { tier: 2, role: "OEM plant", name: "SGRE Cuxhaven", country: "DE", evidence: "SAP GR", lat: 53.861, lng: 8.694 },
    ],
    screens: { exportPermit: "CLEAR", esg: "LOW", financial: "LOW", dualUse: "CLEAR" },
  },
];

export { consensusAgent, type Consensus } from "@/lib/consensus";
import { consensusAgent, type Consensus } from "@/lib/consensus";

function liveScenario(scenario: Scenario, live?: LiveBundle): Scenario {
  if (!live) return scenario;
  const obs = scenario.observations.map((v) => scaleByReference(v, scenario.refSeries, scenario.refBaseline));
  const proposed = scaleByReference(scenario.proposed, scenario.refSeries, scenario.refBaseline);
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
    sources: ["SAP S/4HANA OData", "Ariba RFQ", "Reference prices (World Bank, USGS, ECB)", "GLEIF"],
    po: scenario.po,
    sap,
    ariba,
    ted: live?.ted ?? [],
    observations: scenario.observations,
    ts: new Date().toISOString(),
  };
}

export function oracleAgent(scenario: Scenario, live?: LiveBundle) {
  // Reference averages enter the packet with their period and attribution; only
  // ECB FX is a same-day figure. Nothing here is a spot quote.
  const metalsUp = live?.health?.metals === "REFERENCE";
  const reUp = live?.health?.rareEarths === "REFERENCE";
  const fxUp = live?.health?.fx === "LIVE";
  const prints = scenario.observations.map((value, i) => ({
    source: scenario.observationSources[i] || `oracle-${i + 1}`,
    value,
    outlier: false,
    live: false,
  }));
  if (metalsUp && live?.metals && scenario.refSeries === "copper") {
    prints.unshift({
      source: `Copper ${live.metals.copperUsdMt.toFixed(0)} USD/t · World Bank ${live.metals.periodLabel}`,
      value: scaleByReference(scenario.observations[0], scenario.refSeries, scenario.refBaseline),
      outlier: false,
      live: true,
    });
  }
  return {
    agent: "ORACLE" as const,
    prints,
    metals: metalsUp ? live?.metals || null : null,
    rareEarths: reUp ? live?.rareEarths || null : null,
    fx: fxUp ? live?.fx || null : null,
    pattern:
      [metalsUp && `World Bank ${live?.metals.periodLabel}`, reUp && `USGS ${live?.rareEarths.periodLabel}`, fxUp && "ECB FX"]
        .filter(Boolean)
        .join(" + ") || "Reference prices unavailable — scenario samples only",
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

export async function provenanceAgent(scenario: Scenario) {
  const lot = await recordCirculorLot({
    id: scenario.id,
    po: scenario.po,
    commodity: scenario.commodity,
    plant: scenario.plant,
    tiers: scenario.tiers,
  });
  return {
    agent: "PROVENANCE" as const,
    pattern: "Mass-balance lot custody + batch passport hash + EU DPP identifiers",
    commodity: scenario.commodity,
    dppId: lot.dppId,
    gs1: lot.gs1,
    circulorLot: lot.lot,
    minespiderBatch: lot.minespiderBatch,
    circulor: lot,
    tiers: scenario.tiers,
    custody: lot.events.map((e) => ({
      step: e.seq,
      from: e.from,
      event: `${e.event} · ${e.evidence}`,
      evidence: e.evidence,
      country: e.country,
      lat: e.lat,
      lng: e.lng,
      at: e.at,
      hash: e.hash,
    })),
  };
}

export function screenAgent(scenario: Scenario, live?: LiveBundle) {
  const gleifKey = SUPPLIER_GLEIF[scenario.supplier] || scenario.supplier;
  const gleif = live?.gleif[gleifKey] || null;
  const hit = live?.sanctions.hits.find((h) => scenario.supplier.toUpperCase().includes(h.name.split(" ")[0].toUpperCase()));
  const eco = live?.ecovadis[scenario.supplier] || live?.ecovadis[gleifKey];
  const pre = live?.prewave[scenario.supplier] || live?.prewave[gleifKey];
  const rapid = live?.rapid[scenario.supplier] || live?.rapid[gleifKey];
  const alerts = [
    scenario.screens.exportPermit !== "CLEAR" && { type: "EXPORT", text: "China rare-earth export permit lag" },
    eco && eco.score < 50 && { type: "ESG", text: `ESG scorecard ${eco.medal} · ${eco.score}` },
    pre && (pre.level === "HIGH" || pre.level === "CRITICAL") && { type: "MEDIA", text: `Media risk ${pre.level} · ${pre.headlines[0] || "media risk"}` },
    pre && pre.checked === false && { type: "MEDIA", text: "Media headlines could not be checked this pass" },
    rapid && rapid.fhr < 50 && { type: "FIN", text: `Financial health ${rapid.fhr} · ${rapid.outlook}` },
    scenario.screens.dualUse !== "CLEAR" && { type: "DUAL_USE", text: "Dual-use / export-control watch" },
    hit?.matched && { type: "SANCTIONS", text: `UN consolidated hit on ${hit.name}` },
  ].filter(Boolean) as { type: string; text: string }[];
  return {
    agent: "SCREEN" as const,
    pattern: "ESG scorecard + media-risk heat + financial health + GLEIF + UN",
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
    financial: rapid?.listed && rapid.symbol
      ? { symbol: rapid.symbol, price: 0, currency: "", changePct: 0, source: rapid.source }
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
    pattern: `verityx-local-core v${LOCAL_CORE.version} · HMAC-SHA256 append-only + Merkle inclusion`,
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
    pattern: "Workforce OIDC · RS256 JWT",
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

function advisoryFromScreen(
  scenario: Scenario,
  screen: ReturnType<typeof screenAgent>,
  live?: LiveBundle,
): Evaluation | null {
  const observedAt = (live?.sanctions.ts || new Date().toISOString()).slice(
    0,
    10,
  );
  const items: EvidenceItem[] = [];
  if (screen.sanctions.matched) {
    items.push({
      id: "sanctions",
      kind: "sanctions_screening",
      title: `UN screening · ${scenario.supplier}`,
      sourceName: "UN Consolidated List",
      sourceUrl: "https://scsanctions.un.org/",
      observedAt,
      excerpt: screen.alerts.find((a) => a.type === "SANCTIONS")?.text || "Named sanctions match on supplier.",
      confidence: "high",
    });
  }
  for (const a of screen.alerts.filter((x) => x.type === "MEDIA")) {
    items.push({
      id: `media-${items.length}`,
      kind: "media_report",
      title: a.text,
      sourceName: "Media-risk heat · headlines via the GDELT Project",
      sourceUrl: "https://www.gdeltproject.org/",
      observedAt,
      excerpt: a.text,
      confidence: "medium",
    });
  }
  if (screen.financial) {
    items.push({
      id: "tape",
      kind: "financial_signal",
      title: `${screen.financial.symbol} ${screen.financial.price}`,
      sourceName: screen.financial.source || "Yahoo Finance",
      sourceUrl: "https://finance.yahoo.com/",
      observedAt,
      excerpt: `${scenario.supplier} listed tape ${screen.financial.symbol} ${screen.financial.changePct.toFixed(2)}%.`,
      confidence: "medium",
    });
  }
  if (!items.length) {
    items.push({
      id: "po",
      kind: "operational_event",
      title: `${scenario.po} ${scenario.title}`,
      sourceName: "SAP analog PO tape",
      sourceUrl: "",
      observedAt,
      excerpt: `${scenario.supplier} · ${scenario.commodity} · proposed ${scenario.proposed} ${scenario.currency}.`,
      confidence: "medium",
    });
  }
  const ev = evaluateDecision(items);
  return "error" in ev ? null : ev;
}

export type PipelineResult = {
  scenario: Scenario;
  ingest: ReturnType<typeof ingestAgent>;
  oracle: ReturnType<typeof oracleAgent>;
  consensus: Consensus;
  risk: ReturnType<typeof riskAgent>;
  provenance: Awaited<ReturnType<typeof provenanceAgent>>;
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
  advisory: Evaluation | null;
  shouldCost: ShouldCost;
  /** The two ledger entries this verify sealed, for receipts. */
  sealed?: { artifact: CoreEvent; decision: CoreEvent };
};

/** Prices for SHOULD-COST: licensed reference averages, each with its basis. No fallback constants. */
export function shouldCostPrices(live?: LiveBundle): LivePrices {
  const h = live?.health ?? {};
  const re = h.rareEarths === "REFERENCE" ? live?.rareEarths : undefined;
  const mt = h.metals === "REFERENCE" ? live?.metals : undefined;
  return {
    ndprOxideUsdKg: re?.ndprUsdKg || undefined,
    dyOxideUsdKg: re?.dyUsdKg || undefined,
    copperUsdT: mt?.copperUsdMt || undefined,
    usdEur: h.fx === "LIVE" ? live?.fx?.usdEur : undefined,
    basis: {
      ...(re ? { ndprOxideUsdKg: { kind: "reference-annual" as const, label: `USGS NdPr oxide ${re.periodLabel}` } } : {}),
      ...(re ? { dyOxideUsdKg: { kind: "reference-annual" as const, label: `USGS Dy oxide ${re.periodLabel}` } } : {}),
      ...(mt ? { copperUsdT: { kind: "reference-monthly" as const, label: `World Bank copper ${mt.periodLabel}` } } : {}),
    },
    asOf: live?.fetchedAt,
  };
}

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
  const provenance = await provenanceAgent(scenario);
  const screen = screenAgent(scenario, live);
  const compliance = complianceAgent(scenario);
  const dual = dualSourceAgent(scenario, consensus);
  const seal = await sealAgent(scenario, consensus);
  const advisory = advisoryFromScreen(scenario, screen, live);
  const fair = shouldCost(scenario.commodity, shouldCostPrices(live));
  // One unit: the seal artifact and its decision land together or not at all.
  const [artifact, decision] = await appendCoreEvents([
    {
      type: "artifact.record",
      payload: {
        title: `${scenario.id} ${scenario.po}`,
        location: seal.hash,
        kind: "po-seal",
        notes: `${risk.action} ${consensus.verdict}`,
      },
      actor: BUYER.email,
    },
    {
      type: "decision.record",
      payload: {
        title: scenario.po,
        choice: risk.action,
        context: `${scenario.title} · ${scenario.supplier}${
          fair.ok ? ` · should-cost ${fair.perKg.low}–${fair.perKg.high} ${fair.currency}/kg (mid ${fair.perKg.mid})` : ""
        }`,
      },
      actor: BUYER.email,
    },
  ]);
  const ledger = await ledgerAgent();
  const merkle = await merkleAgent(artifact.hash);
  const auth = authStamp();
  const tape =
    scenario.refSeries === "copper" && oracle.metals
      ? `Cu ${oracle.metals.copperUsdMt.toFixed(0)} (World Bank ${oracle.metals.periodLabel})`
      : /NdFeB|NdPr|Dy/i.test(scenario.commodity) && oracle.rareEarths
        ? `REE ref USGS ${oracle.rareEarths.periodLabel} (context)`
        : "sample prices";
  return {
    shouldCost: fair,
    sealed: { artifact, decision },
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
    advisory,
    message: `${risk.action.replace("_", " ")} · ${consensus.verdict} · ${tape} · PBFT ${seal.pbft.commitOk}/${PBFT_N} · core ${ledger.depth} HMAC · OS ${advisory?.proposedAction ?? "MONITOR"}.`,
  };
}

export { competitionNotes } from "./competition";

export const AGENTS = [
  { id: "INGEST", exists: true, role: "SAP S/4 + Ariba" },
  { id: "ORACLE", exists: true, role: "World Bank + USGS references + ECB FX" },
  { id: "CONSENSUS", exists: true, role: "CoV + MAD filter" },
  { id: "RISK", exists: true, role: "Anomaly vs proposed" },
  { id: "PROVENANCE", exists: true, role: "Lot custody + batch passport" },
  { id: "SCREEN", exists: true, role: "ESG + media risk + financial health" },
  { id: "COMPLIANCE", exists: true, role: "CBAM / dual-use gate" },
  { id: "SEAL", exists: true, role: "27-node PBFT" },
  { id: "LEDGER", exists: true, role: "Local Core HMAC + Merkle" },
  { id: "EVIDENCE", exists: true, role: "Exportable packet" },
  { id: "AUTH", exists: true, role: "OIDC RS256" },
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
