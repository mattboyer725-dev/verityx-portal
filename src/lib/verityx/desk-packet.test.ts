import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDecision } from "./decision-engine.ts";
import { evidenceFromPacket, pickDeskScenario, poFromEvidence, sapHoldAfterApproval, type DeskPacketSlice } from "./desk-packet.ts";

const packet: DeskPacketSlice = {
  scenario: {
    id: "SG-4782",
    po: "4500187742",
    title: "Rare Earth Permanent Magnets",
    supplier: "Nanjing RareTech Ltd.",
    commodity: "NdFeB magnet",
    plant: "Brande, DK",
    currency: "EUR",
    proposed: 6_950_000,
  },
  sap: { PurchaseOrder: "4500187742", ReleaseStatus: "HOLD" },
  consensus: { verdict: "VERIFIED", market: 5_700_000 },
  risk: { action: "HOLD_PO", anomalyPct: 21.9 },
  screen: {
    alerts: [
      { type: "ESG", text: "EcoVadis Bronze · 48" },
      { type: "SANCTIONS", text: "UN consolidated hit on Nanjing" },
    ],
    sanctions: { matched: true, source: "OpenSanctions + UN" },
    ecovadis: { score: 48, medal: "Bronze" },
  },
  provenance: {
    dppId: "dpp:eu:sgre:sg-4782:187742",
    circulorLot: "CIR-SGRE-187742",
    gs1: "https://id.gs1.org/01/04012345678901/21/187742",
  },
  compliance: { cbam: "IN_SCOPE", gate: "REVIEW" },
  seal: { hash: "abc123def456", quorum: "2f+1=19", finality: "committed", pbft: { commitOk: 25 } },
  ledger: { merkleRoot: "00ff11aa", depth: 4, intact: true },
  auth: { issuer: "https://verityx.okta.com/oauth2/default", seat: { email: "elena.hartmann@siemensgamesa.com" } },
  message: "HOLD PO · VERIFIED · PBFT 25/27",
};

describe("pickDeskScenario", () => {
  it("pins Dy lots, NdPr alloy, and defaults to sintered magnets", () => {
    assert.equal(pickDeskScenario({ notes: "H-grade Dy dopant" }), "SG-9304");
    assert.equal(pickDeskScenario({ sector: "NdPr alloy" }), "SG-5191");
    assert.equal(pickDeskScenario({ companyName: "Siemens Gamesa" }), "SG-4782");
    assert.equal(pickDeskScenario({ scenarioId: "SG-5191" }), "SG-5191");
  });
});

describe("evidenceFromPacket", () => {
  it("files SAP, Circulor, PBFT and a sanctions hit without auto-BLOCK language as a finding", () => {
    const items = evidenceFromPacket(packet);
    const kinds = items.map((i) => i.kind);
    assert.ok(kinds.includes("operational_event"));
    assert.ok(kinds.includes("financial_signal"));
    assert.ok(kinds.includes("corroboration"));
    assert.ok(kinds.includes("sanctions_screening"));
    assert.ok(kinds.includes("documentation_gap"));
    assert.ok(items.some((i) => i.sourceName.includes("SAP OData")));
    assert.ok(items.some((i) => i.excerpt.includes("CIR-SGRE-187742") || i.title.includes("CIR-SGRE")));
    assert.doesNotMatch(items.map((i) => i.excerpt).join(" "), /you are sanctioned|fraud finding/i);
    assert.ok(items.some((i) => i.kind === "sanctions_screening" && /Nanjing/i.test(i.excerpt)));
    const rec = evaluateDecision(items);
    assert.ok(!("error" in rec));
    if ("error" in rec) return;
    assert.equal(rec.proposedAction, "BLOCK");
    assert.equal(rec.requiresHumanApproval, true);
    assert.equal(
      sapHoldAfterApproval({
        proposedAction: rec.proposedAction,
        status: rec.requiresHumanApproval ? "pending_approval" : "recommended",
        isSample: false,
      }),
      null,
    );
  });
});

describe("poFromEvidence", () => {
  it("extracts the analog PO from the SAP operational event", () => {
    const items = evidenceFromPacket(packet);
    assert.equal(poFromEvidence(items), "4500187742");
    assert.equal(poFromEvidence([]), null);
  });
});

describe("sapHoldAfterApproval", () => {
  it("posts HOLD only after a human-approved BLOCK on a live file", () => {
    assert.equal(sapHoldAfterApproval({ proposedAction: "BLOCK", status: "pending_approval", isSample: false }), null);
    assert.equal(sapHoldAfterApproval({ proposedAction: "BLOCK", status: "approved", isSample: true }), null);
    assert.equal(sapHoldAfterApproval({ proposedAction: "ESCALATE", status: "approved", isSample: false }), null);
    assert.equal(sapHoldAfterApproval({ proposedAction: "WATCH", status: "recommended", isSample: false }), null);
    assert.equal(sapHoldAfterApproval({ proposedAction: "BLOCK", status: "approved", isSample: false }), "HOLD");
  });
});
