import type {
  PILOT_STATUSES,
  PROSPECT_STAGES,
  ROLES,
} from "./constants";

export type Role = (typeof ROLES)[number];
export type ProspectStage = (typeof PROSPECT_STAGES)[number];
export type PilotStatus = (typeof PILOT_STATUSES)[number];
export type PaymentStatus = "unpaid" | "checkout_open" | "paid" | "failed";
export type PaymentVia = "stripe_webhook" | "admin_manual" | null;

export type EvidenceKind =
  | "documentation_gap"
  | "sanctions_screening"
  | "media_report"
  | "operational_event"
  | "financial_signal"
  | "corroboration"
  | "other";

export type EvidenceConfidence = "low" | "medium" | "high";

export type EvidenceItem = {
  id: string;
  kind: EvidenceKind;
  title: string;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  excerpt: string;
  confidence: EvidenceConfidence;
};

export type RecommendedBand = "MONITOR" | "WATCH" | "ESCALATE";
export type ProposedAction = "MONITOR" | "WATCH" | "ESCALATE" | "BLOCK";
export type DecisionStatus =
  | "recommended"
  | "pending_approval"
  | "approved"
  | "withdrawn";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type Member = {
  userId: string;
  role: Role;
  name: string;
  email: string;
  createdAt: string;
};

export type Workspace = {
  userId: string;
  organization: Organization;
  role: Role;
  stripeConfigured: boolean;
  ruleVersion: string;
  members: Member[];
};

export type Prospect = {
  id: string;
  organizationId: string;
  userId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  sector: string;
  region: string;
  stage: ProspectStage;
  notes: string;
  bookKey: string | null;
  lastContactedAt: string | null;
  outreachCount: number;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OutreachChannel = "email" | "call" | "note";

export type OutreachEvent = {
  id: string;
  organizationId: string;
  userId: string;
  prospectId: string;
  channel: OutreachChannel;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
};

export type Pilot = {
  id: string;
  organizationId: string;
  userId: string;
  prospectId: string;
  title: string;
  scope: string;
  status: PilotStatus;
  slaHours: number;
  priceUsd: number;
  paymentStatus: PaymentStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  paidVia: PaymentVia;
  paidNote: string;
  inputsReceivedAt: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Decision = {
  id: string;
  organizationId: string;
  userId: string;
  pilotId: string;
  ruleVersion: string;
  recommendedBand: RecommendedBand;
  proposedAction: ProposedAction;
  status: DecisionStatus;
  confidenceRationale: string;
  evidence: EvidenceItem[];
  sourceTimestamps: { sourceName: string; observedAt: string }[];
  rulesFired: string[];
  approvedByUserId: string | null;
  approvedAt: string | null;
  approvalNote: string;
  createdAt: string;
  updatedAt: string;
};

export type Report = {
  id: string;
  organizationId: string;
  userId: string;
  pilotId: string;
  decisionId: string | null;
  title: string;
  summary: string;
  body: string;
  disclaimer: string;
  createdAt: string;
};

export type Feedback = {
  id: string;
  organizationId: string;
  userId: string;
  pilotId: string;
  kind: string;
  rating: number | null;
  comment: string;
  createdAt: string;
};

export type Outcome = {
  id: string;
  organizationId: string;
  userId: string;
  pilotId: string;
  outcomeAccuracy: "correct" | "partial" | "incorrect" | "unknown";
  outcomeValue: string;
  timeToResolutionDays: number | null;
  caseStudyPermission: "yes" | "no" | "undecided";
  followUpAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  organizationId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string;
  requestId: string;
  createdAt: string;
};

export type Dashboard = {
  workspace: Workspace;
  counts: {
    prospects: number;
    pilots: number;
    paidPilots: number;
    unpaidPilots: number;
    pendingApprovals: number;
    reports: number;
    outcomes: number;
    feedback: number;
    needsContact: number;
  };
  revenueUsd: number;
  loop: { stage: string; complete: boolean; detail: string }[];
  recentProspects: Prospect[];
  recentPilots: (Pilot & { companyName: string })[];
  recentOutcomes: (Outcome & { companyName: string; pilotTitle: string })[];
  recentAudit: AuditLog[];
  fetchedAt: string;
};
