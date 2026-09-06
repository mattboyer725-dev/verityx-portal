import { asBoolean, iso, isoOrNull, parseJson } from "./format";
import type {
  AuditLog,
  Decision,
  EvidenceItem,
  Feedback,
  Outcome,
  OutreachEvent,
  Pilot,
  Prospect,
  Report,
} from "./types";

type Row = Record<string, unknown>;

export function mapProspect(r: Row): Prospect {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    companyName: String(r.company_name ?? ""),
    contactName: String(r.contact_name ?? ""),
    contactEmail: String(r.contact_email ?? ""),
    contactRole: String(r.contact_role ?? ""),
    sector: String(r.sector ?? ""),
    region: String(r.region ?? ""),
    stage: r.stage as Prospect["stage"],
    notes: String(r.notes ?? ""),
    bookKey: r.book_key ? String(r.book_key) : null,
    lastContactedAt: isoOrNull(r.last_contacted_at),
    outreachCount: Number(r.outreach_count ?? 0),
    isSample: asBoolean(r.is_sample),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function mapPilot(r: Row): Pilot {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    prospectId: String(r.prospect_id),
    title: String(r.title ?? ""),
    scope: String(r.scope ?? ""),
    status: r.status as Pilot["status"],
    slaHours: Number(r.sla_hours ?? 72),
    priceUsd: Number(r.price_usd ?? 2500),
    paymentStatus: r.payment_status as Pilot["paymentStatus"],
    stripeCheckoutSessionId: r.stripe_checkout_session_id
      ? String(r.stripe_checkout_session_id)
      : null,
    stripePaymentIntentId: r.stripe_payment_intent_id
      ? String(r.stripe_payment_intent_id)
      : null,
    paidAt: isoOrNull(r.paid_at),
    paidVia: (r.paid_via as Pilot["paidVia"]) ?? null,
    paidNote: String(r.paid_note ?? ""),
    inputsReceivedAt: isoOrNull(r.inputs_received_at),
    isSample: asBoolean(r.is_sample),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function mapDecision(r: Row): Decision {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    pilotId: String(r.pilot_id),
    ruleVersion: String(r.rule_version),
    recommendedBand: r.recommended_band as Decision["recommendedBand"],
    proposedAction: r.proposed_action as Decision["proposedAction"],
    status: r.status as Decision["status"],
    confidenceRationale: String(r.confidence_rationale ?? ""),
    evidence: parseJson<EvidenceItem[]>(r.evidence_json, []),
    sourceTimestamps: parseJson(r.source_timestamps_json, []),
    rulesFired: parseJson<string[]>(r.rules_fired_json, []),
    approvedByUserId: r.approved_by_user_id ? String(r.approved_by_user_id) : null,
    approvedAt: isoOrNull(r.approved_at),
    approvalNote: String(r.approval_note ?? ""),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function mapReport(r: Row): Report {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    pilotId: String(r.pilot_id),
    decisionId: r.decision_id ? String(r.decision_id) : null,
    title: String(r.title ?? ""),
    summary: String(r.summary ?? ""),
    body: String(r.body ?? ""),
    disclaimer: String(r.disclaimer ?? ""),
    createdAt: iso(r.created_at),
  };
}

export function mapFeedback(r: Row): Feedback {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    pilotId: String(r.pilot_id),
    kind: String(r.kind ?? ""),
    rating: r.rating == null ? null : Number(r.rating),
    comment: String(r.comment ?? ""),
    createdAt: iso(r.created_at),
  };
}

export function mapOutreach(r: Row): OutreachEvent {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    prospectId: String(r.prospect_id),
    channel: (r.channel as OutreachEvent["channel"]) || "email",
    subject: String(r.subject ?? ""),
    body: String(r.body ?? ""),
    status: String(r.status ?? "logged"),
    createdAt: iso(r.created_at),
  };
}

export function mapOutcome(r: Row): Outcome {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    pilotId: String(r.pilot_id),
    outcomeAccuracy: r.outcome_accuracy as Outcome["outcomeAccuracy"],
    outcomeValue: String(r.outcome_value ?? ""),
    timeToResolutionDays:
      r.time_to_resolution_days == null ? null : Number(r.time_to_resolution_days),
    caseStudyPermission: r.case_study_permission as Outcome["caseStudyPermission"],
    followUpAt: isoOrNull(r.follow_up_at),
    notes: String(r.notes ?? ""),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function mapAudit(r: Row): AuditLog {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    actorUserId: String(r.actor_user_id),
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: r.entity_id ? String(r.entity_id) : null,
    metadata: String(r.metadata_json ?? "{}"),
    requestId: String(r.request_id ?? ""),
    createdAt: iso(r.created_at),
  };
}
