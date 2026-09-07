import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { __resetPbftForTests, PBFT_N, PBFT_QUORUM, runPbft } from "./pbft.ts";

describe("PBFT network", () => {
  beforeEach(() => {
    __resetPbftForTests();
  });

  it("commits with quorum 19 of 27 over delayed envelopes", async () => {
    const round = await runPbft("po:4500187742:seal");
    assert.equal(round.n, PBFT_N);
    assert.equal(round.quorum, PBFT_QUORUM);
    assert.equal(round.prepares.length, 27);
    assert.equal(round.commits.length, 27);
    assert.ok(round.prepareOk >= PBFT_QUORUM);
    assert.ok(round.commitOk >= PBFT_QUORUM);
    assert.equal(round.committed, true);
    assert.ok(round.network.messages > 27);
    assert.deepEqual(round.network.hops, ["pre-prepare", "prepare", "commit"]);
    assert.equal(round.byzantine.length, 2);
    assert.ok(round.prepares.filter((v) => !v.honest).length >= 1);
  });
});
