import { CORE_SHA, CORE_VERSION } from "./core-ledger.ts";

export type FieldCell = "native" | "module" | "analog" | "live" | "none";

export type CompetitorClass = {
  id: string;
  names: string;
  category: string;
  they: string;
  we: string;
  contrast: string;
  analog?: string;
  analogPath?: string;
  adapterId?: "sap" | "argus" | "screen" | "circulor" | "pbft" | "okta" | "ecovadis" | "prewave";
};

export type CapabilityRow = {
  id: string;
  label: string;
  s2p: FieldCell;
  esg: FieldCell;
  trace: FieldCell;
  vx: FieldCell;
};

export const VERITYX_WEDGE =
  "Verify sits on the purchase-order line for magnetics and rare earths. Price consensus, sanctions, mineral custody, a permissioned seal, and an HMAC core share one evidence packet. A BLOCK is recorded only after a human approves it.";

export const HONEST_GAPS = [
  "Siemens S/4HANA and Ariba tenants are not connected. The desk runs a live OData-shaped store with CSRF, ETag, BAPI_PO_CHANGE, IDoc ORDERS05, and Ariba sourcing v2 RFQs on this host.",
  "Argus Metals is not subscribed. NdPr and Dy prints are Argus-shaped ticks from MP Materials and Westmetall LME cash.",
  "EcoVadis and Prewave APIs are paid. The analogs on this host are a 21-criteria scorecard from GLEIF + news and a media-risk heat from RSS on the same PO. RapidRatings stays listed-tape FHR, with opacity when the name is unlisted.",
  "Circulor and Minespider vendor tenants are not subscribed. Lots and batch passports are hashed ledgers on this host (EU DPP + GS1 Digital Link shape).",
  "The 27-voter PBFT cluster is in-process (quorum 19, two Byzantine). It is not 27 separate machines.",
  "Okta Workforce is not provisioned. The desk issues Okta-shaped RS256 JWTs with JWKS.",
  "Local Core HMAC + Merkle is real and bit-identical to verityx-local-core v" +
    CORE_VERSION +
    " (" +
    CORE_SHA.slice(0, 7) +
    ").",
];

