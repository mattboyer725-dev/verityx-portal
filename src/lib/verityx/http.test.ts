import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedOrigin, matchPath } from "./http.ts";

describe("allowedOrigin", () => {
  it("uses the explicit FRONTEND_ORIGINS allowlist when set", () => {
    assert.equal(allowedOrigin("https://app.verityx.example", "https://app.verityx.example"), true);
    assert.equal(allowedOrigin("https://evil.example", "https://app.verityx.example"), false);
    assert.equal(allowedOrigin("http://localhost:8080", "https://app.verityx.example"), false);
  });

  it("allows preview and local origins when no allowlist is configured", () => {
    assert.equal(allowedOrigin("http://localhost:8080", ""), true);
    assert.equal(allowedOrigin("https://abc.grok-sandbox.com", undefined), true);
    assert.equal(allowedOrigin("https://evil.example", ""), false);
  });

  it("never treats a missing origin as allowed", () => {
    assert.equal(allowedOrigin("", ""), false);
  });
});

describe("matchPath", () => {
  it("extracts params and rejects length mismatches", () => {
    assert.deepEqual(matchPath("/api/pilots/abc", "/api/pilots/:id"), { id: "abc" });
    assert.equal(matchPath("/api/pilots", "/api/pilots/:id"), null);
    assert.equal(matchPath("/api/other/abc", "/api/pilots/:id"), null);
  });
});
