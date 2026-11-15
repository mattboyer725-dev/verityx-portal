import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeChain,
  canonicalPassport,
  isPassportCode,
  ledgerNotes,
  newPassportCode,
  parseDraft,
  passportDigest,
  requiredStages,
  sealProblems,
  type ChainNode,
  type StageDeclaration,
} from "./passport.ts";

const H = (c: string) => c.repeat(64);
const stage = (s: StageDeclaration["stage"], country: string, extra: Partial<StageDeclaration> = {}): StageDeclaration => ({
  stage: s,
  country,
  facility: `${s} plant`,
  operator: "",
  recycled: false,
  evidence: [{ name: `${s}.pdf`, sha256: H("a"), bytes: 10 }],
  ...extra,
});
const node = (code: string, material: ChainNode["material"], stages: StageDeclaration[], inputs: string[] = [], status: ChainNode["status"] = "sealed"): ChainNode => ({
  code,
  publisher: "Pub",
  lotRef: `lot-${code}`,
  material,
  massKg: 100,
  description: "",
  stages,
  inputs,
  status,
  digest: H("d"),
});

describe("passport codes", () => {
  it("mints shareable codes that the validator accepts", () => {
    for (let i = 0; i < 50; i++) assert.ok(isPassportCode(newPassportCode()));
    assert.ok(!isPassportCode("LP-ILOU-0000"), "Crockford excludes I, L, O, U");
    assert.ok(!isPassportCode("lp-7k3q-9xwd"));
  });
});

describe("required stages", () => {
  it("follows the DFARS chain from mine to finished magnet", () => {
    assert.deepEqual(requiredStages("ndfeb_magnet"), ["mined", "separated", "refined", "melted", "produced"]);
    assert.deepEqual(requiredStages("oxide"), ["mined", "separated"]);
    assert.deepEqual(requiredStages("concentrate"), ["mined"]);
  });
});

describe("parseDraft", () => {
  it("normalises, sorts stages upstream-first, dedupes inputs", () => {
    const d = parseDraft({
      material: "alloy",
      massKg: "250",
      lotRef: "  A-1  ",
      stages: [
        { stage: "melted", country: "us", facility: "Plant", evidence: [{ name: "c.pdf", sha256: H("B"), bytes: 3 }] },
        { stage: "mined", country: "AU", facility: "Mine", recycled: true, evidence: [] },
      ],
      inputs: ["LP-AAAA-BBBB", "lp-aaaa-bbbb"],
    });
    assert.equal(d.lotRef, "A-1");
    assert.equal(d.massKg, 250);
    assert.deepEqual(d.stages.map((s) => s.stage), ["mined", "melted"]);
    assert.equal(d.stages[1].country, "US");
    assert.equal(d.stages[1].evidence[0].sha256, H("b"));
    assert.equal(d.stages[0].recycled, true);
    assert.deepEqual(d.inputs, ["LP-AAAA-BBBB"]);
  });

  it("refuses duplicate stages, bad codes and bad fingerprints", () => {
    assert.throws(() => parseDraft({ material: "oxide", massKg: 1, stages: [{ stage: "mined" }, { stage: "mined" }] }), /twice/);
    assert.throws(() => parseDraft({ material: "oxide", massKg: 1, inputs: ["X"] }), /passport code/);
    assert.throws(
      () => parseDraft({ material: "oxide", massKg: 1, stages: [{ stage: "mined", evidence: [{ sha256: "nope" }] }] }),
      /fingerprint/,
    );
    assert.throws(() => parseDraft({ material: "gold", massKg: 1 }), /material/);
  });
});

describe("sealProblems", () => {
  it("lists what is missing before a seal", () => {
    const body = { ...node("LP-AAAA-AAAA", "oxide", [stage("separated", "", { evidence: [] })], ["LP-BBBB-BBBB"]), lotRef: "" };
    const problems = sealProblems(body, [node("LP-BBBB-BBBB", "concentrate", [stage("mined", "AU")], [], "draft")]);
    assert.ok(problems.some((p) => /lot or batch/.test(p)));
    assert.ok(problems.some((p) => /country/.test(p)));
    assert.ok(problems.some((p) => /evidence/.test(p)));
    assert.ok(problems.some((p) => /draft/.test(p)));
  });

  it("refuses a stage downstream of the material", () => {
    const body = node("LP-AAAA-AAAA", "oxide", [stage("produced", "US")]);
    assert.ok(sealProblems(body, []).some((p) => /downstream/.test(p)));
  });
});

