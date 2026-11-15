import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isChanged,
  itemState,
  normalizeItem,
  packDigest,
  parseCsvRows,
  parsePortfolioCsv,
  PACK_STATEMENT,
  PACK_VERSION,
  sortRows,
  summarize,
  toPackItem,
  type PortfolioRow,
  type ResolvedLot,
} from "./portfolio.ts";
import type { ChainAnalysis } from "./passport.ts";

const lot = (status: ResolvedLot["status"] = "sealed"): ResolvedLot => ({
  code: "LP-AAAA-BBBB",
  publisher: "Pub",
  lotRef: "L1",
  material: "ndfeb_magnet",
  status,
  digest: "d".repeat(64),
  sealedAt: "2026-11-15T00:00:00.000Z",
  revokedReason: status === "revoked" ? "bad assay" : null,
});
const analysis = (status: ChainAnalysis["status"]): ChainAnalysis => ({
  code: "LP-AAAA-BBBB",
  material: "ndfeb_magnet",
  stages: [{ stage: "produced", covered: true, sources: [{ code: "LP-AAAA-BBBB", country: "US", facility: "P", recycled: false }] }],
  missing: [],
  coveredCountryStages: [],
  revokedInputs: [],
  depth: 0,
  status,
});
const row = (o: Partial<PortfolioRow>): PortfolioRow => ({
  id: "x",
  partNumber: "P-1",
  description: "",
  program: "",
  supplier: "",
  passportCode: "",
  state: "no-passport",
  ackState: null,
  changed: false,
  lot: null,
  analysis: null,
  ...o,
});

describe("CSV", () => {
  it("handles quotes, embedded commas and newlines, CRLF and a BOM", () => {
    const rows = parseCsvRows('﻿a,b\r\n"x, y","say ""hi""\nthere"\r\n\r\n');
    assert.deepEqual(rows, [["a", "b"], ["x, y", 'say "hi"\nthere']]);
  });

  it("maps flexible headers and reports bad rows without failing the import", () => {
    const csv = [
      "Part Number,Description,Contract,Vendor,Passport Code",
      "PN-100,Rotor magnet,FA8650-27-C-0001,Acme Magnetics,lp-aaaa-bbbb",
      "PN-101,Stator,FA8650-27-C-0001,Acme Magnetics,",
      ",missing part,,,",
      "PN-102,Actuator,,,NOT-A-CODE",
    ].join("\n");
    const r = parsePortfolioCsv(csv);
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].passportCode, "LP-AAAA-BBBB");
    assert.equal(r.items[0].program, "FA8650-27-C-0001");
    assert.equal(r.items[1].passportCode, "");
    assert.equal(r.errors.length, 2);
    assert.match(r.errors[0], /Row 4/);
    assert.match(r.errors[1], /Row 5.*passport code/);
  });

  it("needs a part number column", () => {
    const r = parsePortfolioCsv("code\nLP-AAAA-BBBB");
    assert.equal(r.items.length, 0);
    assert.match(r.errors[0], /part number/);
  });
});

describe("item state", () => {
  it("covers every case", () => {
    assert.equal(itemState("", undefined, undefined), "no-passport");
    assert.equal(itemState("LP-AAAA-BBBB", undefined, undefined), "not-found");
    assert.equal(itemState("LP-AAAA-BBBB", lot("revoked"), analysis("declared-clear")), "revoked");
    assert.equal(itemState("LP-AAAA-BBBB", lot(), analysis("covered-country-declared")), "covered-country-declared");
    assert.equal(itemState("LP-AAAA-BBBB", lot(), analysis("declared-clear")), "declared-clear");
  });

  it("alerts only on a change from what the buyer acknowledged", () => {
    assert.equal(isChanged("revoked", null), false);
    assert.equal(isChanged("revoked", "revoked"), false);
    assert.equal(isChanged("revoked", "declared-clear"), true);
  });

  it("refuses bad input", () => {
    assert.throws(() => normalizeItem({ partNumber: " " }), /part number/);
    assert.throws(() => normalizeItem({ partNumber: "P", passportCode: "LP-1" }), /passport code/);
  });
});

describe("summary and ordering", () => {
  it("counts states and puts alerts and the worst states first", () => {
    const rows = [
      row({ partNumber: "A", state: "declared-clear" }),
      row({ partNumber: "B", state: "covered-country-declared" }),
      row({ partNumber: "C", state: "no-passport" }),
      row({ partNumber: "D", state: "declared-clear", changed: true }),
      row({ partNumber: "A", state: "revoked" }),
    ];
    const s = summarize(rows);
    assert.equal(s.total, 5);
    assert.equal(s.parts, 4);
    assert.equal(s["declared-clear"], 2);
    assert.equal(s.changed, 1);
    assert.deepEqual(sortRows(rows).map((r) => r.partNumber + ":" + r.state), [
      "D:declared-clear",
      "B:covered-country-declared",
      "A:revoked",
      "C:no-passport",
      "A:declared-clear",
    ]);
  });
});

describe("evidence pack digest", () => {
  it("is stable and changes with any item", async () => {
    const rows = [row({ partNumber: "A", passportCode: "LP-AAAA-BBBB", state: "declared-clear", lot: lot(), analysis: analysis("declared-clear") })];
    const body = {
      version: PACK_VERSION,
      buyer: "Buyer",
      program: "",
      generatedAt: "2026-11-15T00:00:00.000Z",
      summary: summarize(rows),
      items: rows.map(toPackItem),
      passports: [{ code: "LP-AAAA-BBBB", digest: "d".repeat(64), publisher: "Pub", status: "sealed" }],
      statement: PACK_STATEMENT,
    };
    const d1 = await packDigest(body);
    assert.equal(d1, await packDigest(structuredClone(body)));
    const d2 = await packDigest({ ...body, items: [{ ...body.items[0], state: "revoked" as const }] });
    assert.notEqual(d1, d2);
    assert.equal(body.items[0].stages[0].sources[0].country, "US");
  });
});
