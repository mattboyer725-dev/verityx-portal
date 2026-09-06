import { getSql } from "@/lib/db";
import {
  CORE_LOOP,
  PILOT_PRICE_USD,
  PILOT_SLA_HOURS,
  REPORT_DISCLAIMER,
} from "./constants";
import { evaluateDecision } from "./decision-engine";
import { bytesToBase64, buildReportPdf } from "./pdf";
import {
  interpretWebhook,
  paymentIntentIdFromSession,
  shouldMarkPaid,
  type StripeLikeEvent,
} from "./billing";
import { newId } from "./format";
import { VERITYX_BOOK, outreachCopy } from "./book";
import { allowedOrigin } from "./http";
import {
  mapAudit,
  mapDecision,
  mapFeedback,
  mapOutcome,
  mapOutreach,
  mapPilot,
  mapProspect,
  mapReport,
} from "./mappers";
import { assertCan } from "./rbac";
import { ensureActor, mutateGuard, toWorkspace, writeAudit, listMembersForOrg } from "./actor";
import type {
  Dashboard,
  Decision,
  EvidenceItem,
  Feedback,
  Outcome,
  OutreachChannel,
  OutreachEvent,
  Pilot,
  Prospect,
  ProspectStage,
  Report,
  Workspace,
} from "./types";

async function scopedPilot(orgId: string, id: string): Promise<Pilot> {
  const sql = await getSql();
  const rows = await sql`select * from pilots where id = ${id} and organization_id = ${orgId} limit 1`;
  if (!rows[0]) throw new Error("Pilot not found");
  return mapPilot(rows[0]);
}

async function scopedProspect(orgId: string, id: string): Promise<Prospect> {
  const sql = await getSql();
  const rows = await sql`select * from prospects where id = ${id} and organization_id = ${orgId} limit 1`;
  if (!rows[0]) throw new Error("Prospect not found");
  return mapProspect(rows[0]);
}

export async function getWorkspace(userId: string): Promise<Workspace> {
    const actor = await ensureActor(userId);
    const members = await listMembersForOrg(actor.organizationId);
    return toWorkspace(actor, members);
}

export async function listMembers(userId: string) {
    const actor = await ensureActor(userId);
    return listMembersForOrg(actor.organizationId);
}

export async function updateOrg(userId: string, data: { name?: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "org.write");
    await mutateGuard(actor, "org.write");
    const members = await listMembersForOrg(actor.organizationId);
    if (data.name == null || !data.name.trim()) return toWorkspace(actor, members);
    const sql = await getSql();
    await sql`update organizations set name = ${data.name.trim()} where id = ${actor.organizationId}`;
    await writeAudit(actor, "org.update", "organization", actor.organizationId, {
      name: data.name.trim(),
    });
    return {
      ...toWorkspace(actor, members),
      organization: { ...toWorkspace(actor, members).organization, name: data.name.trim() },
    };
}

