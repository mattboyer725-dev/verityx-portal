import assert from "node:assert/strict";
import { test } from "node:test";
import { assessQuote, ledgerContext, parseQuoteInput, type SupplierScreen } from "./quote-check.ts";

const PRICES = { ndprOxideUsdKg: 60, dyOxideUsdKg: 300, copperUsdT: 10_000, usdEur: 0.9 };
const CLEAN: SupplierScreen = {
  gleif: { lei: "5299000J2N45DDNE4Y28", name: "ACME MAGNETS GMBH", country: "DE", status: "ACTIVE" },
  gleifAvailable: true,
  un: "no-match",
  unSource: "UN Security Council Consolidated List",
  checkedAt: "2026-11-08T18:00:00Z",
};
const base = { supplier: "Acme Magnets GmbH", commodity: "NdPr alloy", quantityKg: 1000, currency: "EUR" as const };

test("input validation refuses bad or hostile input with a usable reason", () => {
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: -5 }), /positive/);
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: 10, currency: "GBP" }), /EUR or USD/);
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: 10, supplier: "x" }), /supplier/);
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: 10, supplier: "A\u0000B Ltd" }), /control/);
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: 10, otherPrices: Array(13).fill(1) }), /at most/);
  const ok = parseQuoteInput({ ...base, quoteTotal: "80000", otherPrices: ["79000", 81000] });
  assert.equal(ok.quoteTotal, 80000);
  assert.deepEqual(ok.otherPrices, [79000, 81000]);
});

test("a fair quote from a clean, registered supplier proceeds", () => {
  // NdPr metal mid ≈ 89.38 USD/kg → 80.44 EUR/kg; 1,000 kg ≈ €80,440.
  const a = assessQuote(parseQuoteInput({ ...base, quoteTotal: 80_000, otherPrices: [79_000, 81_500, 80_200] }), PRICES, CLEAN);
  assert.equal(a.verdict, "PROCEED", a.reasons.join(" / "));
  assert.equal(a.vsShouldCost?.verdict, "IN_RANGE");
  assert.ok(Math.abs(a.vsConsensusPct!) < 2);
});

test("an over-priced quote is a HOLD with the reason stated", () => {
  const a = assessQuote(parseQuoteInput({ ...base, quoteTotal: 200_000 }), PRICES, CLEAN);
  assert.equal(a.verdict, "HOLD");
  assert.ok(a.reasons.some((r) => /above the top of the fair range/.test(r)));
});

test("a USD quote is converted with live FX before comparison", () => {
  const a = assessQuote(parseQuoteInput({ ...base, currency: "USD", quoteTotal: 89_000 }), PRICES, CLEAN);
  assert.equal(a.quoteInFairCurrency, 89_000 * 0.9);
  assert.equal(a.vsShouldCost?.verdict, "IN_RANGE");
});

test("a sanctions name match is a HOLD; an unreachable list is a REVIEW, never a silent pass", () => {
  const fair = parseQuoteInput({ ...base, quoteTotal: 80_000 });
  assert.equal(assessQuote(fair, PRICES, { ...CLEAN, un: "possible-match" }).verdict, "HOLD");
  const down = assessQuote(fair, PRICES, { ...CLEAN, un: "unavailable" });
  assert.equal(down.verdict, "REVIEW");
  assert.ok(down.reasons.some((r) => /could not be reached/.test(r)));
});

test("no LEI record, or no live price, is a REVIEW", () => {
  const fair = parseQuoteInput({ ...base, quoteTotal: 80_000 });
  assert.equal(assessQuote(fair, PRICES, { ...CLEAN, gleif: null }).verdict, "REVIEW");
  const noPrice = assessQuote(fair, {}, CLEAN);
  assert.equal(noPrice.shouldCost.ok, false);
  assert.equal(noPrice.verdict, "REVIEW", "an unchecked price is never a PROCEED");
  assert.ok(noPrice.reasons.some((r) => /standby/.test(r)));
  assert.ok(noPrice.reasons.some((r) => /price itself was not verified/.test(r)));
  // …but other prices alone are a real price check.
  const viaPeers = assessQuote(parseQuoteInput({ ...base, quoteTotal: 80_000, otherPrices: [79_000, 81_000] }), {}, CLEAN);
  assert.equal(viaPeers.verdict, "PROCEED", viaPeers.reasons.join(" / "));
});

