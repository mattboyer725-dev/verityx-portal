import assert from "node:assert/strict";
import { test } from "node:test";
import { nameCore, nameMatchScore, pickGleif } from "./name-match.ts";

const rec = (lei: string, name: string, status = "ACTIVE") => ({
  id: lei,
  attributes: { lei, entity: { legalName: { name }, legalAddress: { country: "CN" }, status } },
});

test("legal suffixes and punctuation do not count", () => {
  assert.equal(nameCore("China Northern Rare Earth (Group) High-Tech Co., Ltd"), "CHINA NORTHERN RARE EARTH HIGH TECH");
  assert.equal(nameMatchScore("Acme Magnets GmbH", "ACME MAGNETS AG"), 1);
});

test("the registry's fuzzy first hit is rejected when it is a different company", () => {
  const asked = "China Northern Rare Earth (Group) High-Tech Co., Ltd";
  assert.equal(pickGleif(asked, [rec("894500TSKNE8XM67HY36", "TRANSLINK (LTD) LTD", "INACTIVE")]), null);
});

test("the genuinely matching record is chosen even when it is not first", () => {
  const asked = "China Northern Rare Earth (Group) High-Tech Co., Ltd";
  const hit = pickGleif(asked, [
    rec("894500TSKNE8XM67HY36", "TRANSLINK (LTD) LTD", "INACTIVE"),
    rec("300300C1LEIEXAMPLE00", "CHINA NORTHERN RARE EARTH (GROUP) HIGH-TECH CO., LTD"),
  ]);
  assert.equal(hit?.lei, "300300C1LEIEXAMPLE00");
});

test("a partial overlap below the threshold is not attributed", () => {
  assert.equal(pickGleif("Northern Star Magnetics Ltd", [rec("X", "Northern Trust Corporation")]), null);
});
