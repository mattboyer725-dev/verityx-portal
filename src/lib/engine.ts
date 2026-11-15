import type { LiveBundle } from "@/lib/feeds";
import type { RefKey } from "@/lib/reference-prices";
import type { LivePrices } from "@/lib/should-cost";

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



/** The checks a purchase-order verify runs today. Each one is real on this host. */
export const AGENTS = [
  { id: "ORACLE", exists: true, role: "World Bank + USGS reference averages, ECB FX" },
  { id: "CONSENSUS", exists: true, role: "MAD outlier filter + coefficient of variation" },
  { id: "SHOULD-COST", exists: true, role: "Material cost model from licensed references" },
  { id: "SCREEN", exists: true, role: "GLEIF identity + UN list + GDELT media risk" },
  { id: "LEDGER", exists: true, role: "HMAC-SHA256 append-only log + Merkle inclusion" },
  { id: "SEAL", exists: true, role: "Ed25519 receipt over the ledger entry" },
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
