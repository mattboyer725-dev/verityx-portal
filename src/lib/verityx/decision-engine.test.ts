import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDecision, type EvidenceItem } from "./decision-engine.ts";

function ev(partial: Partial<EvidenceItem> & Pick<EvidenceItem, "kind" | "title">): EvidenceItem {
  return {
    id: "e1",
    sourceName: "Source A",
    sourceUrl: "",
    observedAt: "2026-09-01",
    excerpt: "Observed condition with a named source.",
    confidence: "medium",
    ...partial,
  };
}

describe("evaluateDecision", () => {
  it("rejects empty evidence", () => {
    const r = evaluateDecision([]);
    assert.ok("error" in r);
  });

  it("does not BLOCK on fraud/breach keywords in media text", () => {
    const r = evaluateDecision([
      ev({
        kind: "media_report",
        title: "Blog alleges fraud and breach",
        excerpt: "The supplier committed fraud and a data breach last year.",
        confidence: "high",
      }),
    ]);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.proposedAction, "MONITOR");
    assert.equal(r.requiresHumanApproval, false);
    assert.ok(r.rulesFired.some((x) => x.startsWith("MEDIA-1") || x.startsWith("SAFETY-1")));
  });

  it("proposes BLOCK only for high-confidence named sanctions hits, still requiring approval", () => {
    const r = evaluateDecision([
      ev({
        kind: "sanctions_screening",
        title: "OFAC match",
        sourceName: "OFAC SDN list snapshot",
        excerpt: "Name match against a published screening list.",
        confidence: "high",
      }),
    ]);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.proposedAction, "BLOCK");
    assert.equal(r.requiresHumanApproval, true);
    assert.equal(r.recommendedBand, "ESCALATE");
  });

  it("maps documentation gaps to WATCH, not BLOCK", () => {
    const r = evaluateDecision([
      ev({
        kind: "documentation_gap",
        title: "Missing mill certs",
        sourceName: "Supplier packet 2026-08-12",
      }),
    ]);
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.proposedAction, "WATCH");
    assert.equal(r.requiresHumanApproval, false);
  });
});
