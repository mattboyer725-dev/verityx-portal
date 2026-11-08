/**
 * Apply a signature-verified Stripe event to a pilot (sovereign v5 SEC-02 parity).
 *
 * The database layer has no transactions, so correctness comes from ordering
 * and idempotent statements rather than from a single atomic unit:
 *
 *   1. Mark the pilot paid — guarded by payment_status <> 'paid', so a retry
 *      is a no-op.
 *   2. Write the billing.paid_stripe audit row — at most one per event id
 *      (request_id), and only when this event is what paid the pilot.
 *   3. Record the event id last, `on conflict do nothing`.
 *
 * v1.0 recorded the event id first. If step 1 then failed, every Stripe retry
 * was answered "duplicate" and the payment was never applied; two concurrent
 * deliveries both passed the select and the second hit the primary key (500).
 * Now a crash at any point is repaired by the retry, and concurrent
 * deliveries converge on one paid pilot, one audit row, one event row.
 */
import { paymentIntentIdFromSession, shouldMarkPaid, type StripeLikeEvent } from "./billing.ts";
import { newId } from "./format.ts";

type Sql = <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

export type StripeApplyResult = { duplicate: boolean; pilotId: string | null; paid: boolean };

export async function applyVerifiedStripeEventWith(sql: Sql, event: StripeLikeEvent): Promise<StripeApplyResult> {
  const obj = event.data.object;
  const meta = obj.metadata ?? {};
  const sessionId = obj.id ?? null;
  const intent = paymentIntentIdFromSession(obj);
  let pilotId = meta.pilot_id ?? obj.client_reference_id ?? null;
  let orgId = meta.organization_id ?? null;
  if (!pilotId && sessionId) {
    const found = await sql<{ id: string; organization_id: string }>`
      select id, organization_id from pilots where stripe_checkout_session_id = ${sessionId} limit 1
    `;
    if (found[0]) {
      pilotId = found[0].id;
      orgId = found[0].organization_id;
    }
  }

  let paid = false;
  if (pilotId && shouldMarkPaid(event.type, obj.payment_status)) {
    await sql`
      update pilots
      set payment_status = ${"paid"},
          paid_at = now(),
          paid_via = ${"stripe_webhook"},
          stripe_payment_intent_id = ${intent},
          status = ${"in_analysis"},
          updated_at = now()
      where id = ${pilotId}
        and (${orgId}::text is null or organization_id = ${orgId})
        and payment_status <> ${"paid"}
    `;
    // Paid by Stripe with this intent — whether by this delivery or an earlier
    // attempt of the same event that crashed before its audit row.
    const pilot = await sql<{ organization_id: string }>`
      select organization_id from pilots
      where id = ${pilotId}
        and (${orgId}::text is null or organization_id = ${orgId})
        and payment_status = ${"paid"}
        and paid_via = ${"stripe_webhook"}
        and stripe_payment_intent_id is not distinct from ${intent}
      limit 1
    `;
    if (pilot[0]) {
      paid = true;
      await sql`
        insert into audit_logs (
          id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json, request_id
        )
        select
          ${newId()}, ${String(pilot[0].organization_id)}, ${"stripe"}, ${"billing.paid_stripe"},
          ${"pilot"}, ${pilotId}, ${JSON.stringify({ eventId: event.id, type: event.type })}, ${event.id}
        where not exists (
          select 1 from audit_logs where request_id = ${event.id} and action = ${"billing.paid_stripe"}
        )
        on conflict do nothing
      `;
    }
  }

  const claimed = await sql<{ id: string }>`
    insert into stripe_events (id, event_type, organization_id, pilot_id)
    values (${event.id}, ${event.type}, ${orgId}, ${pilotId})
    on conflict (id) do nothing
    returning id
  `;
  return { duplicate: !claimed[0], pilotId, paid };
}