export async function getDashboard(userId: string): Promise<Dashboard> {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const org = actor.organizationId;
    const [prospects] = await sql<{ n: number }>`select count(*)::int as n from prospects where organization_id = ${org}`;
    const [pilots] = await sql<{ n: number }>`select count(*)::int as n from pilots where organization_id = ${org}`;
    const [paid] = await sql<{ n: number }>`select count(*)::int as n from pilots where organization_id = ${org} and payment_status = 'paid'`;
    const [unpaid] = await sql<{ n: number }>`select count(*)::int as n from pilots where organization_id = ${org} and payment_status <> 'paid'`;
    const [pending] = await sql<{ n: number }>`select count(*)::int as n from decisions where organization_id = ${org} and status = 'pending_approval'`;
    const [reports] = await sql<{ n: number }>`select count(*)::int as n from reports where organization_id = ${org}`;
    const [outcomes] = await sql<{ n: number }>`select count(*)::int as n from outcomes where organization_id = ${org}`;
    const [feedbackN] = await sql<{ n: number }>`select count(*)::int as n from feedback where organization_id = ${org}`;
    const [needsContact] = await sql<{ n: number }>`
      select count(*)::int as n from prospects
      where organization_id = ${org}
        and is_sample = false
        and outreach_count = 0
        and stage not in ('won', 'lost')
    `;
    const [contacted] = await sql<{ n: number }>`
      select count(*)::int as n from prospects
      where organization_id = ${org} and outreach_count > 0
    `;
    const [rev] = await sql<{ n: number }>`select coalesce(sum(price_usd),0)::int as n from pilots where organization_id = ${org} and payment_status = 'paid'`;
    const recentProspects = await sql`select * from prospects where organization_id = ${org} order by updated_at desc limit 5`;
    const recentPilots = await sql`
      select p.*, pr.company_name
      from pilots p
      join prospects pr on pr.id = p.prospect_id and pr.organization_id = p.organization_id
      where p.organization_id = ${org}
      order by p.updated_at desc
      limit 5
    `;
    const recentAudit = await sql`select * from audit_logs where organization_id = ${org} order by created_at desc limit 8`;
    const recentOutcomes = await sql`
      select o.*, pr.company_name, p.title as pilot_title
      from outcomes o
      join pilots p on p.id = o.pilot_id and p.organization_id = o.organization_id
      join prospects pr on pr.id = p.prospect_id and pr.organization_id = o.organization_id
      where o.organization_id = ${org}
      order by o.updated_at desc
      limit 5
    `;

    const paidN = paid?.n ?? 0;
    const prospectN = prospects?.n ?? 0;
    const pilotN = pilots?.n ?? 0;
    const reportN = reports?.n ?? 0;
    const outcomeN = outcomes?.n ?? 0;
    const pendingN = pending?.n ?? 0;
    const feedbackCount = feedbackN?.n ?? 0;

    const loop = CORE_LOOP.map((stage) => {
      switch (stage) {
        case "prospect":
          return { stage, complete: prospectN > 0, detail: `${prospectN} on file` };
        case "discovery":
          return {
            stage,
            complete: (contacted?.n ?? 0) > 0,
            detail: (contacted?.n ?? 0) ? `${contacted?.n} contacted` : "Contact the prospect, then convert",
          };
        case "pilot":
          return { stage, complete: pilotN > 0, detail: `${pilotN} pilots` };
        case "payment":
          return { stage, complete: paidN > 0, detail: `${paidN} paid` };
        case "analysis":
          return { stage, complete: paidN > 0, detail: paidN ? "Unlocked after payment" : "Opens after payment" };
        case "decision":
          return { stage, complete: pendingN + reportN > 0 || paidN > 0, detail: pendingN ? `${pendingN} awaiting approval` : "Evidence-backed" };
        case "report":
          return { stage, complete: reportN > 0, detail: `${reportN} issued` };
        case "follow_up":
          return { stage, complete: outcomeN > 0, detail: outcomeN ? `${outcomeN} follow-ups captured` : "Schedule follow-up after the report" };
        case "outcome":
          return { stage, complete: outcomeN > 0, detail: `${outcomeN} recorded` };
        case "learning":
          return { stage, complete: outcomeN > 0 || feedbackCount > 0, detail: `${feedbackCount} notes · ${outcomeN} outcomes` };
        default:
          return { stage, complete: false, detail: "" };
      }
    });

    const members = await listMembersForOrg(actor.organizationId);

    return {
      workspace: toWorkspace(actor, members),
      counts: {
        prospects: prospectN,
        pilots: pilotN,
        paidPilots: paidN,
        unpaidPilots: unpaid?.n ?? 0,
        pendingApprovals: pendingN,
        reports: reportN,
        outcomes: outcomeN,
        feedback: feedbackCount,
        needsContact: needsContact?.n ?? 0,
      },
      revenueUsd: rev?.n ?? 0,
      loop,
      recentProspects: recentProspects.map(mapProspect),
      recentPilots: recentPilots.map((r) => ({
        ...mapPilot(r),
        companyName: String((r as { company_name?: string }).company_name ?? ""),
      })),
      recentOutcomes: recentOutcomes.map((r) => ({
        ...mapOutcome(r),
        companyName: String((r as { company_name?: string }).company_name ?? ""),
        pilotTitle: String((r as { pilot_title?: string }).pilot_title ?? ""),
      })),
      recentAudit: recentAudit.map(mapAudit),
      fetchedAt: new Date().toISOString(),
    };
}

export async function listProspects(userId: string): Promise<Prospect[]> {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`select * from prospects where organization_id = ${actor.organizationId} order by updated_at desc`;
    return rows.map(mapProspect);
}

export async function getProspect(userId: string, data: { id: string }) {
    const actor = await ensureActor(userId);
    const prospect = await scopedProspect(actor.organizationId, data.id);
    const sql = await getSql();
    const pilots = await sql`select * from pilots where organization_id = ${actor.organizationId} and prospect_id = ${data.id} order by created_at desc`;
    const outreach = await sql`
      select * from outreach_events
      where organization_id = ${actor.organizationId} and prospect_id = ${data.id}
      order by created_at desc
      limit 40
    `;
    return { prospect, pilots: pilots.map(mapPilot), outreach: outreach.map(mapOutreach) };
}

export async function createProspect(userId: string, data: {
    companyName: string;
    contactName?: string;
    contactEmail?: string;
    contactRole?: string;
    sector?: string;
    region?: string;
    stage?: ProspectStage;
    notes?: string;
  }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "prospect.write");
    await mutateGuard(actor, "prospect.write");
    const name = data.companyName.trim();
    if (!name) throw new Error("Company name is required");
    const id = newId();
    const sql = await getSql();
    await sql`
      insert into prospects (
        id, organization_id, user_id, company_name, contact_name, contact_email,
        contact_role, sector, region, stage, notes
      ) values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${name},
        ${data.contactName?.trim() ?? ""}, ${(data.contactEmail ?? "").trim().toLowerCase()},
        ${data.contactRole?.trim() ?? ""}, ${data.sector?.trim() ?? ""}, ${data.region?.trim() ?? ""},
        ${data.stage ?? "lead"}, ${data.notes?.trim() ?? ""}
      )
    `;
    await writeAudit(actor, "prospect.create", "prospect", id, { companyName: name });
    return scopedProspect(actor.organizationId, id);
}

