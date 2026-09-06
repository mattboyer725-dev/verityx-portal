import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDuration, safeAppPath, slaState } from "./format.ts";

describe("slaState", () => {
  it("waits until inputs land", () => {
    const s = slaState(null, 72);
    assert.equal(s.overdue, false);
    assert.equal(s.remainingMs, null);
  });

  it("reports remaining time inside the window", () => {
    const start = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const s = slaState(start, 72);
    assert.equal(s.overdue, false);
    assert.ok((s.remainingMs ?? 0) > 0);
  });

  it("flags overdue past the target", () => {
    const start = new Date(Date.now() - 80 * 3_600_000).toISOString();
    const s = slaState(start, 72);
    assert.equal(s.overdue, true);
  });
});

describe("formatDuration", () => {
  it("formats hours and minutes", () => {
    assert.equal(formatDuration(3_600_000 + 120_000), "1h 2m");
  });
});

describe("safeAppPath", () => {
  it("returns to the platform hub by default", () => {
    assert.equal(safeAppPath(undefined), "/");
    assert.equal(safeAppPath(""), "/");
    assert.equal(safeAppPath("https://evil.example"), "/");
    assert.equal(safeAppPath("//evil.example"), "/");
    assert.equal(safeAppPath("/api/auth/callback"), "/");
  });

  it("allows in-app planes", () => {
    assert.equal(safeAppPath("/work"), "/work");
    assert.equal(safeAppPath("/work/pilots/abc"), "/work");
    assert.equal(safeAppPath("/admin"), "/admin");
    assert.equal(safeAppPath("/desk"), "/desk");
    assert.equal(safeAppPath("/core"), "/core");
  });
});
