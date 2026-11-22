import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXAMPLE_STAGES, exampleAnalysis, recomputeChain, SEALED_DIGESTS } from "./example-chain.ts";
import { isPassportCode } from "./passport.ts";

describe("home page example chain", () => {
  it("uses valid passport codes, mine first", () => {
    for (const s of EXAMPLE_STAGES) assert.ok(isPassportCode(s.code), s.code);
    assert.deepEqual(EXAMPLE_STAGES.map((s) => s.code), Object.keys(SEALED_DIGESTS));
  });

  it("every printed digest is what the real sealing code produces", async () => {
    const checks = await recomputeChain();
    assert.equal(checks.length, 5);
    for (const c of checks) assert.ok(c.ok, `${c.code} digest drifted: ${c.digest}`);
  });

  it("is declared clear when every lot is sealed", async () => {
    const a = await exampleAnalysis(null);
    assert.equal(a.status, "declared-clear");
    assert.deepEqual(a.missing, []);
  });

  it("flags the magnet when the refinery lot is revoked", async () => {
    const a = await exampleAnalysis("LP-8VRM-06KE");
    assert.equal(a.status, "incomplete");
    assert.deepEqual(a.revokedInputs, ["LP-8VRM-06KE"]);
  });
});
