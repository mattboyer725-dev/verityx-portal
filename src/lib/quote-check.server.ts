import { shouldCostPrices } from "@/lib/engine";
import { fallbackBundle, fetchLiveBundle, screenSupplierByName } from "@/lib/feeds";
import { assessQuote, type QuoteAssessment, type QuoteInput } from "@/lib/quote-check";

function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** Fetch live prices and the supplier screen, then assess. Always server-side: a seal never trusts a client result. */
export async function runQuoteCheck(input: QuoteInput): Promise<QuoteAssessment> {
  const [live, screen] = await Promise.all([
    withBudget(fetchLiveBundle(), 4000, fallbackBundle()),
    withBudget(screenSupplierByName(input.supplier), 6000, {
      gleif: null,
      gleifAvailable: false,
      un: "unavailable" as const,
      unSource: "UN Security Council Consolidated List",
      checkedAt: new Date().toISOString(),
    }),
  ]);
  return assessQuote(input, shouldCostPrices(live), screen);
}
