/**
 * Apply a Stripe subscription's current state to org_billing. Pure apart from
 * the injected sql, so it is tested without Stripe or Postgres.
 *
 * Callers pass the subscription as Stripe returns it NOW (re-fetched by id),
 * not the possibly stale copy inside an event, so out-of-order deliveries
 * converge on the latest state. A stale ended subscription never overwrites a
 * different, newer subscription on the same side.
 */
import { storedPlanFromStripe } from "./plans.ts";

type Sql = <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

export type StripeSubscriptionLike = {
  id: string;
  status: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
  current_period_end?: number | null;
  items?: { data?: { current_period_end?: number | null }[] } | null;
};

export type SyncResult = { applied: boolean; organizationId: string | null; side: "supplier" | "buyer" | null; plan: string | null; reason?: string };

export function periodEndIso(sub: StripeSubscriptionLike): string | null {
  // Stripe moved current_period_end onto subscription items (API 2025-03+); accept either.
  const secs = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  return secs ? new Date(secs * 1000).toISOString() : null;
}

export async function applySubscriptionWith(sql: Sql, sub: StripeSubscriptionLike): Promise<SyncResult> {
  const meta = sub.metadata ?? {};
  const org = meta.organization_id ?? null;
  const mapped = storedPlanFromStripe(meta, sub.status);
  if (!org || !mapped) return { applied: false, organizationId: org, side: null, plan: null, reason: "not a VerityX plan subscription" };
  const customer = typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  const end = periodEndIso(sub);

  await sql`insert into org_billing (organization_id) values (${org}) on conflict (organization_id) do nothing`;
  const rows = await sql<{ supplier_subscription_id: string | null; buyer_subscription_id: string | null }>`
    select supplier_subscription_id, buyer_subscription_id from org_billing where organization_id = ${org}
  `;
  const current = mapped.side === "supplier" ? rows[0]?.supplier_subscription_id : rows[0]?.buyer_subscription_id;
  if (mapped.plan === "free" && current && current !== sub.id) {
    return { applied: false, organizationId: org, side: mapped.side, plan: null, reason: "an older subscription ended; a newer one is on file" };
  }

  if (mapped.side === "supplier") {
    await sql`
      update org_billing set
        stripe_customer_id = coalesce(${customer}, stripe_customer_id),
        supplier_plan = ${mapped.plan}, supplier_status = ${mapped.status},
        supplier_period_end = ${end}, supplier_subscription_id = ${sub.id}, updated_at = now()
      where organization_id = ${org}
    `;
  } else {
    await sql`
      update org_billing set
        stripe_customer_id = coalesce(${customer}, stripe_customer_id),
        buyer_plan = ${mapped.plan}, buyer_status = ${mapped.status},
        buyer_period_end = ${end}, buyer_subscription_id = ${sub.id}, updated_at = now()
      where organization_id = ${org}
    `;
  }
  return { applied: true, organizationId: org, side: mapped.side, plan: mapped.plan };
}

/** Which subscription (if any) an event is about. */
export function subscriptionIdFromEvent(event: { type: string; data: { object: Record<string, unknown> } }): string | null {
  const o = event.data.object;
  if (event.type.startsWith("customer.subscription.")) return typeof o.id === "string" ? o.id : null;
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (o.mode !== "subscription") return null;
    const s = o.subscription;
    return typeof s === "string" ? s : s && typeof s === "object" && typeof (s as { id?: unknown }).id === "string" ? (s as { id: string }).id : null;
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const direct = o.subscription;
    if (typeof direct === "string") return direct;
    // API 2025+: invoice.parent.subscription_details.subscription
    const parent = o.parent as { subscription_details?: { subscription?: unknown } } | undefined;
    const nested = parent?.subscription_details?.subscription;
    return typeof nested === "string" ? nested : null;
  }
  return null;
}
