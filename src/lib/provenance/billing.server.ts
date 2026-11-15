/**
 * Plans, usage and Stripe subscriptions for an organization.
 */
import { getSql } from "@/lib/db";
import { LEGAL } from "@/lib/legal";
import { iso, isoOrNull } from "@/lib/verityx/format";
import { allowedOrigin } from "@/lib/verityx/http";
import { ensureActor, writeAudit } from "@/lib/verityx/actor";
import { applySubscriptionWith, subscriptionIdFromEvent, type StripeSubscriptionLike } from "./billing-sync";
import {
  checkPack,
  checkPortfolio,
  checkSeal,
  limitsFor,
  PAID_PLANS,
  PlanLimitError,
  planInForce,
  type BuyerPlan,
  type PaidPlanId,
  type PlanState,
  type SupplierPlan,
} from "./plans";

type Row = Record<string, unknown>;

export type OrgBilling = PlanState & {
  supplierStatus: string | null;
  supplierPeriodEnd: string | null;
  buyerStatus: string | null;
  buyerPeriodEnd: string | null;
  hasCustomer: boolean;
};

function readBilling(r: Row | undefined): OrgBilling {
  const supplierStatus = r?.supplier_status ? String(r.supplier_status) : null;
  const buyerStatus = r?.buyer_status ? String(r.buyer_status) : null;
  const supplierPeriodEnd = isoOrNull(r?.supplier_period_end);
  const buyerPeriodEnd = isoOrNull(r?.buyer_period_end);
  const storedSupplier = String(r?.supplier_plan ?? "free") as SupplierPlan;
  const storedBuyer = String(r?.buyer_plan ?? "free") as BuyerPlan;
  return {
    supplierPlan: storedSupplier !== "free" && planInForce({ status: supplierStatus, periodEnd: supplierPeriodEnd }) ? storedSupplier : "free",
    buyerPlan: storedBuyer !== "free" && planInForce({ status: buyerStatus, periodEnd: buyerPeriodEnd }) ? storedBuyer : "free",
    supplierStatus,
    supplierPeriodEnd,
    buyerStatus,
    buyerPeriodEnd,
    hasCustomer: !!r?.stripe_customer_id,
  };
}

export async function orgBilling(organizationId: string): Promise<OrgBilling> {
  const sql = await getSql();
  const rows = await sql`select * from org_billing where organization_id = ${organizationId} limit 1`;
  return readBilling(rows[0]);
}

export async function orgUsage(organizationId: string) {
  const sql = await getSql();
  const [seals, parts, packs] = await Promise.all([
    sql`select count(*)::int as n from lot_passports where organization_id = ${organizationId} and sealed_at > now() - interval '365 days'`,
    sql`select count(*)::int as n, count(distinct nullif(program, ''))::int as programs from portfolio_items where organization_id = ${organizationId}`,
    sql`select count(*)::int as n from portfolio_packs where organization_id = ${organizationId}`,
  ]);
  return {
    sealsLastYear: Number(seals[0]?.n ?? 0),
    parts: Number(parts[0]?.n ?? 0),
    programs: Number(parts[0]?.programs ?? 0),
    packs: Number(packs[0]?.n ?? 0),
  };
}

// ---------------------------------------------------------------- enforcement (called by passport/portfolio servers)

export async function assertCanSeal(organizationId: string) {
  const [b, u] = await Promise.all([orgBilling(organizationId), orgUsage(organizationId)]);
  const c = checkSeal(limitsFor(b), u.sealsLastYear);
  if (!c.ok) throw new PlanLimitError(c);
}

export async function assertPortfolioFits(organizationId: string, incoming: { partNumber: string; passportCode: string; program: string }[]) {
  const b = await orgBilling(organizationId);
  const limits = limitsFor(b);
  if (limits.maxParts === null && limits.maxPrograms === null) return;
  const sql = await getSql();
  const existing = await sql`select part_number, passport_code, program from portfolio_items where organization_id = ${organizationId}`;
  const keys = new Set(existing.map((r) => `${r.part_number}|${r.passport_code}`));
  const programs = new Set(existing.map((r) => String(r.program ?? "")).filter(Boolean));
  for (const it of incoming) {
    keys.add(`${it.partNumber}|${it.passportCode}`);
    if (it.program) programs.add(it.program);
  }
  const c = checkPortfolio(limits, { parts: keys.size, programs: programs.size }, b.buyerPlan);
  if (!c.ok) throw new PlanLimitError(c);
}

