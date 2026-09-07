export type AdapterHealth = "LIVE" | "STALE" | "DOWN";

export type AdapterCard = {
  id: string;
  name: string;
  status: AdapterHealth;
  protocol: string;
  path: string;
  detail: string;
};

export function buildAdapterCards(input: {
  sapCount: number;
  aribaCount?: number;
  argus: AdapterHealth;
  gleif: AdapterHealth;
  sanctions: AdapterHealth;
  opensanctions?: AdapterHealth;
  news?: AdapterHealth;
  pbftSeq: number;
  pbftCommitted?: boolean;
  circulorLots: number;
  minespiderBatches?: number;
  okta: AdapterHealth;
}): AdapterCard[] {
  const screen: AdapterHealth =
    input.gleif === "LIVE" || input.sanctions === "LIVE" || input.opensanctions === "LIVE"
      ? "LIVE"
      : input.gleif === "DOWN" && input.sanctions === "DOWN"
        ? "DOWN"
        : "STALE";
  const news = input.news ?? "STALE";
  const ecovadis: AdapterHealth =
    input.gleif === "LIVE" || news === "LIVE" ? "LIVE" : input.gleif === "DOWN" && news === "DOWN" ? "DOWN" : "STALE";
  const prewave: AdapterHealth = news === "LIVE" ? "LIVE" : news === "DOWN" ? "DOWN" : "STALE";
  const aribaCount = input.aribaCount ?? input.sapCount;
  const minespiderBatches = input.minespiderBatches ?? input.circulorLots;
  return [
    {
      id: "sap",
      name: "SAP OData tenant",
      status: input.sapCount > 0 ? "LIVE" : "STALE",
      protocol: "API_PURCHASEORDER_PROCESS_SRV · BAPI_PO_CHANGE · IDoc ORDERS05 · Ariba sourcing v2",
      path: "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV",
      detail: `${input.sapCount} purchase orders · ${aribaCount} Ariba RFQs. CSRF, ETag, HOLD/RELEASE, sourcing events. Hosted here — not Siemens S/4HANA / Ariba.`,
    },
    {
      id: "argus",
      name: "REE desk socket",
      status: input.argus,
      protocol: "SSE tick · NdPr / Dy from listed REE tape",
      path: "/api/oracle/stream",
      detail: "Live Argus-shaped prints from MP + Westmetall LME. Argus Metals is not subscribed.",
    },
    {
      id: "ecovadis",
      name: "EcoVadis scorecard",
      status: ecovadis,
      protocol: "21-criteria · 4 themes · NACE 27 weights",
      path: "/ecovadis/api/v2/scorecards",
      detail:
        "Public methodology-shaped medals from GLEIF identity, UN/OpenSanctions, news RSS, and listing tape. EcoVadis is not a tenant.",
    },
    {
      id: "prewave",
      name: "Prewave media heat",
      status: prewave,
      protocol: "RSS incidents · heat on the PO",
      path: "/prewave/api/v1/risks",
      detail: "Media-risk heat and alerts from live news RSS on the same purchase order. Prewave is not a tenant.",
    },
    {
      id: "screen",
      name: "SCREEN stack",
      status: screen,
      protocol: "GLEIF · OpenSanctions · UN · RapidRatings FHR",
      path: "/api/adapters",
      detail: "Identity, sanctions, and listed-tape FHR. RapidRatings stays honest opacity when the name is unlisted.",
    },
    {
      id: "circulor",
      name: "Circulor lot ledger",
      status: input.circulorLots > 0 ? "LIVE" : "STALE",
      protocol: "Mass-balance custody · Minespider SHA-256 batch · EU DPP · GS1 Digital Link",
      path: "/api/circulor/lots",
      detail: `${input.circulorLots} lots · ${minespiderBatches} Minespider batches on the hash chain. Circulor / Minespider vendors are not subscribed.`,
    },
    {
      id: "pbft",
      name: "PBFT cluster",
      status: input.pbftSeq > 0 ? "LIVE" : "STALE",
      protocol: "27 hosts · f=8 · quorum 2f+1=19 · HMAC MACs",
      path: "/api/pbft",
      detail: input.pbftCommitted
        ? `Seq ${input.pbftSeq} committed over the in-process network. Not 27 separate machines.`
        : "27 independent voters, delayed envelopes, view 0. Awaiting first seal.",
    },
    {
      id: "okta",
      name: "OIDC workforce IdP",
      status: input.okta,
      protocol: "Okta-shaped RS256 · JWKS · password grant",
      path: "/oauth2/default/.well-known/openid-configuration",
      detail: "Live authorize / token / userinfo / keys on this host. Okta Workforce is not provisioned.",
    },
  ];
}

/** Honest first paint: hosted analogs LIVE, market-dependent SCREEN/Argus STALE until feeds land. */
export function seedAdapterCards(): AdapterCard[] {
  return buildAdapterCards({
    sapCount: 8,
    argus: "STALE",
    gleif: "STALE",
    sanctions: "STALE",
    opensanctions: "STALE",
    news: "STALE",
    pbftSeq: 1,
    pbftCommitted: true,
    circulorLots: 8,
    okta: "LIVE",
  });
}
