/**
 * DATA SOURCES — only sources this site actually calls or bundles.
 * REFERENCE = a dated, licensed reference average (shown with its period), not a live feed.
 * No vendor names: nothing here stands in for a product VerityX does not connect to.
 */
export type AdapterHealth = "LIVE" | "REFERENCE" | "STALE" | "DOWN";

export type AdapterCard = {
  id: string;
  name: string;
  status: AdapterHealth;
  protocol: string;
  path: string;
  detail: string;
};

export function buildAdapterCards(input: {
  prices: AdapterHealth;
  gleif: AdapterHealth;
  sanctions: AdapterHealth;
  news?: AdapterHealth;
}): AdapterCard[] {
  return [
    {
      id: "prices",
      name: "Reference prices",
      status: input.prices,
      protocol: "World Bank Pink Sheet (monthly) · USGS MCS (annual) · ECB FX (daily)",
      path: "/sources",
      detail:
        "Licensed public reference averages with their period and attribution — not spot quotes, not a price-agency assessment. Buyers add their own licensed benchmark on a check.",
    },
    {
      id: "gleif",
      name: "Legal entity identity",
      status: input.gleif,
      protocol: "GLEIF LEI API",
      path: "/sources",
      detail: "Supplier names resolved to their Legal Entity Identifier records.",
    },
    {
      id: "sanctions",
      name: "Sanctions list",
      status: input.sanctions,
      protocol: "UN Security Council Consolidated List",
      path: "/sources",
      detail: "Name screening. A match prompts human review; it is not a sanctions determination.",
    },
    {
      id: "media",
      name: "Media risk",
      status: input.news ?? "STALE",
      protocol: "GDELT headlines",
      path: "/sources",
      detail: "Recent headlines on the supplier, classified by topic. Says so when headlines could not be checked.",
    },
  ];
}

/** First paint before the live check lands: references are bundled, everything fetched starts STALE. */
export function seedAdapterCards(): AdapterCard[] {
  return buildAdapterCards({ prices: "REFERENCE", gleif: "STALE", sanctions: "STALE", news: "STALE" });
}
