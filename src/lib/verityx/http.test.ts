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

  it("allows the live Vercel product hosts", () => {
    assert.equal(allowedOrigin("https://verityx-portal.vercel.app", ""), true);
    assert.equal(allowedOrigin("https://verityx-sovereign-desk.vercel.app", undefined), true);
    assert.equal(allowedOrigin("https://vxsg-desk-20260906.vercel.app", ""), true);
    assert.equal(allowedOrigin("https://verityx.vercel.app", ""), true);
    assert.equal(allowedOrigin("https://vx-magnetics-desk.vercel.app", ""), true);
    assert.equal(allowedOrigin("https://verityx-sovereign-live.vercel.app", ""), true);
    assert.equal(allowedOrigin("https://unrelated.vercel.app", ""), false);
  });

  it("allows Cloud Run hosts and BETTER_AUTH_URL", () => {
    assert.equal(allowedOrigin("https://verityx-abc123-uc.a.run.app", ""), true);
    assert.equal(allowedOrigin("https://verityx-abc123.run.app", ""), true);
    assert.equal(allowedOrigin("https://other-service-uc.a.run.app", ""), false);
    const prev = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = "https://verityx.example.com";
    try {
      assert.equal(allowedOrigin("https://verityx.example.com", ""), true);
      assert.equal(allowedOrigin("https://evil.example.com", ""), false);
    } finally {
      if (prev === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = prev;
    }
  });

  it("never treats a missing origin as allowed", () => {
    assert.equal(allowedOrigin("", ""), false);
  });
});

describe("matchPath", () => {
  it("extracts params and rejects length mismatches", () => {
    assert.deepEqual(matchPath("/api/prospects/abc/contact", "/api/prospects/:id/contact"), { id: "abc" });
    assert.equal(matchPath("/api/prospects/abc/contact", "/api/prospects/:id"), null);
    assert.deepEqual(matchPath("/api/pilots/abc", "/api/pilots/:id"), { id: "abc" });
    assert.deepEqual(matchPath("/api/pilots/abc/desk-packet", "/api/pilots/:id/desk-packet"), { id: "abc" });
    assert.equal(matchPath("/api/pilots", "/api/pilots/:id"), null);
    assert.equal(matchPath("/api/other/abc", "/api/pilots/:id"), null);
  });
});