export const FIELD: CompetitorClass[] = [
  {
    id: "s2p",
    names: "SAP Ariba, Coupa, GEP SMART, Ivalua",
    category: "Source-to-pay",
    they: "Own the purchase order, intake, and supplier master. ESG, risk, and traceability are modules or partner add-ons sitting beside the PO, not on it.",
    we: "Verify runs on the PO path. An analog OData HOLD/RELEASE posts back onto the same document the buyer is looking at, with CSRF, ETag, and an IDoc trail.",
    contrast:
      "They remain the system of record for procurement. We do not replace Ariba or Coupa. We do not pretend a Siemens tenant is wired. We prove the line item before it clears.",
    analog: "SAP OData tenant + Ariba sourcing v2",
    analogPath: "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV",
    adapterId: "sap",
  },
  {
    id: "esg",
    names: "EcoVadis",
    category: "ESG scorecard",
    they: "EcoVadis sells questionnaire scorecards and medals on an annual cadence, scored by analysts against 21 criteria in four themes. Strong, paid, and off the purchase order.",
    we: "Every supplier on the magnetics tape gets a 21-criteria EcoVadis-shaped scorecard in the same verify pass as price consensus and mineral custody. NACE 27 weights, published medal cutoffs, GLEIF + news evidence.",
    contrast:
      "We do not have their questionnaire network or analyst desk. This is the public methodology scored from GLEIF, UN/OpenSanctions, news RSS, and listing tape — not an EcoVadis tenant, and not a fake medal.",
    analog: "EcoVadis scorecard analog",
    analogPath: "/ecovadis/api/v2/scorecards",
    adapterId: "ecovadis",
  },
  {
    id: "prewave",
    names: "Prewave",
    category: "Media and disruption risk",
    they: "Prewave watches media and disruption events across the supplier graph and sells a heat score off the PO. Strong, paid, and built for a control-tower, not a single line item.",
    we: "The same PO that carries the EcoVadis analog also carries a Prewave-shaped media-risk heat: RSS incidents classified as disruption, ESG, labor, compliance, or quality, sealed into the packet.",
    contrast:
      "We do not ingest their firehose or analyst coverage. Heat here is live news RSS on the magnetics suppliers Elena is buying — named on the field, not hidden behind SCREEN.",
    analog: "Prewave media-risk analog",
    analogPath: "/prewave/api/v1/risks",
    adapterId: "prewave",
  },
  {
    id: "ntier",
    names: "Resilinc, Everstream, Sayari",
    category: "N-tier map and disruption",
    they: "Map multi-tier supply, flag site-level disruption, and (Sayari) stitch corporate and trade networks. Built for operations and investigations, not a single PO decision.",
    we: "Each scenario carries an n-tier map with country, lat/lng, and a custody evidence string that seals into the packet.",
    contrast:
      "We do not ingest their event firehoses or beneficial-ownership graphs. The map is the magnetics chain we actually buy on — not a global control-tower.",
  },
  {
    id: "minerals",
    names: "Circulor, Minespider, Everledger",
    category: "Mineral passport and custody",
    they: "Circulor runs mass-balance lots and battery passports. Minespider issues due-diligence batch certificates. Everledger proved luxury and diamond provenance on a chain.",
    we: "A Circulor-shaped hashed lot and a Minespider SHA-256 batch passport are written for every seeded PO, with EU DPP and GS1 Digital Link identifiers in the packet.",
    contrast:
      "Vendor tenants are not subscribed. The ledgers are protocol-complete on this host — chain, events, certificate hash — not their production networks.",
    analog: "Circulor lots + Minespider batches",
    analogPath: "/api/circulor/lots",
    adapterId: "circulor",
  },
  {
    id: "financial",
    names: "RapidRatings, Dun & Bradstreet",
    category: "Financial health",
    they: "RapidRatings scores private-company FHR from financials. D&B is the identity and PAYDEX backbone most S2P suites already license.",
    we: "Listed names get a RapidRatings-shaped FHR from public tape. Unlisted names raise an opacity flag instead of a fake score.",
    contrast:
      "We will not invent a private-company rating. Opacity is the honest signal. D&B is not a tenant here.",
    analog: "RapidRatings FHR analog",
    analogPath: "/api/adapters",
    adapterId: "screen",
  },
  {
    id: "evidence",
    names: "Sourcemap, Altana",
    category: "Evidence and trade graph",
    they: "Sourcemap builds mapped, exportable evidence packs for due diligence. Altana reconstructs dark supply chains from trade data.",
    we: "One JSON (and OS PDF) packet: PO, consensus, screens, lots, PBFT seal, HMAC inclusion. Built to leave the desk.",
    contrast:
      "We do not reconstruct the world's trade graph. The packet covers the PO in front of Elena, not every lane in the North Sea.",
  },
  {
    id: "oracles",
    names: "Argus Metals, Fastmarkets, LME / Westmetall",
    category: "Price oracles",
    they: "Paid assessments and exchange cash/3M prints that procurement treats as the market. Argus is the REE desk standard.",
    we: "LME cash from Westmetall, ECB FX, listed REE tape, and an Argus-shaped NdPr/Dy SSE socket on the same verify pass. MAD-filter poisoned prints before consensus.",
    contrast:
      "Argus is not subscribed. NdPr/Dy are derived, labelled, and never sold as an Argus print. Westmetall LME cash is live.",
    analog: "REE desk socket",
    analogPath: "/api/oracle/stream",
    adapterId: "argus",
  },
  {
    id: "consensus",
    names: "Hyperledger Fabric samples",
    category: "Permissioned consensus",
    they: "Permissioned ledgers for supply-chain pilots. Public PoW chains are the wrong trust model for a PO.",
    we: "A 27-voter PBFT (f=8, quorum 19) seals the packet with delayed envelopes and HMAC MACs. Two voters are Byzantine on purpose.",
    contrast:
      "This is an in-process cluster, not 27 racks. The protocol is real; the topology is honest about being hosted here.",
    analog: "PBFT cluster",
    analogPath: "/api/pbft",
    adapterId: "pbft",
  },
  {
    id: "idp",
    names: "Okta Workforce Identity",
    category: "Workforce identity",
    they: "The enterprise IdP. Password, SSO, MFA, lifecycle. What Siemens already runs.",
    we: "Desk seats issue Okta-shaped OIDC RS256 tokens, with discovery and JWKS, so the analog SAP path sees a workforce bearer.",
    contrast:
      "Okta Workforce is not provisioned. Google/X sign-in is for the OS and owner command, not a substitute Okta tenant.",
    analog: "OIDC workforce IdP",
    analogPath: "/oauth2/default/.well-known/openid-configuration",
    adapterId: "okta",
  },
  {
    id: "core",
    names: "verityx-local-core",
    category: "Continuity",
    they: "Our own library. HMAC-SHA256 append-only log and domain-separated Merkle inclusion, independent of the desk UI.",
    we: `The live doctor on /core is bit-identical to v${CORE_VERSION} (${CORE_SHA.slice(0, 7)}). Fail-closed replay. No public write route.`,
    contrast:
      "Not a mesh peer and not a public blockchain. Continuity is a signed log you can take offline.",
    analog: "Local Core doctor",
    analogPath: "/core",
  },
];

