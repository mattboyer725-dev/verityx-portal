/**
 * SHOULD-COST — what a kilogram of this material ought to cost, built up from
 * what it is made of, before (or regardless of) any supplier quote.
 *
 *   per kg = Σ(mass share × element price ÷ oxide→metal yield)   materials
 *          + oxide→metal conversion                               refining
 *          ÷ (1 − process loss)                                   yield
 *          + forming / magnet-making cost                         processing
 *          × (1 + supplier margin)                                margin
 *
 * Every number that is not a live price is an ASSUMPTION with a low / mid /
 * high value, shown to the buyer and editable. The low bound takes every
 * assumption at its cheapest end, the high bound at its dearest, so the range
 * is honest about what is not known. A model only runs when every price it
 * needs is present: it never prices on a fallback constant.
 *
 * Every price carries a BASIS: the buyer's own licensed benchmark, a monthly
 * reference average, or an annual reference average. A result built on an
 * annual average is INDICATIVE — context, not grounds for a verdict.
 *
 * Self-contained (no imports) so node --test can load it and the client can
 * recompute when the buyer edits an assumption.
 */

export type Band = { low: number; mid: number; high: number };
export type Assumption = { key: string; label: string; unit: string; band: Band; note: string };

export type PriceKey = "ndprOxideUsdKg" | "dyOxideUsdKg" | "copperUsdT";
/** benchmark = the buyer's own licensed price; reference-* = licensed public averages. */
export type PriceBasisKind = "benchmark" | "reference-monthly" | "reference-annual";
export type PriceBasis = { kind: PriceBasisKind; label: string };

export type LivePrices = {
  /** NdPr oxide, USD/kg. */
  ndprOxideUsdKg?: number;
  /** Dy oxide, USD/kg. */
  dyOxideUsdKg?: number;
  /** Copper, USD per tonne. */
  copperUsdT?: number;
  /** Where each price came from. A price without a basis is treated as the caller's own benchmark. */
  basis?: Partial<Record<PriceKey, PriceBasis>>;
  /** USD → EUR. */
  usdEur?: number;
  /** ISO time the prices were fetched. */
  asOf?: string;
};

export type ModelId = "ndfeb" | "ndpr-alloy" | "dy-metal" | "copper-ctc";

type Line = { label: string; usdPerKg: number };

export type ShouldCost =
  | {
      ok: true;
      model: ModelId;
      title: string;
      currency: "EUR" | "USD";
      perKg: Band;
      breakdownMid: Line[];
      assumptions: Assumption[];
      prices: Record<string, number>;
      /** One entry per price used, with where it came from. */
      basis: { key: PriceKey; kind: PriceBasisKind; label: string }[];
      /** True when any price is an annual reference average: context, not a verdict. */
      indicative: boolean;
      asOf: string | null;
      caveat: string;
    }
  | { ok: false; model: ModelId | null; reason: string };

// Mass fraction of metal in the oxide (stoichiometry): Nd2O3 0.857, Pr6O11 0.828
// (NdPr blend ~0.85), Dy2O3 0.871.
const NDPR_METAL_IN_OXIDE = 0.85;
const DY_METAL_IN_OXIDE = 0.871;

const A = (key: string, label: string, unit: string, low: number, mid: number, high: number, note: string): Assumption => ({
  key,
  label,
  unit,
  band: { low, mid, high },
  note,
});

export const DEFAULT_ASSUMPTIONS: Record<ModelId, Assumption[]> = {
  ndfeb: [
    A("ndprShare", "NdPr content", "% of magnet mass", 28, 30, 32, "Typical sintered NdFeB total light rare earth."),
    A("dyShare", "Dy content", "% of magnet mass", 0.5, 2, 4, "H-grades carry more; grain-boundary diffusion carries less."),
    A("ironShare", "Iron + boron + additives", "% of magnet mass", 63, 66, 69, "Priced together below."),
    A("ironUsdKg", "Iron, boron, additives price", "USD/kg", 1, 2, 4, "Ferroboron and cobalt/copper/gallium additions dominate."),
    A("conversion", "Oxide → metal conversion", "USD/kg RE metal", 6, 10, 15, "Molten-salt electrolysis toll."),
    A("loss", "Process loss", "% of material", 15, 20, 30, "Milling, sintering and machining scrap."),
    A("processing", "Magnet making + coating", "USD/kg magnet", 12, 18, 25, "Strip casting, jet milling, pressing, sintering, machining, coating."),
    A("margin", "Supplier margin", "%", 8, 12, 18, "On the full cost."),
  ],
  "ndpr-alloy": [
    A("conversion", "Oxide → metal conversion", "USD/kg metal", 6, 10, 15, "Molten-salt electrolysis toll."),
    A("loss", "Process loss", "% of material", 2, 4, 8, "Electrolysis and casting yield."),
    A("margin", "Supplier margin", "%", 4, 7, 12, "On the full cost."),
  ],
  "dy-metal": [
    A("conversion", "Oxide → metal conversion", "USD/kg metal", 12, 20, 30, "Calciothermic reduction and distillation."),
    A("loss", "Process loss", "% of material", 2, 5, 10, "Reduction and handling yield."),
    A("margin", "Supplier margin", "%", 4, 8, 14, "On the full cost."),
  ],
  "copper-ctc": [
    A("copperShare", "Copper content", "% of conductor mass", 95, 97, 98, "The rest is paper or enamel insulation."),
    A("fabrication", "Drawing, transposition, insulation", "USD/kg", 1, 1.6, 3, "Continuously transposed conductor premium."),
    A("loss", "Process loss", "% of material", 1, 2, 4, "Drawing and trimming scrap."),
    A("margin", "Supplier margin", "%", 4, 7, 12, "On the full cost."),
  ],
};

