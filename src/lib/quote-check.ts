/**
 * CHECK ANY QUOTE — the buyer's own purchase order, not a seeded scenario.
 *
 * Pure: takes the quote, the live prices and the supplier screen that the
 * server already fetched, and returns an advisory verdict with its reasons.
 * The verdict never blocks anything on its own; a person decides.
 */
import { consensusAgent, type Consensus } from "./consensus.ts";
import { checkQuote, shouldCost, type LivePrices, type QuoteCheck, type ShouldCost } from "./should-cost.ts";

export type QuoteInput = {
  supplier: string;
  commodity: string;
  quantityKg: number;
  quoteTotal: number;
  currency: "EUR" | "USD";
  poNumber?: string;
  /** Other quotes or market prints for the same quantity, same currency. */
  otherPrices?: number[];
};

export type SupplierScreen = {
  gleif: { lei: string; name: string; country: string; status: string } | null;
  gleifAvailable: boolean;
  un: "possible-match" | "no-match" | "unavailable";
  unSource: string;
  checkedAt: string;
};

export type Verdict = "PROCEED" | "REVIEW" | "HOLD";

export type QuoteAssessment = {
  input: QuoteInput;
  verdict: Verdict;
  reasons: string[];
  shouldCost: ShouldCost;
  /** The quote in the should-cost currency, when it could be converted. */
  quoteInFairCurrency: number | null;
  vsShouldCost: QuoteCheck | null;
  consensus: Consensus | null;
  /** Quote vs consensus of the other prices, in %. */
  vsConsensusPct: number | null;
  screen: SupplierScreen;
  advisory: true;
};

const LIMITS = { name: 120, commodity: 80, po: 40, maxQty: 1e9, maxTotal: 1e12, maxOthers: 12 };