export async function patchProspect(userId: string, data: {
    id: string;
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactRole?: string;
    sector?: string;
    region?: string;
    stage?: ProspectStage;
    notes?: string;
  }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "prospect.write");
    await mutateGuard(actor, "prospect.write");
    await scopedProspect(actor.organizationId, data.id);
    const sql = await getSql();
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (data.companyName !== undefined) add("company_name", data.companyName.trim());
    if (data.contactName !== undefined) add("contact_name", data.contactName.trim());
    if (data.contactEmail !== undefined) add("contact_email", data.contactEmail.trim().toLowerCase());
    if (data.contactRole !== undefined) add("contact_role", data.contactRole.trim());
    if (data.sector !== undefined) add("sector", data.sector.trim());
    if (data.region !== undefined) add("region", data.region.trim());
    if (data.stage !== undefined) add("stage", data.stage);
    if (data.notes !== undefined) add("notes", data.notes);
    params.push(data.id, actor.organizationId);
    await sql.query(
      `update prospects set ${sets.join(", ")} where id = $${params.length - 1} and organization_id = $${params.length}`,
      params,
    );
    await writeAudit(actor, "prospect.update", "prospect", data.id, { fields: Object.keys(data).filter((k) => k !== "id") });
    return scopedProspect(actor.organizationId, data.id);
}

export async function deleteProspect(userId: string, data: { id: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "prospect.delete");
    await mutateGuard(actor, "prospect.delete");
    const sql = await getSql();
    const linked = await sql<{ n: number }>`select count(*)::int as n from pilots where organization_id = ${actor.organizationId} and prospect_id = ${data.id}`;
    if ((linked[0]?.n ?? 0) > 0) throw new Error("Cannot delete a prospect that already has a pilot");
    const res = await sql`delete from prospects where id = ${data.id} and organization_id = ${actor.organizationId} returning id`;
    if (!res[0]) throw new Error("Prospect not found");
    await writeAudit(actor, "prospect.delete", "prospect", data.id, {});
    return { ok: true };
}

export async function createPilot(userId: string, data: { prospectId: string; title?: string; scope?: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "pilot.write");
    await mutateGuard(actor, "pilot.write");
    const prospect = await scopedProspect(actor.organizationId, data.prospectId);
    const id = newId();
    const title = (data.title ?? `${prospect.companyName} · supply chain risk audit`).trim();
    const scope = data.scope?.trim() ?? "";
    const sql = await getSql();
    await sql`
      insert into pilots (
        id, organization_id, user_id, prospect_id, title, scope, status,
        sla_hours, price_usd, payment_status, inputs_received_at, is_sample
      ) values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${prospect.id}, ${title},
        ${scope}, ${"awaiting_payment"}, ${PILOT_SLA_HOURS},
        ${PILOT_PRICE_USD}, ${"unpaid"}, ${scope ? new Date().toISOString() : null}, ${prospect.isSample}
      )
    `;
    if (prospect.stage !== "won" && prospect.stage !== "lost") {
      await sql`update prospects set stage = ${"won"}, updated_at = now() where id = ${prospect.id} and organization_id = ${actor.organizationId}`;
    }
    await writeAudit(actor, "pilot.create", "pilot", id, { prospectId: prospect.id, priceUsd: PILOT_PRICE_USD });
    return scopedPilot(actor.organizationId, id);
}

export async function listPilots(userId: string) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`
      select p.*, pr.company_name
      from pilots p
      join prospects pr on pr.id = p.prospect_id and pr.organization_id = p.organization_id
      where p.organization_id = ${actor.organizationId}
      order by p.updated_at desc
    `;
    return rows.map((r) => ({
      ...mapPilot(r),
      companyName: String((r as { company_name?: string }).company_name ?? ""),
    }));
}

export async function getPilot(userId: string, data: { id: string }) {
    const actor = await ensureActor(userId);
    const pilot = await scopedPilot(actor.organizationId, data.id);
    const prospect = await scopedProspect(actor.organizationId, pilot.prospectId);
    const sql = await getSql();
    const decisions = await sql`select * from decisions where organization_id = ${actor.organizationId} and pilot_id = ${pilot.id} order by created_at desc`;
    const reports = await sql`select * from reports where organization_id = ${actor.organizationId} and pilot_id = ${pilot.id} order by created_at desc`;
    const feedback = await sql`select * from feedback where organization_id = ${actor.organizationId} and pilot_id = ${pilot.id} order by created_at desc`;
    const outcomes = await sql`select * from outcomes where organization_id = ${actor.organizationId} and pilot_id = ${pilot.id} limit 1`;
    return {
      pilot,
      prospect,
      decisions: decisions.map(mapDecision),
      reports: reports.map(mapReport),
      feedback: feedback.map(mapFeedback),
      outcome: outcomes[0] ? mapOutcome(outcomes[0]) : null,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    };
}

export async function patchPilot(userId: string, data: {
    id: string;
    title?: string;
    scope?: string;
    status?: Pilot["status"];
    markInputsReceived?: boolean;
  }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "pilot.write");
    await mutateGuard(actor, "pilot.write");
    await scopedPilot(actor.organizationId, data.id);
    const sql = await getSql();
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (data.title !== undefined) add("title", data.title.trim());
    if (data.scope !== undefined) add("scope", data.scope);
    if (data.status !== undefined) add("status", data.status);
    if (data.markInputsReceived) add("inputs_received_at", new Date().toISOString());
    params.push(data.id, actor.organizationId);
    await sql.query(
      `update pilots set ${sets.join(", ")} where id = $${params.length - 1} and organization_id = $${params.length}`,
      params,
    );
    await writeAudit(actor, "pilot.update", "pilot", data.id, { fields: Object.keys(data).filter((k) => k !== "id") });
    return scopedPilot(actor.organizationId, data.id);
}