const TITLES: Record<ModelId, string> = {
  ndfeb: "Sintered NdFeB magnet",
  "ndpr-alloy": "NdPr metal / alloy",
  "dy-metal": "Dysprosium metal",
  "copper-ctc": "Copper transposed conductor",
};

/** Which model, if any, covers a commodity label. */
export function modelFor(commodity: string): ModelId | null {
  const c = commodity.toLowerCase();
  if (c.includes("ndfeb") || c.includes("permanent magnet")) return "ndfeb";
  if (c.includes("ndpr") || c.includes("neodymium alloy") || c.includes("neodymium metal")) return "ndpr-alloy";
  if (c.includes("dy metal") || c.includes("dysprosium")) return "dy-metal";
  if (c.includes("cu ctc") || c.includes("copper") || c.includes("ctc")) return "copper-ctc";
  return null;
}

const need: Record<ModelId, PriceKey[]> = {
  ndfeb: ["ndprOxideUsdKg", "dyOxideUsdKg"],
  "ndpr-alloy": ["ndprOxideUsdKg"],
  "dy-metal": ["dyOxideUsdKg"],
  "copper-ctc": ["copperUsdT"],
};

function pick(assumptions: Assumption[], key: string, at: keyof Band) {
  const a = assumptions.find((x) => x.key === key);
  if (!a) throw new Error(`missing assumption ${key}`);
  return a.band[at];
}

/** Per-kg cost at one end of every assumption band, with its line items. */
function perKgAt(model: ModelId, p: LivePrices, as: Assumption[], at: keyof Band): { total: number; lines: Line[] } {
  const v = (k: string) => pick(as, k, at);
  const pct = (k: string) => v(k) / 100;
  if (model === "ndfeb") {
    const ndprMetal = p.ndprOxideUsdKg! / NDPR_METAL_IN_OXIDE;
    const dyMetal = p.dyOxideUsdKg! / DY_METAL_IN_OXIDE;
    const re = pct("ndprShare") * ndprMetal + pct("dyShare") * dyMetal;
    const conv = (pct("ndprShare") + pct("dyShare")) * v("conversion");
    const rest = pct("ironShare") * v("ironUsdKg");
    const material = (re + conv + rest) / (1 - pct("loss"));
    const before = material + v("processing");
    const margin = before * pct("margin");
    return {
      total: before + margin,
      lines: [
        { label: "Rare earths (NdPr + Dy, as metal)", usdPerKg: re / (1 - pct("loss")) },
        { label: "Oxide → metal conversion", usdPerKg: conv / (1 - pct("loss")) },
        { label: "Iron, boron, additives", usdPerKg: rest / (1 - pct("loss")) },
        { label: "Magnet making + coating", usdPerKg: v("processing") },
        { label: "Supplier margin", usdPerKg: margin },
      ],
    };
  }
  if (model === "ndpr-alloy" || model === "dy-metal") {
    const oxide = model === "ndpr-alloy" ? p.ndprOxideUsdKg! : p.dyOxideUsdKg!;
    const metalShare = model === "ndpr-alloy" ? NDPR_METAL_IN_OXIDE : DY_METAL_IN_OXIDE;
    const metal = oxide / metalShare / (1 - pct("loss"));
    const before = metal + v("conversion");
    const margin = before * pct("margin");
    return {
      total: before + margin,
      lines: [
        { label: "Oxide, as metal content", usdPerKg: metal },
        { label: "Oxide → metal conversion", usdPerKg: v("conversion") },
        { label: "Supplier margin", usdPerKg: margin },
      ],
    };
  }
  // copper-ctc
  const cu = (pct("copperShare") * (p.copperUsdT! / 1000)) / (1 - pct("loss"));
  const before = cu + v("fabrication");
  const margin = before * pct("margin");
  return {
    total: before + margin,
    lines: [
      { label: "Copper", usdPerKg: cu },
      { label: "Drawing, transposition, insulation", usdPerKg: v("fabrication") },
      { label: "Supplier margin", usdPerKg: margin },
    ],
  };
}