/** Validate and normalise untrusted input. Throws with a reason a buyer can act on. */
export function parseQuoteInput(raw: unknown): QuoteInput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string, max: number, required = true) => {
    const v = typeof o[k] === "string" ? (o[k] as string).trim() : "";
    if (required && v.length < 2) throw new Error(`${k} is required`);
    if (v.length > max) throw new Error(`${k} must be ${max} characters or fewer`);
    if ([...v].some((ch) => ch.charCodeAt(0) < 0x20)) throw new Error(`${k} contains control characters`);
    return v;
  };
  const num = (k: string, max: number) => {
    const v = typeof o[k] === "number" ? (o[k] as number) : Number(o[k]);
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${k} must be a positive number`);
    if (v > max) throw new Error(`${k} is too large`);
    return v;
  };
  const currency = o.currency === "USD" ? "USD" : o.currency === "EUR" ? "EUR" : null;
  if (!currency) throw new Error("currency must be EUR or USD");
  const others = Array.isArray(o.otherPrices) ? o.otherPrices : [];
  if (others.length > LIMITS.maxOthers) throw new Error(`at most ${LIMITS.maxOthers} other prices`);
  const otherPrices = others.map((x) => {
    const v = Number(x);
    if (!Number.isFinite(v) || v <= 0 || v > LIMITS.maxTotal) throw new Error("other prices must be positive numbers");
    return v;
  });
  const po = str("poNumber", LIMITS.po, false);
  return {
    supplier: str("supplier", LIMITS.name),
    commodity: str("commodity", LIMITS.commodity),
    quantityKg: num("quantityKg", LIMITS.maxQty),
    quoteTotal: num("quoteTotal", LIMITS.maxTotal),
    currency,
    ...(po ? { poNumber: po } : {}),
    otherPrices,
  };
}

function toFairCurrency(total: number, from: "EUR" | "USD", sc: ShouldCost, prices: LivePrices): number | null {
  if (!sc.ok) return null;
  if (sc.currency === from) return total;
  const fx = prices.usdEur;
  if (!fx || fx <= 0) return null;
  return from === "USD" && sc.currency === "EUR" ? total * fx : total / fx;
}

const pct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

export function assessQuote(input: QuoteInput, prices: LivePrices, screen: SupplierScreen): QuoteAssessment {
  const reasons: string[] = [];
  let hold = false;
  let review = false;

  const sc = shouldCost(input.commodity, prices);
  const quoteInFair = toFairCurrency(input.quoteTotal, input.currency, sc, prices);
  const vs = sc.ok && quoteInFair != null ? checkQuote(sc, input.quantityKg, quoteInFair) : null;
  if (!sc.ok) {
    reasons.push(sc.reason);
  } else if (!vs) {
    review = true;
    reasons.push(`The quote is in ${input.currency} and FX is on standby, so it was not compared with the should-cost.`);
  } else if (vs.verdict === "ABOVE_RANGE") {
    hold = true;
    reasons.push(`Quote is ${pct(vs.vsMidPct)} against the mid should-cost and above the top of the fair range.`);
  } else if (vs.verdict === "BELOW_RANGE") {
    review = true;
    reasons.push(`Quote is ${pct(vs.vsMidPct)} against the mid should-cost — below the fair range. Check spec, quality and delivery terms.`);
  } else {
    reasons.push(`Quote is inside the fair range (${pct(vs.vsMidPct)} against mid).`);
  }

  let consensus: Consensus | null = null;
  let vsConsensusPct: number | null = null;
  const others = input.otherPrices ?? [];
  if (others.length >= 2) {
    consensus = consensusAgent(others);
    if (consensus.verdict !== "INSUFFICIENT_DATA" && consensus.market > 0) {
      vsConsensusPct = Math.round(((input.quoteTotal - consensus.market) / consensus.market) * 1000) / 10;
      if (consensus.verdict === "DISPUTED") {
        review = true;
        reasons.push(`The other prices disagree with each other (confidence ${consensus.confidence.toFixed(2)}), so they are a weak benchmark.`);
      }
      if (vsConsensusPct > 10) {
        hold = true;
        reasons.push(`Quote is ${pct(vsConsensusPct)} against the consensus of the other prices.`);
      } else {
        reasons.push(`Quote is ${pct(vsConsensusPct)} against the consensus of the other prices.`);
      }
    }
  } else if (others.length === 1) {
    reasons.push("Add at least two other prices for a consensus check.");
  }

  if (!vs && vsConsensusPct == null) {
    review = true;
    reasons.push("The price itself was not checked: no live should-cost and fewer than two other prices. Add other prices or re-run when the feeds are live.");
  }

  if (screen.un === "possible-match") {
    hold = true;
    reasons.push(`The supplier name matches an entry on the ${screen.unSource}. A person must review before any order.`);
  } else if (screen.un === "unavailable") {
    review = true;
    reasons.push("The UN sanctions list could not be reached, so the supplier was not screened. Re-run before ordering.");
  }
  if (!screen.gleifAvailable) {
    review = true;
    reasons.push("The GLEIF company registry could not be reached.");
  } else if (!screen.gleif) {
    review = true;
    reasons.push("No legal-entity (LEI) record found for this supplier name. Confirm the exact legal name.");
  } else if (screen.gleif.status && screen.gleif.status !== "ACTIVE") {
    review = true;
    reasons.push(`The supplier's LEI record is ${screen.gleif.status}.`);
  }

  return {
    input,
    verdict: hold ? "HOLD" : review ? "REVIEW" : "PROCEED",
    reasons,
    shouldCost: sc,
    quoteInFairCurrency: quoteInFair,
    vsShouldCost: vs,
    consensus,
    vsConsensusPct,
    screen,
    advisory: true,
  };
}

/** One line for the ledger's decision entry (2,000 characters at most). */
export function ledgerContext(a: QuoteAssessment): string {
  const sc = a.shouldCost.ok ? `should-cost ${a.shouldCost.perKg.low}–${a.shouldCost.perKg.high} ${a.shouldCost.currency}/kg` : "no should-cost";
  const parts = [
    `${a.input.supplier} · ${a.input.commodity} · ${a.input.quantityKg} kg · ${a.input.quoteTotal} ${a.input.currency}`,
    sc,
    a.vsShouldCost ? `vs mid ${a.vsShouldCost.vsMidPct}%` : null,
    a.vsConsensusPct != null ? `vs consensus ${a.vsConsensusPct}%` : null,
    `UN ${a.screen.un}`,
    a.screen.gleif ? `LEI ${a.screen.gleif.lei}` : "no LEI",
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 2000);
}
