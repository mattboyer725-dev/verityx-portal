export const APP_NAME = "Verityx";
export const PILOT_PRICE_USD = 2500;
export const PILOT_SLA_HOURS = 72;
export const RULE_VERSION = "rules-v1.0-soft-prod";
export const MIN_PASSWORD_LENGTH = 10;

export const REPORT_DISCLAIMER =
  "This report is advisory. It is not a finding of fraud, a regulator determination, a legal conclusion, or a representation of objective truth. Recommendations are evidence-backed and versioned. A BLOCK position is recorded only after human approval. Do not treat this document as live external intelligence beyond the sources cited.";

export const PROSPECT_STAGES = [
  "lead",
  "qualified",
  "discovery",
  "proposal",
  "won",
  "lost",
] as const;

export const PILOT_STATUSES = [
  "intake",
  "awaiting_payment",
  "in_analysis",
  "decision_pending",
  "reported",
  "follow_up",
  "closed",
] as const;

export const ROLES = ["founder", "admin", "analyst", "viewer"] as const;

export const CORE_LOOP = [
  "prospect",
  "discovery",
  "pilot",
  "payment",
  "analysis",
  "decision",
  "report",
  "follow_up",
  "outcome",
  "learning",
] as const;