export const CAPABILITIES: CapabilityRow[] = [
  { id: "po", label: "Verify on the PO line", s2p: "module", esg: "none", trace: "none", vx: "native" },
  { id: "hold", label: "HOLD / RELEASE writeback", s2p: "native", esg: "none", trace: "none", vx: "analog" },
  { id: "esg", label: "ESG scorecard on the supplier", s2p: "module", esg: "native", trace: "none", vx: "analog" },
  { id: "media", label: "Media / controversy risk", s2p: "module", esg: "native", trace: "none", vx: "analog" },
  { id: "map", label: "N-tier map with evidence", s2p: "module", esg: "module", trace: "module", vx: "live" },
  { id: "dpp", label: "Mineral passport / EU DPP", s2p: "none", esg: "none", trace: "native", vx: "analog" },
  { id: "fhr", label: "Financial health / opacity", s2p: "module", esg: "none", trace: "none", vx: "analog" },
  { id: "packet", label: "Exportable sealed packet", s2p: "none", esg: "none", trace: "module", vx: "native" },
  { id: "price", label: "Price consensus on the PO", s2p: "none", esg: "none", trace: "none", vx: "live" },
  { id: "pbft", label: "Permissioned seal", s2p: "none", esg: "none", trace: "module", vx: "live" },
  { id: "hmac", label: "HMAC + Merkle continuity", s2p: "none", esg: "none", trace: "none", vx: "native" },
  { id: "block", label: "Human-approved BLOCK", s2p: "none", esg: "none", trace: "none", vx: "native" },
];

export const CELL_LABEL: Record<FieldCell, string> = {
  native: "Native",
  module: "Module",
  analog: "Analog",
  live: "Live",
  none: "—",
};

/** Compact takeaways — same shape the portal `/api/competition` always returned. */
export function competitionNotes(): { name: string; take: string }[] {
  return FIELD.map((row) => ({ name: row.names, take: row.we }));
}

export function fieldIdForAdapter(adapterId: string): string | undefined {
  return FIELD.find((r) => r.adapterId === adapterId)?.id;
}

export function provePath(row: CompetitorClass): "/desk" | "/core" {
  return row.analogPath === "/core" ? "/core" : "/desk";
}

export type DeskTab = "pipe" | "sap" | "mkt" | "screen" | "prov" | "seal" | "core";

export function adapterIdFromProve(prove?: string): string | undefined {
  if (!prove) return undefined;
  const row = FIELD.find((r) => r.id === prove);
  return row?.adapterId ?? (FIELD.some((r) => r.adapterId === prove) ? prove : prove);
}

export function deskTabForProve(prove?: string): DeskTab {
  const adapter = adapterIdFromProve(prove);
  switch (adapter) {
    case "sap":
      return "sap";
    case "argus":
      return "mkt";
    case "screen":
    case "ecovadis":
    case "prewave":
      return "screen";
    case "circulor":
      return "prov";
    case "pbft":
      return "seal";
    case "okta":
      return "pipe";
    default:
      return "pipe";
  }
}

export function proveSearch(row: CompetitorClass): { prove: string } | undefined {
  if (row.analogPath === "/core") return undefined;
  return { prove: row.adapterId ?? row.id };
}

export function proveLabel(prove?: string): string | undefined {
  if (!prove) return undefined;
  const row = FIELD.find((r) => r.id === prove || r.adapterId === prove);
  return row?.analog ?? row?.names;
}

export function competitionPayload() {
  return {
    wedge: VERITYX_WEDGE,
    honest: HONEST_GAPS,
    field: FIELD,
    capabilities: CAPABILITIES,
    notes: competitionNotes(),
    core: { version: CORE_VERSION, sha: CORE_SHA },
  };
}
