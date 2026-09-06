import { RULE_VERSION, REPORT_DISCLAIMER } from "./constants.ts";
import type {
  EvidenceItem,
  ProposedAction,
  RecommendedBand,
} from "./types.ts";

export type { EvidenceItem };

export type Evaluation = {
  ruleVersion: string;
  recommendedBand: RecommendedBand;
  proposedAction: ProposedAction;
  requiresHumanApproval: boolean;
  confidenceRationale: string;
  rulesFired: string[];
  sourceTimestamps: { sourceName: string; observedAt: string }[];
  advisoryDisclaimer: string;
};

const ADVISORY =
  "Advisory only. This is not a finding of fraud, a regulator action, or a determination of objective truth.";

function material(item: EvidenceItem): boolean {
  return item.confidence !== "low" && item.sourceName.trim().length > 0;
}

/**
 * Explicit, versioned rules. Keyword hits such as "fraud" or "breach" in free
 * text NEVER auto-escalate to BLOCK. BLOCK is only proposed from a named
 * sanctions-screening rule and still requires human approval in soft-prod.
 */
export function evaluateDecision(
  evidence: EvidenceItem[],
): Evaluation | { error: string } {
  const usable = evidence.filter(
    (e) => e.title.trim() && e.sourceName.trim() && e.excerpt.trim() && e.observedAt,
  );
  if (usable.length === 0) {
    return {
      error:
        "At least one evidence item with title, named source, observed date, and excerpt is required.",
    };
  }

  const rulesFired: string[] = [];
  const sourceTimestamps = usable.map((e) => ({
    sourceName: e.sourceName.trim(),
    observedAt: e.observedAt,
  }));

  const sanctions = usable.filter(
    (e) => e.kind === "sanctions_screening" && material(e),
  );
  const highSanctions = sanctions.filter((e) => e.confidence === "high");
  const docGaps = usable.filter((e) => e.kind === "documentation_gap" && material(e));
  const media = usable.filter((e) => e.kind === "media_report");
  const corroboration = usable.filter(
    (e) => e.kind === "corroboration" && material(e),
  );
  const ops = usable.filter((e) => e.kind === "operational_event" && material(e));
  const financial = usable.filter(
    (e) => e.kind === "financial_signal" && material(e),
  );

  const independentSources = new Set(
    usable.filter(material).map((e) => e.sourceName.trim().toLowerCase()),
  );

  let recommendedBand: RecommendedBand = "MONITOR";
  let proposedAction: ProposedAction = "MONITOR";
  let requiresHumanApproval = false;

  if (highSanctions.length > 0) {
    rulesFired.push(
      "SANCTIONS-1: High-confidence sanctions screening hit with a named source proposes BLOCK, pending human approval.",
    );
    recommendedBand = "ESCALATE";
    proposedAction = "BLOCK";
    requiresHumanApproval = true;
  } else if (sanctions.length > 0) {
    rulesFired.push(
      "SANCTIONS-2: Sanctions screening signal without high confidence escalates for review; no BLOCK.",
    );
    recommendedBand = "ESCALATE";
    proposedAction = "ESCALATE";
  }

  if (independentSources.size >= 2 && (ops.length > 0 || financial.length > 0 || sanctions.length > 0)) {
    rulesFired.push(
      "CORROB-1: Two or more independent named sources support a material operational, financial, or screening signal.",
    );
    if (proposedAction !== "BLOCK") {
      recommendedBand = "ESCALATE";
      proposedAction = "ESCALATE";
    }
  }

  if (docGaps.length > 0 && proposedAction === "MONITOR") {
    rulesFired.push(
      "DOC-1: Supplier documentation gap with a named source warrants WATCH, not a conduct finding.",
    );
    recommendedBand = "WATCH";
    proposedAction = "WATCH";
  }

  const unverifiedMedia =
    media.length > 0 &&
    corroboration.length === 0 &&
    sanctions.length === 0 &&
    proposedAction === "MONITOR";
  if (unverifiedMedia) {
    rulesFired.push(
      "MEDIA-1: Media allegation without independent primary source stays MONITOR. Text is not treated as a fraud or breach finding.",
    );
    recommendedBand = "MONITOR";
    proposedAction = "MONITOR";
  }

  if (rulesFired.length === 0) {
    rulesFired.push(
      "DEFAULT-1: Evidence present but no material named-source rule fired. Default MONITOR.",
    );
  }

  rulesFired.push(
    "SAFETY-1: Free-text keywords (including fraud/breach) do not select an action. Action comes only from explicit rules.",
  );
  rulesFired.push(
    "SAFETY-2: BLOCK cannot be applied in soft-prod without founder/admin approval.",
  );

  const confidenceRationale = [
    `Rule version ${RULE_VERSION}.`,
    `${usable.length} evidence item(s), ${independentSources.size} independent named source(s).`,
    ...rulesFired,
    ADVISORY,
  ].join(" ");

  return {
    ruleVersion: RULE_VERSION,
    recommendedBand,
    proposedAction,
    requiresHumanApproval,
    confidenceRationale,
    rulesFired,
    sourceTimestamps,
    advisoryDisclaimer: REPORT_DISCLAIMER,
  };
}

export function emptyEvidence(): EvidenceItem {
  return {
    id: crypto.randomUUID(),
    kind: "documentation_gap",
    title: "",
    sourceName: "",
    sourceUrl: "",
    observedAt: new Date().toISOString().slice(0, 10),
    excerpt: "",
    confidence: "medium",
  };
}
