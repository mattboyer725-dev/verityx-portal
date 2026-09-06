import { newId } from "./format";
import type { EvidenceItem } from "./types";

/** Labeled sample evidence — not live intelligence. */
export function sampleHarborlineEvidence(): EvidenceItem[] {
  return [
    {
      id: newId(),
      kind: "documentation_gap",
      title: "Mill certificates missing for lot 44",
      sourceName: "Supplier packet 2026-08-12",
      sourceUrl: "",
      observedAt: "2026-08-12",
      excerpt:
        "The inbound packet for lot 44 lists heat numbers without corresponding mill certificates. Sample walkthrough — not a live finding.",
      confidence: "medium",
    },
    {
      id: newId(),
      kind: "media_report",
      title: "Trade blog alleges fraud and a data breach",
      sourceName: "Unverified industry blog",
      sourceUrl: "",
      observedAt: "2026-07-03",
      excerpt:
        "A secondary blog uses the words fraud and breach without a primary source. This must remain MONITOR under MEDIA-1.",
      confidence: "low",
    },
  ];
}

export function sampleSanctionsEvidence(): EvidenceItem {
  return {
    id: newId(),
    kind: "sanctions_screening",
    title: "Name match on published screening list",
    sourceName: "OFAC SDN snapshot (sample file)",
    sourceUrl: "",
    observedAt: "2026-09-01",
    excerpt:
      "Exact-name match against a dated list snapshot attached to this sample file. Advisory only; BLOCK still requires human approval.",
    confidence: "high",
  };
}
