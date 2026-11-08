/**
 * ANNUAL PLANS — public list prices, invoiced yearly under an order form.
 *
 * Positioned against published supplier-risk pricing (Nov 2026): Resilinc from
 * $1,400/month ($16,800/yr), Interos enterprise-only from about $80,000/yr.
 * Every line below is something the product does today; nothing here promises
 * a feature that is not built.
 */
import { PILOT_CREDIT_DAYS, PILOT_PRICE_USD, PILOT_SLA_HOURS } from "./constants";


export type Plan = {
  id: "desk" | "program" | "enterprise";
  name: string;
  /** Yearly list price in USD. For enterprise this is the starting price. */
  annualUsd: number;
  from?: boolean;
  /** Purchase orders taken through the full desk per contract year. */
  posPerYear: number | null;
  sites: number | null;
  summary: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "desk",
    name: "Desk",
    annualUsd: 14_400,
    posPerYear: 50,
    sites: 1,
    summary: "One buying site with a steady flow of magnet, rare-earth, copper or electrical-steel orders.",
    features: [
      `Up to 50 purchase orders a year through the desk, ${PILOT_SLA_HOURS}-hour target each`,
      "Should-cost from licensed public prices, compared with your quotes and your own benchmark",
      "GLEIF and UN sanctions screen on every supplier",
      "Sealed evidence packet and advisory decision for each order",
      "Unlimited public verification at /verify for anyone you share with",
    ],
  },
  {
    id: "program",
    name: "Program",
    annualUsd: 36_000,
    posPerYear: 150,
    sites: 3,
    summary: "A category team across several sites that wants one evidence trail for every order.",
    features: [
      "Everything in Desk",
      "Up to 150 purchase orders a year across up to 3 sites",
      "Orders queued ahead of Desk and pilot work",
      "Quarterly review call on findings and suppliers",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    annualUsd: 60_000,
    from: true,
    posPerYear: null,
    sites: null,
    summary: "Larger volumes, more sites, or your own paper and security review.",
    features: [
      "Everything in Program",
      "Volume and sites set in your order form",
      "Your contract terms and security questionnaire",
    ],
  },
];

export const PILOT_OFFER = {
  priceUsd: PILOT_PRICE_USD,
  creditDays: PILOT_CREDIT_DAYS,
  line: `The pilot fee is credited in full against your first year if you sign a plan within ${PILOT_CREDIT_DAYS} days.`,
};

/** Monthly equivalent, rounded to the dollar, for display only. Plans are billed yearly. */
export function monthlyEquivalent(annualUsd: number): number {
  return Math.round(annualUsd / 12);
}
