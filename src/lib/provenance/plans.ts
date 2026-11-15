/**
 * PLANS AND LIMITS — pure, shared by server enforcement, the billing page and /pricing.
 *
 * Two sides, priced on public market anchors (Nov 2026):
 *  - Suppliers publish lot passports. Supplier-paid networks charge suppliers
 *    roughly $450–$900 (Avetta), $875+ (ISNetworld) and ~€1,100–€7,700 (EcoVadis)
 *    a year. Non-Chinese rare-earth suppliers are few and each one unlocks many
 *    buyers, so the supplier side is priced to remove friction.
 *  - Buyers monitor parts and generate evidence packs. Buyer-side tools run
 *    ~$12.5k (Assent, AWS listing), ~€11.9k (Minespider), ~$16.8k (Resilinc
 *    entry), ~$50k (ISNetworld hiring client), $80k+ (Interos).
 * Verifying a passport is free for everyone, always.
 */

export type SupplierPlan = "free" | "supplier";
export type BuyerPlan = "free" | "team" | "program" | "enterprise";

export type PlanState = {
  supplierPlan: SupplierPlan;
  buyerPlan: BuyerPlan;
};

export type Limits = {
  /** Sealed passports per rolling 365 days; null = unlimited. */
  sealsPerYear: number | null;
  /** Distinct part lines in the portfolio; null = unlimited. */
  maxParts: number | null;
  /** Distinct programs in the portfolio; null = unlimited. */
  maxPrograms: number | null;
  /** Evidence packs ever generated; null = unlimited. */
  maxPacks: number | null;
};

export type PaidPlanId = "supplier" | "team" | "program";

export const PAID_PLANS: Record<
  PaidPlanId,
  { side: "supplier" | "buyer"; name: string; annualUsd: number; summary: string; features: string[] }
> = {
  supplier: {
    side: "supplier",
    name: "Supplier",
    annualUsd: 2_400,
    summary: "For mines, separators, metal and alloy makers and magnet makers publishing their lots.",
    features: [
      "Unlimited sealed lot passports",
      "Link your lots to your suppliers' passports by code",
      "Corrections by supersede, revocations on the ledger",
      "A public page per lot your buyers can verify without an account",
    ],
  },
  team: {
    side: "buyer",
    name: "Team",
    annualUsd: 12_000,
    summary: "One program or contract with magnet-bearing parts.",
    features: [
      "Up to 250 part lines in 1 program",
      "Live chain status for every part, with change alerts",
      "Unlimited sealed evidence packs (PDF + JSON)",
    ],
  },
  program: {
    side: "buyer",
    name: "Program",
    annualUsd: 30_000,
    summary: "Several programs or contracts across a business unit.",
    features: [
      "Up to 2,500 part lines across unlimited programs",
      "Everything in Team",
      "Includes the Supplier plan for your own lots",
    ],
  },
};

export const ENTERPRISE = {
  name: "Enterprise",
  fromUsd: 60_000,
  summary: "Primes and large portfolios: volume, terms and invoicing set in an order form.",
  features: ["Unlimited parts, programs and passports", "Invoice and order-form terms", "Your security questionnaire"],
};

export const FREE = {
  seals: 5,
  parts: 25,
  programs: 1,
  packs: 1,
};

export function limitsFor(p: PlanState): Limits {
  const supplierUnlimited = p.supplierPlan === "supplier" || p.buyerPlan === "program" || p.buyerPlan === "enterprise";
  const sealsPerYear = supplierUnlimited ? null : FREE.seals;
  switch (p.buyerPlan) {
    case "enterprise":
      return { sealsPerYear, maxParts: null, maxPrograms: null, maxPacks: null };
    case "program":
      return { sealsPerYear, maxParts: 2_500, maxPrograms: null, maxPacks: null };
    case "team":
      return { sealsPerYear, maxParts: 250, maxPrograms: 1, maxPacks: null };
    default:
      return { sealsPerYear, maxParts: FREE.parts, maxPrograms: FREE.programs, maxPacks: FREE.packs };
  }
}

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "incomplete" | "unpaid" | "canceled" | "incomplete_expired" | "paused";

export const GRACE_DAYS = 14;

/**
 * Is a stored plan in force now? Active/trialing count; past_due keeps working
 * for a grace period after the period end so a late bank payment does not lock
 * anyone out mid-audit. Manual (invoiced) plans count until their end date.
 */
export function planInForce(input: { status: string | null; periodEnd: string | null; now?: Date }): boolean {
  const now = input.now ?? new Date();
  const end = input.periodEnd ? new Date(input.periodEnd) : null;
  const graceEnd = end ? new Date(end.getTime() + GRACE_DAYS * 86_400_000) : null;
  switch (input.status) {
    case "active":
    case "trialing":
    case "manual":
      return !graceEnd || graceEnd > now;
    case "past_due":
      return !!graceEnd && graceEnd > now;
    default:
      return false;
  }
}

/** Map a Stripe subscription status (plus its metadata plan) to what we store. */
export function storedPlanFromStripe(meta: { plan?: string }, status: string): { side: "supplier" | "buyer"; plan: string; status: string } | null {
  const id = meta.plan as PaidPlanId | undefined;
  if (!id || !(id in PAID_PLANS)) return null;
  const side = PAID_PLANS[id].side;
  const ended = status === "canceled" || status === "incomplete_expired" || status === "unpaid";
  return { side, plan: ended ? "free" : id, status };
}

export type LimitCheck = { ok: true } | { ok: false; reason: string; upgrade: PaidPlanId | "enterprise" };

export function checkSeal(limits: Limits, sealedLastYear: number): LimitCheck {
  if (limits.sealsPerYear === null || sealedLastYear < limits.sealsPerYear) return { ok: true };
  return {
    ok: false,
    reason: `The free plan seals ${limits.sealsPerYear} passports a year and you have sealed ${sealedLastYear}. The Supplier plan ($2,400 a year) seals without limit.`,
    upgrade: "supplier",
  };
}

export function checkPortfolio(limits: Limits, after: { parts: number; programs: number }, plan: BuyerPlan): LimitCheck {
  if (limits.maxParts !== null && after.parts > limits.maxParts) {
    const next = plan === "free" ? "team" : plan === "team" ? "program" : "enterprise";
    return {
      ok: false,
      reason: `This would bring the portfolio to ${after.parts.toLocaleString("en-US")} part lines; your plan allows ${limits.maxParts.toLocaleString("en-US")}.`,
      upgrade: next,
    };
  }
  if (limits.maxPrograms !== null && after.programs > limits.maxPrograms) {
    return {
      ok: false,
      reason: `Your plan covers ${limits.maxPrograms} program; this would make ${after.programs}. The Program plan covers unlimited programs.`,
      upgrade: "program",
    };
  }
  return { ok: true };
}

export function checkPack(limits: Limits, packsSoFar: number): LimitCheck {
  if (limits.maxPacks === null || packsSoFar < limits.maxPacks) return { ok: true };
  return {
    ok: false,
    reason: `The free plan includes ${limits.maxPacks} evidence pack. Team ($12,000 a year) generates them without limit.`,
    upgrade: "team",
  };
}

export class PlanLimitError extends Error {
  upgrade: string;
  constructor(check: Exclude<LimitCheck, { ok: true }>) {
    super(check.reason);
    this.name = "PlanLimitError";
    this.upgrade = check.upgrade;
  }
}
