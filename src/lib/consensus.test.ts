/**
 * BUG-03 parity. Expected values were produced by verityx-sovereign
 * backend/app/services/consensus.py consensus_confidence() on the same inputs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { consensusAgent } from "./consensus.ts";

const PYTHON_FIXTURES: [number[], number, number, string][] = [
  [[100, 101, 99, 100.5], 0.991471534943, 0.008528465057, "VERIFIED"],
  [[100, 140, 60, 180, 20], 0.367544467966, 0.632455532034, "DISPUTED"],
  [[5], 0.0, 0.0, "INSUFFICIENT_DATA"],
  [[0, 0, 0.001], 0.0, 0.0, "INSUFFICIENT_DATA"],
  [[0.004, 0.005, 0.006], 0.0, 0.0, "INSUFFICIENT_DATA"],
  [[100, 100, 100, 100, 5000], 0.0, 2.02902464625, "DISPUTED"],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32], 0.44041862689, 0.55958137311, "DISPUTED"],
  [[14359, 14320, 14410, 14388, 14290, 14402, 20000], 0.996655483006, 0.003344516994, "VERIFIED"],
  [[58.0, 57.6, 58.4, 58.1], 0.994305837254, 0.005694162746, "VERIFIED"],
  [[-50, -51, -49], 0.98, 0.02, "VERIFIED"],
];

test("consensus matches sovereign v5 python on every fixture (12 dp)", () => {
  for (const [obs, confidence, cv, verdict] of PYTHON_FIXTURES) {
    const r = consensusAgent(obs);
    assert.equal(r.verdict, verdict, JSON.stringify(obs));
    assert.ok(Math.abs(r.confidence - confidence) < 1e-12, `confidence ${JSON.stringify(obs)}`);
    assert.ok(Math.abs(r.cv - cv) < 1e-12, `cv ${JSON.stringify(obs)}`);
  }
});

test("N >= 30 uses population stdev (the branch v1.0 lacked)", () => {
  const obs = Array.from({ length: 32 }, (_, i) => i + 1);
  const m = obs.reduce((a, b) => a + b, 0) / obs.length;
  const pop = Math.sqrt(obs.reduce((a, b) => a + (b - m) ** 2, 0) / obs.length);
  assert.ok(Math.abs(consensusAgent(obs).cv - pop / m) < 1e-12);
});
