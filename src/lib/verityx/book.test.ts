import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { outreachCopy, prospectReady, VERITYX_BOOK } from "./book.ts";

describe("VERITYX_BOOK", () => {
  it("files a unique commercial book, not sample intelligence", () => {
    const keys = VERITYX_BOOK.map((r) => r.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.length >= 12);
    assert.ok(keys.includes("sgre"));
    assert.ok(keys.includes("vac"));
    for (const row of VERITYX_BOOK) {
      assert.ok(row.companyName);
      assert.ok(row.contactName);
      assert.match(row.contactEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      assert.doesNotMatch(row.notes, /live intelligence/i);
    }
    const emails = VERITYX_BOOK.map((r) => r.contactEmail.toLowerCase());
    assert.equal(new Set(emails).size, emails.length);
  });
});

describe("outreachCopy", () => {
  it("names the company and stays advisory", () => {
    const copy = outreachCopy({
      companyName: "VACUUMSCHMELZE (VAC)",
      contactName: "Automotive & energy sales",
    });
    assert.match(copy.subject, /VACUUMSCHMELZE/);
    assert.match(copy.body, /\$2,500/);
    assert.match(copy.body, /advisory/i);
    assert.doesNotMatch(copy.body, /you are sanctioned/i);
  });
});

describe("prospectReady", () => {
  it("blocks contact and pilot until the file is finished", () => {
    const empty = prospectReady({
      companyName: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      outreachCount: 0,
    });
    assert.equal(empty.finishable, false);
    assert.equal(empty.readyToPilot, false);

    const filedInput = {
      companyName: "VAC",
      contactName: "Sales",
      contactEmail: "sales@vac.example",
      notes: "EU producer.",
      outreachCount: 0,
    };
    const filed = prospectReady(filedInput);
    assert.equal(filed.finishable, true);
    assert.equal(filed.email, true);
    assert.equal(filed.readyToPilot, false);

    const contacted = prospectReady({ ...filedInput, outreachCount: 1 });
    assert.equal(contacted.readyToPilot, true);
  });
});
