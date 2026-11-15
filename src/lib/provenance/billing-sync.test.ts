import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySubscriptionWith, periodEndIso, subscriptionIdFromEvent } from "./billing-sync.ts";

/** A tiny in-memory stand-in for the three statements applySubscriptionWith runs. */
function fakeSql() {
  const rows = new Map<string, Record<string, unknown>>();
  const sql = async (strings: TemplateStringsArray, ...v: unknown[]) => {
    const q = strings.join("?");
    if (q.startsWith("insert into org_billing")) {
      const org = String(v[0]);
      if (!rows.has(org)) rows.set(org, { organization_id: org, supplier_subscription_id: null, buyer_subscription_id: null });
      return [];
    }
    if (q.trim().startsWith("select supplier_subscription_id")) return [rows.get(String(v[0]))!];
    if (q.includes("supplier_plan =")) {
      const r = rows.get(String(v[5]))!;
      Object.assign(r, { stripe_customer_id: v[0] ?? r.stripe_customer_id, supplier_plan: v[1], supplier_status: v[2], supplier_period_end: v[3], supplier_subscription_id: v[4] });
      return [];
    }
    if (q.includes("buyer_plan =")) {
      const r = rows.get(String(v[5]))!;
      Object.assign(r, { stripe_customer_id: v[0] ?? r.stripe_customer_id, buyer_plan: v[1], buyer_status: v[2], buyer_period_end: v[3], buyer_subscription_id: v[4] });
      return [];
    }
    throw new Error("unexpected sql: " + q);
  };
  return { sql: sql as never, rows };
}

const sub = (o: Partial<Record<string, unknown>>) => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { organization_id: "org_1", plan: "team" },
  items: { data: [{ current_period_end: 1_826_000_000 }] },
  ...o,
});

describe("subscription sync", () => {
  it("activates a buyer plan with its period end from the item", async () => {
    const { sql, rows } = fakeSql();
    const r = await applySubscriptionWith(sql, sub({}) as never);
    assert.equal(r.applied, true);
    const row = rows.get("org_1")!;
    assert.equal(row.buyer_plan, "team");
    assert.equal(row.buyer_status, "active");
    assert.equal(row.buyer_subscription_id, "sub_1");
    assert.equal(row.buyer_period_end, new Date(1_826_000_000 * 1000).toISOString());
    assert.equal(row.stripe_customer_id, "cus_1");
  });

  it("supplier and buyer sides are independent", async () => {
    const { sql, rows } = fakeSql();
    await applySubscriptionWith(sql, sub({}) as never);
    await applySubscriptionWith(sql, sub({ id: "sub_2", metadata: { organization_id: "org_1", plan: "supplier" } }) as never);
    const row = rows.get("org_1")!;
    assert.equal(row.buyer_plan, "team");
    assert.equal(row.supplier_plan, "supplier");
  });

  it("cancel falls back to free, but an old canceled subscription cannot undo a newer one", async () => {
    const { sql, rows } = fakeSql();
    await applySubscriptionWith(sql, sub({}) as never);
    await applySubscriptionWith(sql, sub({ id: "sub_new", metadata: { organization_id: "org_1", plan: "program" } }) as never);
    const stale = await applySubscriptionWith(sql, sub({ status: "canceled" }) as never);
    assert.equal(stale.applied, false);
    assert.equal(rows.get("org_1")!.buyer_plan, "program");
    await applySubscriptionWith(sql, sub({ id: "sub_new", status: "canceled", metadata: { organization_id: "org_1", plan: "program" } }) as never);
    assert.equal(rows.get("org_1")!.buyer_plan, "free");
  });

  it("ignores subscriptions that are not VerityX plans", async () => {
    const { sql } = fakeSql();
    const r = await applySubscriptionWith(sql, sub({ metadata: {} }) as never);
    assert.equal(r.applied, false);
  });

  it("reads the period end from either the subscription or its first item", () => {
    assert.equal(periodEndIso({ id: "s", status: "active", customer: null, current_period_end: 100 }), new Date(100_000).toISOString());
    assert.equal(periodEndIso({ id: "s", status: "active", customer: null }), null);
  });
});

describe("event routing", () => {
  it("finds the subscription in each event shape", () => {
    assert.equal(subscriptionIdFromEvent({ type: "customer.subscription.updated", data: { object: { id: "sub_9" } } }), "sub_9");
    assert.equal(subscriptionIdFromEvent({ type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_8" } } }), "sub_8");
    assert.equal(subscriptionIdFromEvent({ type: "checkout.session.completed", data: { object: { mode: "payment" } } }), null);
    assert.equal(subscriptionIdFromEvent({ type: "invoice.paid", data: { object: { parent: { subscription_details: { subscription: "sub_7" } } } } }), "sub_7");
    assert.equal(subscriptionIdFromEvent({ type: "payment_intent.succeeded", data: { object: {} } }), null);
  });
});