/** Low end takes every cost-raising assumption at its cheapest. Content shares are cost-raising too. */
export function shouldCost(commodity: string, prices: LivePrices, overrides?: Assumption[]): ShouldCost {
  const model = modelFor(commodity);
  if (!model) return { ok: false, model: null, reason: `No material model for “${commodity}” yet — consensus and screens still apply.` };
  const missing = need[model].filter((k) => !(typeof prices[k] === "number" && Number.isFinite(prices[k]) && (prices[k] as number) > 0));
  if (missing.length) {
    return { ok: false, model, reason: "A price this model needs is on standby, so no should-cost is computed rather than one built on a placeholder." };
  }
  const assumptions = overrides ?? DEFAULT_ASSUMPTIONS[model];
  for (const a of assumptions) {
    const { low, mid, high } = a.band;
    if (![low, mid, high].every(Number.isFinite) || !(low <= mid && mid <= high) || low < 0) {
      return { ok: false, model, reason: `Assumption “${a.label}” needs low ≤ mid ≤ high, all non-negative.` };
    }
    if (a.unit.startsWith("%") && (high >= 100 || (a.key === "loss" && high >= 95))) {
      return { ok: false, model, reason: `Assumption “${a.label}” must stay below 100%.` };
    }
  }
  const fx = prices.usdEur && prices.usdEur > 0 ? prices.usdEur : null;
  const k = fx ?? 1;
  const low = perKgAt(model, prices, assumptions, "low");
  const mid = perKgAt(model, prices, assumptions, "mid");
  const high = perKgAt(model, prices, assumptions, "high");
  const round = (n: number) => Math.round(n * k * 100) / 100;
  const used: Record<string, number> = {};
  for (const key of need[model]) used[key] = prices[key] as number;
  if (fx) used.usdEur = fx;
  const basis = need[model].map((key) => {
    const b = prices.basis?.[key] ?? { kind: "benchmark" as const, label: "Your benchmark" };
    return { key, kind: b.kind, label: b.label };
  });
  const indicative = basis.some((b) => b.kind === "reference-annual");
  return {
    ok: true,
    model,
    title: TITLES[model],
    currency: fx ? "EUR" : "USD",
    perKg: { low: round(low.total), mid: round(mid.total), high: round(high.total) },
    breakdownMid: mid.lines.map((l) => ({ label: l.label, usdPerKg: round(l.usdPerKg) })),
    assumptions,
    prices: used,
    basis,
    indicative,
    asOf: prices.asOf ?? null,
    caveat: indicative
      ? "Indicative only: built on an annual reference average, which can sit far from today's market for rare earths. Enter your own licensed benchmark (Argus, Fastmarkets, SMM or your contract price) for a verdict."
      : basis.every((b) => b.kind === "benchmark")
        ? "Built on the benchmark you entered. Edit the assumptions to match your contracts."
        : "Built on a monthly reference average, not a spot price. Enter your own licensed benchmark for today's market.",
  };
}

export type QuoteCheck = {
  fairTotal: Band;
  quoteTotal: number;
  /** How far the quote sits above (+) or below (−) the mid should-cost, in %. */
  vsMidPct: number;
  verdict: "BELOW_RANGE" | "IN_RANGE" | "ABOVE_RANGE";
  /** The amount above the high end of the range, 0 when in or below range. */
  overHigh: number;
};

/** Compare a quote total against should-cost for a quantity in kg. Same currency as the should-cost. */
export function checkQuote(sc: Extract<ShouldCost, { ok: true }>, quantityKg: number, quoteTotal: number): QuoteCheck | null {
  if (!(quantityKg > 0) || !(quoteTotal > 0)) return null;
  const fairTotal = { low: sc.perKg.low * quantityKg, mid: sc.perKg.mid * quantityKg, high: sc.perKg.high * quantityKg };
  const verdict = quoteTotal > fairTotal.high ? "ABOVE_RANGE" : quoteTotal < fairTotal.low ? "BELOW_RANGE" : "IN_RANGE";
  return {
    fairTotal,
    quoteTotal,
    vsMidPct: Math.round(((quoteTotal - fairTotal.mid) / fairTotal.mid) * 1000) / 10,
    verdict,
    overHigh: Math.max(0, quoteTotal - fairTotal.high),
  };
}
