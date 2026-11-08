import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePilotRequest, prospectNote } from "./pilot-request.ts";

const good = { name: "Ana Ruiz", email: "Ana@Example.com", company: "Northwind Motors", role: "Category manager", commodity: "NdFeB magnets", poBand: "$100k – $1M", message: "Q1 order" };

test("a complete request parses and normalises the email", () => {
  const r = parsePilotRequest(good);
  assert.ok(r.ok && !r.bot);
  assert.equal(r.ok && r.value.email, "ana@example.com");
});

test("bad input is refused with a reason a person can act on", () => {
  assert.match((parsePilotRequest({ ...good, email: "nope" }) as { error: string }).error, /valid work email/);
  assert.match((parsePilotRequest({ ...good, commodity: "Gold" }) as { error: string }).error, /what you are buying/);
  assert.match((parsePilotRequest({ ...good, company: "x" }) as { error: string }).error, /Company/);
  assert.match((parsePilotRequest({ ...good, message: "a".repeat(2001) }) as { error: string }).error, /2000/);
  assert.match((parsePilotRequest({ ...good, name: "A\u0000B" }) as { error: string }).error, /not allowed/);
});

test("the honeypot marks bots without telling them", () => {
  const r = parsePilotRequest({ ...good, website: "http://spam" });
  assert.ok(r.ok && r.bot);
});

test("the pipeline note carries what the owner needs", () => {
  const r = parsePilotRequest(good);
  assert.ok(r.ok);
  const n = prospectNote(r.ok ? r.value : (null as never), "PR-1");
  assert.match(n, /PR-1/);
  assert.match(n, /ana@example.com/);
  assert.match(n, /NdFeB magnets · order size \$100k – \$1M/);
});