export async function assertCanPack(organizationId: string) {
  const [b, u] = await Promise.all([orgBilling(organizationId), orgUsage(organizationId)]);
  const c = checkPack(limitsFor(b), u.packs);
  if (!c.ok) throw new PlanLimitError(c);
}

// ---------------------------------------------------------------- page data

function isOwner(userId: string) {
  const owner = (process.env.OWNER_USER_ID ?? "").trim();
  return !!owner && owner === userId;
}

export async function getBilling(userId: string) {
  const actor = await ensureActor(userId);
  const [billing, usage] = await Promise.all([orgBilling(actor.organizationId), orgUsage(actor.organizationId)]);
  return {
    organization: actor.orgName,
    canManage: actor.role === "founder" || actor.role === "admin",
    stripeReady: !!process.env.STRIPE_SECRET_KEY,
    billing,
    limits: limitsFor(billing),
    usage,
    isOwner: isOwner(actor.userId),
  };
}

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Payments are not switched on yet. Contact us to pay by invoice.");
  return import("stripe").then((m) => new m.default(key));
}

function checkedOrigin(raw: string): string {
  let origin: URL;
  try {
    origin = new URL(raw);
  } catch {
    throw new Error("Invalid origin");
  }
  if (!allowedOrigin(origin.origin, process.env.FRONTEND_ORIGINS)) throw new Error("Origin is not allowlisted");
  return origin.origin;
}

export async function createPlanCheckout(userId: string, data: { plan: string; origin: string }) {
  const actor = await ensureActor(userId);
  if (actor.role !== "founder" && actor.role !== "admin") throw new Error("A founder or admin manages billing.");
  if (!(data.plan in PAID_PLANS)) throw new Error("Unknown plan");
  const planId = data.plan as PaidPlanId;
  const plan = PAID_PLANS[planId];
  const origin = checkedOrigin(data.origin);
  const current = await orgBilling(actor.organizationId);
  if (plan.side === "supplier" && current.supplierPlan === "supplier") throw new Error("The Supplier plan is already active.");
  if (plan.side === "buyer" && current.buyerPlan === planId) throw new Error(`The ${plan.name} plan is already active.`);
  if (plan.side === "buyer" && current.buyerPlan !== "free") {
    throw new Error("To change buyer plans, use Manage billing so the change is prorated on your existing subscription.");
  }
  const stripe = await stripeClient();
  const sql = await getSql();
  const rows = await sql`select stripe_customer_id from org_billing where organization_id = ${actor.organizationId}`;
  const customer = rows[0]?.stripe_customer_id ? String(rows[0].stripe_customer_id) : undefined;
  const meta = { organization_id: actor.organizationId, plan: planId, terms_version: LEGAL.version };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${origin}/work/billing?checkout=success`,
    cancel_url: `${origin}/work/billing?checkout=canceled`,
    client_reference_id: actor.organizationId,
    ...(customer ? { customer, customer_update: { name: "auto", address: "auto" } } : {}),
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    metadata: meta,
    subscription_data: { metadata: meta, description: `VerityX ${plan.name} plan · ${actor.orgName}`.slice(0, 500) },
    custom_text: { submit: { message: `Billed yearly. By subscribing you agree to the VerityX terms (version ${LEGAL.version}) at ${origin}/terms.` } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.annualUsd * 100,
          recurring: { interval: "year" },
          product_data: { name: `VerityX ${plan.name}`, description: plan.summary.slice(0, 300) },
        },
      },
    ],
  });
  await writeAudit(actor, "billing.plan_checkout", "organization", actor.organizationId, { plan: planId, session: session.id });
  return { url: session.url };
}

export async function createPortalSession(userId: string, data: { origin: string }) {
  const actor = await ensureActor(userId);
  if (actor.role !== "founder" && actor.role !== "admin") throw new Error("A founder or admin manages billing.");
  const origin = checkedOrigin(data.origin);
  const sql = await getSql();
  const rows = await sql`select stripe_customer_id from org_billing where organization_id = ${actor.organizationId}`;
  const customer = rows[0]?.stripe_customer_id ? String(rows[0].stripe_customer_id) : null;
  if (!customer) throw new Error("No subscription on file yet.");
  const stripe = await stripeClient();
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${origin}/work/billing` });
  return { url: session.url };
}