describe("analyzeChain", () => {
  const mine = node("LP-MINE-0001", "concentrate", [stage("mined", "AU")]);
  const ox = node("LP-OXDE-0001", "oxide", [stage("separated", "MY")], ["LP-MINE-0001"]);
  const metal = node("LP-METL-0001", "metal", [stage("refined", "VN")], ["LP-OXDE-0001"]);
  const alloy = node("LP-ALLY-0001", "alloy", [stage("melted", "US")], ["LP-METL-0001"]);
  const magnet = node("LP-MAGN-0001", "ndfeb_magnet", [stage("produced", "US")], ["LP-ALLY-0001"]);
  const all = new Map([mine, ox, metal, alloy, magnet].map((n) => [n.code, n]));
  const resolve = (c: string) => all.get(c);

  it("covers mine to magnet across five publishers", () => {
    const a = analyzeChain(magnet, resolve);
    assert.equal(a.status, "declared-clear");
    assert.deepEqual(a.missing, []);
    assert.equal(a.depth, 4);
    assert.equal(a.stages.find((s) => s.stage === "separated")?.sources[0].country, "MY");
  });

  it("flags a covered-country stage anywhere upstream", () => {
    const cnOx = node("LP-OXDE-0002", "oxide", [stage("separated", "CN")], ["LP-MINE-0001"]);
    const m2 = node("LP-METL-0002", "metal", [stage("refined", "VN")], ["LP-OXDE-0002"]);
    const map = new Map(all);
    map.set(cnOx.code, cnOx);
    map.set(m2.code, m2);
    const a2 = node("LP-ALLY-0002", "alloy", [stage("melted", "US")], ["LP-METL-0002"]);
    const a = analyzeChain(a2, (c) => map.get(c));
    assert.equal(a.status, "covered-country-declared");
    assert.deepEqual(a.coveredCountryStages.map((s) => [s.stage, s.country]), [["separated", "CN"]]);
  });

  it("a blend is only covered when every input supplies the stage", () => {
    const untraced = node("LP-METL-0003", "metal", [stage("refined", "JP")]); // no inputs: mined/separated unknown
    const map = new Map(all);
    map.set(untraced.code, untraced);
    const blend = node("LP-ALLY-0003", "alloy", [stage("melted", "US")], ["LP-METL-0001", "LP-METL-0003"]);
    const a = analyzeChain(blend, (c) => map.get(c));
    assert.equal(a.status, "incomplete");
    assert.deepEqual(a.missing, ["mined", "separated"]);
    assert.equal(a.stages.find((s) => s.stage === "refined")?.sources.length, 2);
  });

  it("a revoked input makes the chain incomplete", () => {
    const map = new Map(all);
    map.set(alloy.code, { ...alloy, status: "revoked" });
    const a = analyzeChain(magnet, (c) => map.get(c));
    assert.equal(a.status, "incomplete");
    assert.deepEqual(a.revokedInputs, ["LP-ALLY-0001"]);
  });

  it("stops on a cycle instead of looping", () => {
    const x = node("LP-XXXX-0001", "alloy", [stage("melted", "US")], ["LP-YYYY-0001"]);
    const y = node("LP-YYYY-0001", "alloy", [stage("melted", "US")], ["LP-XXXX-0001"]);
    const m = new Map([x, y].map((n) => [n.code, n]));
    const a = analyzeChain(x, (c) => m.get(c));
    assert.equal(a.status, "incomplete");
  });
});

describe("digest", () => {
  it("is stable, binds input digests, and changes with any field", async () => {
    const body = node("LP-MAGN-0001", "ndfeb_magnet", [stage("produced", "US")], ["LP-ALLY-0001"]);
    const d1 = await passportDigest(body, { "LP-ALLY-0001": H("1") });
    assert.equal(d1, await passportDigest(body, { "LP-ALLY-0001": H("1") }));
    assert.notEqual(d1, await passportDigest(body, { "LP-ALLY-0001": H("2") }));
    assert.notEqual(d1, await passportDigest({ ...body, massKg: 101 }, { "LP-ALLY-0001": H("1") }));
    assert.match(canonicalPassport(body, {}), /^\{"code":"LP-MAGN-0001"/);
  });

  it("puts the digest first in the ledger notes and fits the 500-char limit", async () => {
    const body = node("LP-MAGN-0001", "ndfeb_magnet", [stage("produced", "US")]);
    const a = analyzeChain(body, () => undefined);
    const notes = ledgerNotes(H("e"), a);
    assert.ok(notes.startsWith(`sha256:${H("e")}`));
    assert.ok(notes.length <= 500);
    assert.match(notes, /mined=\?/);
  });
});