export async function createCheckout(userId: string, data: { pilotId: string; origin: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "payment.checkout");
    await mutateGuard(actor, "payment.checkout");
    const pilot = await scopedPilot(actor.organizationId, data.pilotId);
    if (pilot.paymentStatus === "paid") return { alreadyPaid: true as const, url: null, configured: true };
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      await writeAudit(actor, "billing.checkout_unconfigured", "pilot", pilot.id, {});
      return { alreadyPaid: false as const, url: null, configured: false };
    }
    let origin: URL;
    try {
      origin = new URL(data.origin);
    } catch {
      throw new Error("Invalid origin");
    }
    if (!allowedOrigin(origin.origin, process.env.FRONTEND_ORIGINS)) {
      throw new Error("Origin is not allowlisted");
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin.origin}/work/pilots/${pilot.id}?paid=1`,
      cancel_url: `${origin.origin}/work/pilots/${pilot.id}?canceled=1`,
      client_reference_id: pilot.id,
      metadata: {
        pilot_id: pilot.id,
        organization_id: actor.organizationId,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PILOT_PRICE_USD * 100,
            product_data: {
              name: `Verityx supply chain risk audit — ${pilot.title}`,
              description: "72-hour advisory pilot. Not a regulator finding.",
            },
          },
        },
      ],
    });
    const sql = await getSql();
    await sql`
      update pilots
      set stripe_checkout_session_id = ${session.id},
          payment_status = ${"checkout_open"},
          updated_at = now()
      where id = ${pilot.id} and organization_id = ${actor.organizationId} and payment_status <> 'paid'
    `;
    await writeAudit(actor, "billing.checkout_created", "pilot", pilot.id, {
      sessionId: session.id,
    });
    return { alreadyPaid: false as const, url: session.url, configured: true };
}

export async function recordManualPayment(userId: string, data: { pilotId: string; note: string; confirm: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "payment.manual");
    await mutateGuard(actor, "payment.manual");
    if (data.confirm.trim().toUpperCase() !== "CONFIRM") {
      throw new Error("Type CONFIRM to record an authorized payment");
    }
    const note = data.note.trim();
    if (note.length < 8) throw new Error("A payment note is required");
    const sql = await getSql();
    const rows = await sql`
      update pilots
      set payment_status = ${"paid"},
          paid_at = now(),
          paid_via = ${"admin_manual"},
          paid_note = ${note},
          status = ${"in_analysis"},
          updated_at = now()
      where id = ${data.pilotId}
        and organization_id = ${actor.organizationId}
        and payment_status <> ${"paid"}
      returning *
    `;
    if (!rows[0]) {
      const existing = await scopedPilot(actor.organizationId, data.pilotId);
      if (existing.paymentStatus === "paid") return existing;
      throw new Error("Pilot not found");
    }
    await writeAudit(actor, "billing.paid_manual", "pilot", data.pilotId, { note });
    return mapPilot(rows[0]);
}

export async function applyVerifiedStripeEvent(event: StripeLikeEvent): Promise<{ duplicate: boolean; pilotId: string | null }> {
  const sql = await getSql();
  const seen = await sql`select id from stripe_events where id = ${event.id} limit 1`;
  if (seen[0]) return { duplicate: true, pilotId: null };
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
  await sql`
    insert into stripe_events (id, event_type, organization_id, pilot_id)
    values (${event.id}, ${event.type}, ${orgId}, ${pilotId})
  `;
  if (!pilotId || !shouldMarkPaid(event.type, obj.payment_status)) {
    return { duplicate: false, pilotId };
  }
  const updated = await sql`
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
    returning id, organization_id
  `;
  if (updated[0]) {
    await sql`
      insert into audit_logs (
        id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json, request_id
      ) values (
        ${newId()}, ${String(updated[0].organization_id)}, ${"stripe"}, ${"billing.paid_stripe"},
        ${"pilot"}, ${pilotId}, ${JSON.stringify({ eventId: event.id, type: event.type })}, ${event.id}
      )
    `;
  }
  return { duplicate: false, pilotId };
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  const gate = interpretWebhook({
    signatureHeader: signature,
    secretConfigured: Boolean(secret),
  });
  if (!gate.ok) {
    return Response.json({ error: gate.reason }, { status: gate.status });
  }
  const raw = await request.text();
  let event: StripeLikeEvent;
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret as string);
    event = stripe.webhooks.constructEvent(raw, signature as string, secret as string) as unknown as StripeLikeEvent;
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }
  const result = await applyVerifiedStripeEvent(event);
  return Response.json({ received: true, ...result });
}

export async function previewDecision(userId: string, data: { evidence: EvidenceItem[] }) {
    await ensureActor(userId);
    return evaluateDecision(data.evidence);
}

export async function createDecision(userId: string, data: { pilotId: string; evidence: EvidenceItem[] }): Promise<Decision> {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "decision.write");
    await mutateGuard(actor, "decision.write");
    const pilot = await scopedPilot(actor.organizationId, data.pilotId);
    if (pilot.paymentStatus !== "paid") throw new Error("Analysis opens after the pilot is paid");
    const evaluation = evaluateDecision(data.evidence);
    if ("error" in evaluation) throw new Error(evaluation.error);
    const id = newId();
    const status = evaluation.requiresHumanApproval ? "pending_approval" : "recommended";
    const sql = await getSql();
    await sql`
      insert into decisions (
        id, organization_id, user_id, pilot_id, rule_version, recommended_band,
        proposed_action, status, confidence_rationale, evidence_json,
        source_timestamps_json, rules_fired_json
      ) values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${pilot.id},
        ${evaluation.ruleVersion}, ${evaluation.recommendedBand}, ${evaluation.proposedAction},
        ${status}, ${evaluation.confidenceRationale}, ${JSON.stringify(data.evidence)},
        ${JSON.stringify(evaluation.sourceTimestamps)}, ${JSON.stringify(evaluation.rulesFired)}
      )
    `;
    await sql`
      update pilots
      set status = ${evaluation.requiresHumanApproval ? "decision_pending" : "in_analysis"},
          updated_at = now()
      where id = ${pilot.id} and organization_id = ${actor.organizationId}
    `;
    await writeAudit(actor, "decision.create", "decision", id, {
      proposedAction: evaluation.proposedAction,
      status,
      ruleVersion: evaluation.ruleVersion,
    });
    const rows = await sql`select * from decisions where id = ${id} and organization_id = ${actor.organizationId}`;
    return mapDecision(rows[0]);
}

export async function listDecisions(userId: string) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`
      select d.*, p.title as pilot_title
      from decisions d
      join pilots p on p.id = d.pilot_id and p.organization_id = d.organization_id
      where d.organization_id = ${actor.organizationId}
      order by d.created_at desc
    `;
    return rows.map((r) => ({
      ...mapDecision(r),
      pilotTitle: String((r as { pilot_title?: string }).pilot_title ?? ""),
    }));
}

export async function getDecision(userId: string, data: { id: string }) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`select * from decisions where id = ${data.id} and organization_id = ${actor.organizationId} limit 1`;
    if (!rows[0]) throw new Error("Decision not found");
    const decision = mapDecision(rows[0]);
    const pilot = await scopedPilot(actor.organizationId, decision.pilotId);
    return { decision, pilot };
}

export async function patchDecision(userId: string, data: { id: string; evidence?: EvidenceItem[]; approvalNote?: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "decision.write");
    await mutateGuard(actor, "decision.write");
    const sql = await getSql();
    const rows = await sql`select * from decisions where id = ${data.id} and organization_id = ${actor.organizationId} limit 1`;
    if (!rows[0]) throw new Error("Decision not found");
    const current = mapDecision(rows[0]);
    if (current.status === "approved" || current.status === "withdrawn") {
      throw new Error("Approved or withdrawn decisions are immutable");
    }
    if (data.evidence) {
      const evaluation = evaluateDecision(data.evidence);
      if ("error" in evaluation) throw new Error(evaluation.error);
      const status = evaluation.requiresHumanApproval ? "pending_approval" : "recommended";
      await sql`
        update decisions set
          rule_version = ${evaluation.ruleVersion},
          recommended_band = ${evaluation.recommendedBand},
          proposed_action = ${evaluation.proposedAction},
          status = ${status},
          confidence_rationale = ${evaluation.confidenceRationale},
          evidence_json = ${JSON.stringify(data.evidence)},
          source_timestamps_json = ${JSON.stringify(evaluation.sourceTimestamps)},
          rules_fired_json = ${JSON.stringify(evaluation.rulesFired)},
          updated_at = now()
        where id = ${current.id} and organization_id = ${actor.organizationId}
      `;
    }
    if (data.approvalNote !== undefined) {
      await sql`
        update decisions set approval_note = ${data.approvalNote}, updated_at = now()
        where id = ${current.id} and organization_id = ${actor.organizationId}
      `;
    }
    await writeAudit(actor, "decision.update", "decision", current.id, {
      fields: Object.keys(data).filter((k) => k !== "id"),
    });
    const next = await sql`select * from decisions where id = ${current.id} and organization_id = ${actor.organizationId}`;
    return mapDecision(next[0]);
}

export async function approveDecision(userId: string, data: { id: string; note?: string }) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "decision.approve");
    await mutateGuard(actor, "decision.approve");
    const sql = await getSql();
    const rows = await sql`
      update decisions
      set status = ${"approved"},
          approved_by_user_id = ${actor.userId},
          approved_at = now(),
          approval_note = ${data.note?.trim() ?? ""},
          updated_at = now()
      where id = ${data.id}
        and organization_id = ${actor.organizationId}
        and status = ${"pending_approval"}
      returning *
    `;
    if (!rows[0]) throw new Error("No pending decision to approve");
    const decision = mapDecision(rows[0]);
    await sql`
      update pilots set status = ${"in_analysis"}, updated_at = now()
      where id = ${decision.pilotId} and organization_id = ${actor.organizationId}
    `;
    await writeAudit(actor, "decision.approve", "decision", decision.id, {
      proposedAction: decision.proposedAction,
    });
    return decision;
}

export async function generateReport(userId: string, data: { pilotId: string }): Promise<Report> {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "report.write");
    await mutateGuard(actor, "report.write");
    const pilot = await scopedPilot(actor.organizationId, data.pilotId);
    if (pilot.paymentStatus !== "paid") throw new Error("Reports require a paid pilot");
    const sql = await getSql();
    const drows = await sql`
      select * from decisions
      where organization_id = ${actor.organizationId} and pilot_id = ${pilot.id}
      order by created_at desc
      limit 1
    `;
    if (!drows[0]) throw new Error("Record an evidence-backed decision before generating a report");
    const decision = mapDecision(drows[0]);
    if (decision.proposedAction === "BLOCK" && decision.status !== "approved") {
      throw new Error("BLOCK recommendations need founder/admin approval before a report is issued");
    }
    const prospect = await scopedProspect(actor.organizationId, pilot.prospectId);
    const id = newId();
    const title = `Supply chain risk audit — ${prospect.companyName}`;
    const summary = [
      `Advisory ${decision.proposedAction} (${decision.recommendedBand}) under ${decision.ruleVersion}.`,
      decision.status === "approved" ? "Human-approved." : "Recorded as an advisory recommendation.",
      prospect.isSample ? "This file is a labeled sample walkthrough, not live intelligence." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const body = [
      `Scope: ${pilot.scope || "Not specified."}`,
      `Evidence items: ${decision.evidence.length}.`,
      ...decision.evidence.map(
        (e) => `• ${e.title} [${e.kind}] source=${e.sourceName} observed=${e.observedAt} confidence=${e.confidence}. ${e.excerpt}`,
      ),
      `Rationale: ${decision.confidenceRationale}`,
    ].join("\n");
    await sql`
      insert into reports (
        id, organization_id, user_id, pilot_id, decision_id, title, summary, body, disclaimer
      ) values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${pilot.id}, ${decision.id},
        ${title}, ${summary}, ${body}, ${REPORT_DISCLAIMER}
      )
    `;
    await sql`
      update pilots set status = ${"reported"}, updated_at = now()
      where id = ${pilot.id} and organization_id = ${actor.organizationId}
    `;
    await writeAudit(actor, "report.generate", "report", id, { pilotId: pilot.id, decisionId: decision.id });
    const rows = await sql`select * from reports where id = ${id} and organization_id = ${actor.organizationId}`;
    return mapReport(rows[0]);
}

export async function listReports(userId: string) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`
      select r.*, pr.company_name
      from reports r
      join pilots p on p.id = r.pilot_id and p.organization_id = r.organization_id
      join prospects pr on pr.id = p.prospect_id and pr.organization_id = r.organization_id
      where r.organization_id = ${actor.organizationId}
      order by r.created_at desc
    `;
    return rows.map((r) => ({
      ...mapReport(r),
      companyName: String((r as { company_name?: string }).company_name ?? ""),
    }));
}

export async function getReport(userId: string, data: { id: string }) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`select * from reports where id = ${data.id} and organization_id = ${actor.organizationId} limit 1`;
    if (!rows[0]) throw new Error("Report not found");
    const report = mapReport(rows[0]);
    const pilot = await scopedPilot(actor.organizationId, report.pilotId);
    const prospect = await scopedProspect(actor.organizationId, pilot.prospectId);
    let decision: Decision | null = null;
    if (report.decisionId) {
      const d = await sql`select * from decisions where id = ${report.decisionId} and organization_id = ${actor.organizationId} limit 1`;
      if (d[0]) decision = mapDecision(d[0]);
    }
    return { report, pilot, prospect, decision };
}

export async function getReportPdf(userId: string, data: { id: string }) {
    const actor = await ensureActor(userId);
    await mutateGuard(actor, "report.pdf");
    const sql = await getSql();
    const rows = await sql`select * from reports where id = ${data.id} and organization_id = ${actor.organizationId} limit 1`;
    if (!rows[0]) throw new Error("Report not found");
    const report = mapReport(rows[0]);
    const pilot = await scopedPilot(actor.organizationId, report.pilotId);
    const prospect = await scopedProspect(actor.organizationId, pilot.prospectId);
    let decision: Decision | null = null;
    if (report.decisionId) {
      const d = await sql`select * from decisions where id = ${report.decisionId} and organization_id = ${actor.organizationId} limit 1`;
      if (d[0]) decision = mapDecision(d[0]);
    }
    const bytes = await buildReportPdf({ report, pilot, prospect, decision });
    await writeAudit(actor, "report.pdf", "report", report.id, {});
    const slug = prospect.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    return {
      filename: `verityx-${slug || "report"}.pdf`,
      base64: bytesToBase64(bytes),
    };
}

export async function listFeedback(userId: string) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`
      select f.*, pr.company_name
      from feedback f
      join pilots p on p.id = f.pilot_id and p.organization_id = f.organization_id
      join prospects pr on pr.id = p.prospect_id and pr.organization_id = f.organization_id
      where f.organization_id = ${actor.organizationId}
      order by f.created_at desc
    `;
    return rows.map((r) => ({
      ...mapFeedback(r),
      companyName: String((r as { company_name?: string }).company_name ?? ""),
    }));
}

export async function createFeedback(userId: string, data: { pilotId: string; kind: string; rating?: number; comment?: string }): Promise<Feedback> {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "learning.write");
    await mutateGuard(actor, "learning.write");
    await scopedPilot(actor.organizationId, data.pilotId);
    const id = newId();
    const sql = await getSql();
    await sql`
      insert into feedback (id, organization_id, user_id, pilot_id, kind, rating, comment)
      values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${data.pilotId},
        ${data.kind || "delivery"}, ${data.rating ?? null}, ${data.comment?.trim() ?? ""}
      )
    `;
    await writeAudit(actor, "feedback.create", "feedback", id, { kind: data.kind });
    const rows = await sql`select * from feedback where id = ${id} and organization_id = ${actor.organizationId}`;
    return mapFeedback(rows[0]);
}

export async function upsertOutcome(userId: string, data: {
    pilotId: string;
    outcomeAccuracy?: Outcome["outcomeAccuracy"];
    outcomeValue?: string;
    timeToResolutionDays?: number | null;
    caseStudyPermission?: Outcome["caseStudyPermission"];
    followUpAt?: string | null;
    notes?: string;
  }): Promise<Outcome> {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "learning.write");
    await mutateGuard(actor, "learning.write");
    const pilot = await scopedPilot(actor.organizationId, data.pilotId);
    const sql = await getSql();
    const existing = await sql`select * from outcomes where organization_id = ${actor.organizationId} and pilot_id = ${pilot.id} limit 1`;
    const followUp =
      data.followUpAt === undefined
        ? undefined
        : data.followUpAt
          ? new Date(data.followUpAt).toISOString()
          : null;
    if (existing[0]) {
      const cur = mapOutcome(existing[0]);
      const accuracy = data.outcomeAccuracy ?? cur.outcomeAccuracy;
      const value = data.outcomeValue ?? cur.outcomeValue;
      const days = data.timeToResolutionDays === undefined ? cur.timeToResolutionDays : data.timeToResolutionDays;
      const perm = data.caseStudyPermission ?? cur.caseStudyPermission;
      const notes = data.notes ?? cur.notes;
      const nextFollow = followUp === undefined ? cur.followUpAt : followUp;
      await sql`
        update outcomes set
          outcome_accuracy = ${accuracy},
          outcome_value = ${value},
          time_to_resolution_days = ${days},
          case_study_permission = ${perm},
          follow_up_at = ${nextFollow},
          notes = ${notes},
          updated_at = now()
        where id = ${cur.id} and organization_id = ${actor.organizationId}
      `;
      await writeAudit(actor, "outcome.update", "outcome", cur.id, {});
      const rows = await sql`select * from outcomes where id = ${cur.id} and organization_id = ${actor.organizationId}`;
      return mapOutcome(rows[0]);
    }
    const id = newId();
    await sql`
      insert into outcomes (
        id, organization_id, user_id, pilot_id, outcome_accuracy, outcome_value,
        time_to_resolution_days, case_study_permission, follow_up_at, notes
      ) values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${pilot.id},
        ${data.outcomeAccuracy ?? "unknown"}, ${data.outcomeValue ?? ""},
        ${data.timeToResolutionDays ?? null}, ${data.caseStudyPermission ?? "undecided"},
        ${followUp ?? new Date().toISOString()}, ${data.notes ?? ""}
      )
    `;
    await sql`
      update pilots set status = ${"follow_up"}, updated_at = now()
      where id = ${pilot.id} and organization_id = ${actor.organizationId}
    `;
    await writeAudit(actor, "outcome.create", "outcome", id, { pilotId: pilot.id });
    const rows = await sql`select * from outcomes where id = ${id} and organization_id = ${actor.organizationId}`;
    return mapOutcome(rows[0]);
}

export async function listOutcomes(userId: string) {
    const actor = await ensureActor(userId);
    const sql = await getSql();
    const rows = await sql`
      select o.*, pr.company_name, p.title as pilot_title
      from outcomes o
      join pilots p on p.id = o.pilot_id and p.organization_id = o.organization_id
      join prospects pr on pr.id = p.prospect_id and pr.organization_id = o.organization_id
      where o.organization_id = ${actor.organizationId}
      order by o.updated_at desc
    `;
    return rows.map((r) => ({
      ...mapOutcome(r),
      companyName: String((r as { company_name?: string }).company_name ?? ""),
      pilotTitle: String((r as { pilot_title?: string }).pilot_title ?? ""),
    }));
}

export async function listAuditLogs(userId: string) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "audit.read");
    const sql = await getSql();
    const rows = await sql`
      select * from audit_logs
      where organization_id = ${actor.organizationId}
      order by created_at desc
      limit 200
    `;
    return rows.map(mapAudit);
}

export async function loadSampleWalkthrough(userId: string) {
    const actor = await ensureActor(userId);
    assertCan(actor.role, "prospect.write");
    await mutateGuard(actor, "sample");
    const sql = await getSql();
    const existing = await sql`select * from prospects where organization_id = ${actor.organizationId} and is_sample = true limit 1`;
    if (existing[0]) {
      const prospect = mapProspect(existing[0]);
      const pilots = await sql`select * from pilots where organization_id = ${actor.organizationId} and prospect_id = ${prospect.id} limit 1`;
      return { prospect, pilot: pilots[0] ? mapPilot(pilots[0]) : null };
    }
    const prospectId = newId();
    await sql`
      insert into prospects (
        id, organization_id, user_id, company_name, contact_name, contact_email,
        sector, region, stage, notes, is_sample
      ) values (
        ${prospectId}, ${actor.organizationId}, ${actor.userId},
        ${"Harborline Parts Co. (sample)"}, ${"Priya Shah"}, ${"priya@harborline.example"},
        ${"Industrial fasteners"}, ${"EU / Taiwan"}, ${"discovery"},
        ${"SAMPLE WALKTHROUGH — not live intelligence. Use this file to exercise the $2,500 / 72-hour loop. Do not treat any contents as a real-world finding."},
        ${true}
      )
    `;
    const pilotId = newId();
    await sql`
      insert into pilots (
        id, organization_id, user_id, prospect_id, title, scope, status,
        sla_hours, price_usd, payment_status, inputs_received_at, is_sample
      ) values (
        ${pilotId}, ${actor.organizationId}, ${actor.userId}, ${prospectId},
        ${"Harborline Parts · tier-1 fastener screen (sample)"},
        ${"Map declared tier-1 fastener suppliers and screen for documentation gaps and sanctions exposure. Advisory only. Sample walkthrough — not live intelligence."},
        ${"awaiting_payment"}, ${PILOT_SLA_HOURS}, ${PILOT_PRICE_USD}, ${"unpaid"}, now(), ${true}
      )
    `;
    await writeAudit(actor, "sample.load", "pilot", pilotId, { labeled: true });
    return {
      prospect: await scopedProspect(actor.organizationId, prospectId),
      pilot: await scopedPilot(actor.organizationId, pilotId),
    };
}

export async function logOutreach(
  userId: string,
  data: {
    id: string;
    channel?: OutreachChannel;
    subject?: string;
    body?: string;
  },
): Promise<{ prospect: Prospect; outreach: OutreachEvent }> {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "prospect.write");
  await mutateGuard(actor, "prospect.contact");
  const prospect = await scopedProspect(actor.organizationId, data.id);
  const channel: OutreachChannel = data.channel ?? "email";
  if (channel === "email" && !prospect.contactEmail.trim()) {
    throw new Error("Add a contact email before logging outreach");
  }
  const sender =
    (await listMembersForOrg(actor.organizationId)).find((m) => m.userId === actor.userId)?.name ?? "Matt Boyer";
  const generated = outreachCopy({
    companyName: prospect.companyName,
    contactName: prospect.contactName,
    senderName: sender,
  });
  const subject = (data.subject ?? generated.subject).trim();
  const body = (data.body ?? generated.body).trim();
  if (!subject || !body) throw new Error("Outreach subject and body are required");
  const eventId = newId();
  const sql = await getSql();
  await sql`
    insert into outreach_events (
      id, organization_id, user_id, prospect_id, channel, subject, body, status
    ) values (
      ${eventId}, ${actor.organizationId}, ${actor.userId}, ${prospect.id},
      ${channel}, ${subject}, ${body}, ${"logged"}
    )
  `;
  const nextStage = prospect.stage === "lead" ? "qualified" : prospect.stage;
  await sql`
    update prospects
    set outreach_count = outreach_count + 1,
        last_contacted_at = now(),
        stage = ${nextStage},
        updated_at = now()
    where id = ${prospect.id} and organization_id = ${actor.organizationId}
  `;
  await writeAudit(actor, "prospect.contact", "prospect", prospect.id, { channel, subject });
  const rows = await sql`select * from outreach_events where id = ${eventId} limit 1`;
  return {
    prospect: await scopedProspect(actor.organizationId, prospect.id),
    outreach: mapOutreach(rows[0]!),
  };
}

export async function loadOwnBook(userId: string) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "prospect.write");
  await mutateGuard(actor, "book.load");
  const sql = await getSql();
  const existing = await sql<{ book_key: string }>`
    select book_key from prospects
    where organization_id = ${actor.organizationId}
      and book_key is not null and book_key <> ''
  `;
  const have = new Set(existing.map((r) => r.book_key));
  let created = 0;
  for (const row of VERITYX_BOOK) {
    if (have.has(row.key)) continue;
    const id = newId();
    await sql`
      insert into prospects (
        id, organization_id, user_id, company_name, contact_name, contact_email,
        contact_role, sector, region, stage, notes, is_sample, book_key
      ) values (
        ${id}, ${actor.organizationId}, ${actor.userId}, ${row.companyName},
        ${row.contactName}, ${row.contactEmail}, ${row.contactRole},
        ${row.sector}, ${row.region}, ${row.stage}, ${row.notes},
        ${false}, ${row.key}
      )
    `;
    created += 1;
  }
  await writeAudit(actor, "book.load", "prospect", actor.organizationId, {
    created,
    total: VERITYX_BOOK.length,
  });
  const prospects = await sql`
    select * from prospects
    where organization_id = ${actor.organizationId}
      and book_key is not null
    order by company_name asc
  `;
  return {
    created,
    existing: VERITYX_BOOK.length - created,
    total: VERITYX_BOOK.length,
    prospects: prospects.map(mapProspect),
  };
}
