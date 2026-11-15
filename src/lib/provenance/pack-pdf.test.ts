import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildPackPdf } from "./pack-pdf.ts";
import { PACK_STATEMENT, PACK_VERSION, summarize, toPackItem, type PortfolioRow } from "./portfolio.ts";

const rows: PortfolioRow[] = Array.from({ length: 40 }, (_, i) => ({
  id: String(i),
  partNumber: `PN-${i}`,
  description: "Rotor magnet — grade N52 “high temp”",
  program: "FA8650-27-C-0001",
  supplier: "Acme Magnetics",
  passportCode: i % 3 ? "LP-AAAA-BBBB" : "",
  state: i % 3 ? (i % 2 ? "declared-clear" : "covered-country-declared") : "no-passport",
  ackState: null,
  changed: false,
  lot: i % 3
    ? { code: "LP-AAAA-BBBB", publisher: "Pub 株式会社", lotRef: "L1", material: "ndfeb_magnet", status: "sealed", digest: "d".repeat(64), sealedAt: null, revokedReason: null }
    : null,
  analysis: i % 3
    ? {
        code: "LP-AAAA-BBBB",
        material: "ndfeb_magnet",
        stages: [
          { stage: "mined", covered: true, sources: [{ code: "LP-AAAA-BBBB", country: "AU", facility: "Mine", recycled: false }] },
          { stage: "separated", covered: true, sources: [{ code: "LP-AAAA-BBBB", country: i % 2 ? "MY" : "CN", facility: "Sep", recycled: false }] },
        ],
        missing: [],
        coveredCountryStages: [],
        revokedInputs: [],
        depth: 0,
        status: i % 2 ? "declared-clear" : "covered-country-declared",
      }
    : null,
}));

describe("evidence pack PDF", () => {
  it("renders many parts across pages, survives non-Latin text, and stays a valid PDF", async () => {
    const body = {
      version: PACK_VERSION,
      buyer: "Northwind Defense",
      program: "FA8650-27-C-0001",
      generatedAt: "2026-11-15T12:00:00.000Z",
      summary: summarize(rows),
      items: rows.map(toPackItem),
      passports: [{ code: "LP-AAAA-BBBB", digest: "d".repeat(64), publisher: "Pub", status: "sealed" }],
      statement: PACK_STATEMENT,
    };
    const bytes = await buildPackPdf(body, { digest: "e".repeat(64), ledgerHash: "f".repeat(64), receiptKid: "230be6f0463f70c9" });
    assert.ok(bytes.length > 2000);
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 3, `pages: ${doc.getPageCount()}`);
    assert.match(doc.getTitle() ?? "", /Northwind Defense/);
  });
});
