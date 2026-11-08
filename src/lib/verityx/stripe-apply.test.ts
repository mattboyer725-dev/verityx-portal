/**
 * SEC-02 parity against a real Postgres (PGLite) with every migration applied.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { StripeLikeEvent } from "./billing.ts";
import { applyVerifiedStripeEventWith } from "./stripe-apply.ts";

type Sql = Parameters<typeof applyVerifiedStripeEventWith>[0];

async function freshDb() {
  const pg = new PGlite();
  const dir = join(import.meta.dirname, "../../../migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(dir, f), "utf8"));
  }
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
    return (await pg.query(text, values)).rows;
  }) as Sql;
  await pg.exec(`
    insert into organizations (id, name, slug) values ('org1', 'Aequitas', 'aequitas');
    insert into prospects (id, organization_id, user_id, company_name) values ('pr1', 'org1', 'u1', 'Northwind Logistics');
    insert into pilots (id, organization_id, user_id, prospect_id, title) values ('p1', 'org1', 'u1', 'pr1', '72h pilot');
  `);
  return { pg, sql };
}

const event = (id = "evt_1"): StripeLikeEvent => ({
  id,
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      payment_status: "paid",
      payment_intent: "pi_1",
      metadata: { pilot_id: "p1", organization_id: "org1" },
    },
  },
});

async function state(pg: PGlite) {
  const pilot = (await pg.query<{ payment_status: string; paid_via: string }>("select payment_status, paid_via from pilots where id = 'p1'")).rows[0];
  const audits = (await pg.query("select 1 from audit_logs where action = 'billing.paid_stripe'")).rows.length;
  const events = (await pg.query("select 1 from stripe_events")).rows.length;
  return { status: pilot.payment_status, via: pilot.paid_via, audits, events };
}

test("happy path pays once; a retry is a duplicate and changes nothing", async () => {
  const { pg, sql } = await freshDb();
  assert.deepEqual(await applyVerifiedStripeEventWith(sql, event()), { duplicate: false, pilotId: "p1", paid: true });
  assert.deepEqual(await state(pg), { status: "paid", via: "stripe_webhook", audits: 1, events: 1 });
  assert.equal((await applyVerifiedStripeEventWith(sql, event())).duplicate, true);
  assert.deepEqual(await state(pg), { status: "paid", via: "stripe_webhook", audits: 1, events: 1 });
});

test("a failure after the payment step is repaired by Stripe's retry (v1.0 lost the payment here)", async () => {
  const { pg, sql } = await freshDb();
  let calls = 0;
  const flaky = (async (s: TemplateStringsArray, ...v: unknown[]) => {
    if (s.join("?").includes("insert into audit_logs") && calls++ === 0) throw new Error("connection reset");
    return sql(s, ...v);
  }) as Sql;
  await assert.rejects(() => applyVerifiedStripeEventWith(flaky, event()));
  assert.deepEqual(await state(pg), { status: "paid", via: "stripe_webhook", audits: 0, events: 0 }, "event not claimed");
  const retry = await applyVerifiedStripeEventWith(sql, event());
  assert.equal(retry.duplicate, false);
  assert.deepEqual(await state(pg), { status: "paid", via: "stripe_webhook", audits: 1, events: 1 });
});

test("concurrent deliveries of one event converge: one payment, one audit row, one event row, no 500", async () => {
  const { pg, sql } = await freshDb();
  const results = await Promise.all(Array.from({ length: 8 }, () => applyVerifiedStripeEventWith(sql, event())));
  assert.equal(results.filter((r) => !r.duplicate).length, 1);
  assert.deepEqual(await state(pg), { status: "paid", via: "stripe_webhook", audits: 1, events: 1 });
});

test("a pilot already paid manually is not re-audited as a Stripe payment", async () => {
  const { pg, sql } = await freshDb();
  await pg.exec("update pilots set payment_status = 'paid', paid_via = 'manual' where id = 'p1'");
  const r = await applyVerifiedStripeEventWith(sql, event());
  assert.equal(r.paid, false);
  assert.deepEqual(await state(pg), { status: "paid", via: "manual", audits: 0, events: 1 });
});

test("unpaid checkout and cross-org metadata never mark a pilot paid", async () => {
  const { pg, sql } = await freshDb();
  const unpaid = event("evt_unpaid");
  unpaid.data.object.payment_status = "unpaid";
  await applyVerifiedStripeEventWith(sql, unpaid);
  const foreign = event("evt_foreign");
  foreign.data.object.metadata = { pilot_id: "p1", organization_id: "other-org" };
  await applyVerifiedStripeEventWith(sql, foreign);
  const s = await state(pg);
  assert.equal(s.status, "unpaid");
  assert.equal(s.audits, 0);
});
