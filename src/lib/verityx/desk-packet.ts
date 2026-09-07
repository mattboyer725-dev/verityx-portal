import { newId } from "./format.ts";
import type { EvidenceItem, ProposedAction, DecisionStatus } from "./types.ts";

export const DESK_SCENARIO_IDS = ["SG-4782", "SG-5191", "SG-9304"] as const;

export type DeskPacketSlice = {
  scenario: {
    id: string;
    po: string;
    title: string;
    supplier: string;
    commodity: string;
    plant: string;
    currency: string;
    proposed: number;
  };
  sap: { PurchaseOrder: string; ReleaseStatus: string } | null;
  consensus: { verdict: string; market: number };
  risk: { action: string; anomalyPct: number };
  screen: {
    alerts: { type: string; text: string }[];
    sanctions: { matched: boolean; source?: string };
    gleif?: { lei?: string; name?: string } | null;
    ecovadis?: { score: number; medal: string } | null;
    prewave?: { level: string; headlines?: string[] } | null;
  };
  provenance: { dppId: string; circulorLot: string; gs1: string };
  compliance: { cbam: string; gate: string };
  seal: { hash: string; quorum: string; finality: string; pbft: { commitOk: number } };
  ledger: { merkleRoot: string; depth: number; intact: boolean };
  auth: { issuer: string; seat: { email: string } };
  message: string;
};

export function pickDeskScenario(input: {
  companyName?: string;
  sector?: string;
  notes?: string;
  scenarioId?: string;
}): string {
  const allowed = DESK_SCENARIO_IDS as readonly string[];
  if (input.scenarioId && allowed.includes(input.scenarioId)) return input.scenarioId;
  const blob = `${input.companyName ?? ""} ${input.sector ?? ""} ${input.notes ?? ""}`.toLowerCase();
  if (/dysprosium|\bdy\b/.test(blob)) return "SG-9304";
  if (/ndpr|alloy|baotou|neodymium/.test(blob)) return "SG-5191";
  return "SG-4782";
}

function day(iso = new Date().toISOString()) {
  return iso.slice(0, 10);
}

function item(
  kind: EvidenceItem["kind"],
  title: string,
  sourceName: string,
  excerpt: string,
  confidence: EvidenceItem["confidence"],
  sourceUrl = "",
): EvidenceItem {
  return {
    id: newId(),
    kind,
    title,
    sourceName,
    sourceUrl,
    observedAt: day(),
    excerpt,
    confidence,
  };
}

/** Map a live desk seal onto OS evidence. Advisory only — never auto-BLOCK. */
export function evidenceFromPacket(packet: DeskPacketSlice): EvidenceItem[] {
  const s = packet.scenario;
  const items: EvidenceItem[] = [];
  const sapStatus = packet.sap?.ReleaseStatus || "OPEN";
  items.push(
    item(
      "operational_event",
      `${s.po} · ${s.title}`,
      "SAP OData API_PURCHASEORDER_PROCESS_SRV",
      `${s.supplier} · ${s.commodity} · ${s.plant} · proposed ${s.proposed} ${s.currency} · release ${sapStatus}. Live analog tenant, not Siemens S/4HANA.`,
      "high",
      "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV",
    ),
  );
  items.push(
    item(
      "financial_signal",
      `Consensus ${packet.consensus.verdict} · anomaly ${packet.risk.anomalyPct.toFixed(1)}%`,
      "LME / REE socket + MAD consensus",
      `Market ${Math.round(packet.consensus.market)} vs proposed ${s.proposed} ${s.currency}. Risk action ${packet.risk.action}. ${packet.message}`,
      "medium",
      "/api/oracle",
    ),
  );
  items.push(
    item(
      "corroboration",
      `Circulor lot ${packet.provenance.circulorLot}`,
      "Circulor-shaped mass-balance ledger",
      `DPP ${packet.provenance.dppId}. GS1 ${packet.provenance.gs1}. Hashed custody on this host, not Circulor SaaS.`,
      "high",
      "/api/circulor/lots",
    ),
  );
  if (packet.screen.sanctions.matched) {
    items.push(
      item(
        "sanctions_screening",
        `Screen hit · ${s.supplier}`,
        packet.screen.sanctions.source || "OpenSanctions + UN",
        packet.screen.alerts.find((a) => a.type === "SANCTIONS")?.text ||
          "Named match on a published screening list. Advisory; BLOCK still needs human approval.",
        "high",
        "https://www.opensanctions.org/",
      ),
    );
  }
  const media = packet.screen.alerts.filter((a) => a.type === "MEDIA" || a.type === "ESG");
  for (const a of media.slice(0, 2)) {
    items.push(
      item(
        "media_report",
        a.text,
        a.type === "ESG" ? "EcoVadis-shaped scorecard (GLEIF + UN)" : "Prewave-shaped news RSS",
        a.text,
        "medium",
      ),
    );
  }
  if (packet.compliance.gate === "REVIEW" || packet.compliance.cbam === "IN_SCOPE") {
    items.push(
      item(
        "documentation_gap",
        `CBAM ${packet.compliance.cbam} · gate ${packet.compliance.gate}`,
        "COMPLIANCE agent",
        `Declared lot is ${packet.compliance.cbam === "IN_SCOPE" ? "in CBAM scope" : "out of CBAM scope"}. Dual-use / export gate ${packet.compliance.gate}. Documentation gaps only — not a regulator finding.`,
        "medium",
      ),
    );
  }
  items.push(
    item(
      "corroboration",
      `PBFT ${packet.seal.quorum} · ${packet.seal.finality}`,
      "27-host PBFT network",
      `Commit ${packet.seal.pbft.commitOk}/27. Seal ${packet.seal.hash.slice(0, 16)}. Merkle ${packet.ledger.merkleRoot.slice(0, 16)} · depth ${packet.ledger.depth} · intact ${String(packet.ledger.intact)}.`,
      "high",
      "/api/pbft",
    ),
  );
  items.push(
    item(
      "operational_event",
      `Seat ${packet.auth.seat.email}`,
      "Okta-shaped OIDC RS256",
      `Issuer ${packet.auth.issuer}. Password-grant JWT on this host, not Okta Workforce.`,
      "high",
      "/oauth2/default/.well-known/openid-configuration",
    ),
  );
  return items;
}

const PO_RE = /\b(45\d{8})\b/;

/** Pull a Siemens-style PO number out of live packet evidence. */
export function poFromEvidence(items: EvidenceItem[]): string | null {
  for (const e of items) {
    const blob = `${e.title} ${e.excerpt} ${e.sourceUrl}`;
    const m = blob.match(PO_RE);
    if (m) return m[1];
  }
  return null;
}

/**
 * Analog SAP HOLD is posted only after a human-approved BLOCK on a live
 * (non-sample) file. Pending BLOCK, advisory actions, and Harborline samples
 * never write back.
 */
export function sapHoldAfterApproval(input: {
  proposedAction: ProposedAction | string;
  status: DecisionStatus | string;
  isSample: boolean;
}): "HOLD" | null {
  if (input.isSample) return null;
  if (input.status !== "approved") return null;
  if (input.proposedAction !== "BLOCK") return null;
  return "HOLD";
}