test("ledger line is compact and complete", () => {
  const a = assessQuote(parseQuoteInput({ ...base, quoteTotal: 80_000 }), PRICES, CLEAN);
  const line = ledgerContext(a);
  assert.match(line, /Acme Magnets GmbH · NdPr alloy · 1000 kg · 80000 EUR/);
  assert.match(line, /LEI 5299000J2N45DDNE4Y28/);
  assert.ok(line.length <= 2000);
});

// ---- price basis: annual references never decide a verdict; the buyer's licensed benchmark does ----
const ANNUAL = {
  ...PRICES,
  basis: {
    ndprOxideUsdKg: { kind: "reference-annual" as const, label: "USGS NdPr oxide 2025 avg (est.)" },
    dyOxideUsdKg: { kind: "reference-annual" as const, label: "USGS Dy oxide 2025 avg (est.)" },
    copperUsdT: { kind: "reference-monthly" as const, label: "World Bank copper Oct 2026 avg" },
  },
};

test("a should-cost built on an annual reference average is indicative and never PROCEEDs or HOLDs on price", () => {
  const fair = assessQuote(parseQuoteInput({ ...base, quoteTotal: 80_000 }), ANNUAL, CLEAN);
  assert.equal(fair.shouldCost.ok && fair.shouldCost.indicative, true);
  assert.equal(fair.verdict, "REVIEW", fair.reasons.join(" / "));
  assert.ok(fair.reasons.some((r) => /Indicative only/.test(r)));
  const high = assessQuote(parseQuoteInput({ ...base, quoteTotal: 400_000 }), ANNUAL, CLEAN);
  assert.equal(high.verdict, "REVIEW", "an annual average alone is not grounds for a HOLD");
  assert.ok(ledgerContext(fair).includes("(indicative)"));
});

test("the buyer's own benchmark replaces the reference and restores a real verdict, with its source recorded", () => {
  const input = parseQuoteInput({
    ...base,
    quoteTotal: 80_000,
    benchmark: { ndprOxideUsdKg: 60, source: "Fastmarkets NdPr oxide, 7 Nov 2026" },
  });
  const a = assessQuote(input, ANNUAL, CLEAN);
  assert.equal(a.verdict, "PROCEED", a.reasons.join(" / "));
  assert.ok(a.shouldCost.ok && !a.shouldCost.indicative);
  assert.ok(a.shouldCost.ok && a.shouldCost.basis[0].label.includes("Fastmarkets NdPr oxide, 7 Nov 2026"));
  const over = assessQuote({ ...input, quoteTotal: 200_000 }, ANNUAL, CLEAN);
  assert.equal(over.verdict, "HOLD");
});

test("a copper check on the monthly reference gives a real verdict", () => {
  const cu = parseQuoteInput({ ...base, commodity: "Cu CTC", quoteTotal: 1_000_000 });
  const a = assessQuote(cu, ANNUAL, CLEAN);
  assert.ok(a.shouldCost.ok && !a.shouldCost.indicative);
  assert.equal(a.verdict, "HOLD", a.reasons.join(" / "));
});

test("benchmark input is validated: positive numbers and a named source", () => {
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: 10, benchmark: { ndprOxideUsdKg: -1, source: "x y" } }), /positive/);
  assert.throws(() => parseQuoteInput({ ...base, quoteTotal: 10, benchmark: { ndprOxideUsdKg: 90, source: "" } }), /where the benchmark comes from/);
  assert.equal(parseQuoteInput({ ...base, quoteTotal: 10, benchmark: { source: "" } }).benchmark, undefined);
});