/**
 * Webhook entry for subscription events. Re-fetches the subscription so the
 * stored state is Stripe's latest, whatever order events arrive in.
 */
export async function handleSubscriptionEvent(event: { id: string; type: string; data: { object: Record<string, unknown> } }) {
  const subId = subscriptionIdFromEvent(event);
  if (!subId) return { handled: false as const };
  const stripe = await stripeClient();
  const sub = (await stripe.subscriptions.retrieve(subId)) as unknown as StripeSubscriptionLike;
  const sql = await getSql();
  const result = await applySubscriptionWith(sql, sub);
  if (result.applied && result.organizationId) {
    await sql`
      insert into audit_logs (id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json, request_id)
      select ${crypto.randomUUID()}, ${result.organizationId}, ${"stripe"}, ${"billing.plan_sync"}, ${"organization"},
        ${result.organizationId}, ${JSON.stringify({ eventId: event.id, type: event.type, side: result.side, plan: result.plan, status: sub.status })}, ${event.id}
      where not exists (select 1 from audit_logs where request_id = ${event.id} and action = ${"billing.plan_sync"})
    `;
  }
  return { handled: true as const, ...result };
}

// ---------------------------------------------------------------- owner: invoiced customers

export async function listOrgPlans(userId: string) {
  if (!isOwner(userId)) throw new Error("Owner only.");
  const sql = await getSql();
  const rows = await sql`
    select o.id, o.name, o.created_at, b.*,
      (select count(*)::int from memberships m where m.organization_id = o.id) as members
    from organizations o left join org_billing b on b.organization_id = o.id
    order by o.created_at desc limit 500
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    createdAt: iso(r.created_at),
    members: Number(r.members ?? 0),
    note: String(r.note ?? ""),
    ...readBilling(r),
  }));
}

export async function setOrgPlan(
  userId: string,
  data: { organizationId: string; side: "supplier" | "buyer"; plan: string; periodEnd: string | null; note: string },
) {
  if (!isOwner(userId)) throw new Error("Owner only.");
  const supplierPlans = ["free", "supplier"];
  const buyerPlans = ["free", "team", "program", "enterprise"];
  if (data.side === "supplier" ? !supplierPlans.includes(data.plan) : !buyerPlans.includes(data.plan)) throw new Error("Unknown plan");
  const end = data.periodEnd ? new Date(data.periodEnd) : null;
  if (end && Number.isNaN(end.getTime())) throw new Error("Invalid end date");
  const status = data.plan === "free" ? null : "manual";
  const note = String(data.note ?? "").slice(0, 300);
  const sql = await getSql();
  const org = await sql`select id from organizations where id = ${data.organizationId} limit 1`;
  if (!org[0]) throw new Error("Organization not found");
  await sql`insert into org_billing (organization_id) values (${data.organizationId}) on conflict (organization_id) do nothing`;
  if (data.side === "supplier") {
    await sql`update org_billing set supplier_plan = ${data.plan}, supplier_status = ${status}, supplier_period_end = ${end?.toISOString() ?? null},
      supplier_subscription_id = null, note = ${note}, updated_at = now() where organization_id = ${data.organizationId}`;
  } else {
    await sql`update org_billing set buyer_plan = ${data.plan}, buyer_status = ${status}, buyer_period_end = ${end?.toISOString() ?? null},
      buyer_subscription_id = null, note = ${note}, updated_at = now() where organization_id = ${data.organizationId}`;
  }
  const actor = await ensureActor(userId);
  await writeAudit(actor, "billing.plan_manual", "organization", data.organizationId, { side: data.side, plan: data.plan, periodEnd: end?.toISOString() ?? null, note });
  return listOrgPlans(userId);
}
