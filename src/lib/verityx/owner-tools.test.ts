import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ownerToolsFor } from "./owner-tools.ts";

describe("ownerToolsFor", () => {
  it("shows owner tools only to the pinned owner", () => {
    assert.equal(ownerToolsFor("u1", { OWNER_USER_ID: "u1", VERCEL_ENV: "production" }), true);
    assert.equal(ownerToolsFor("u2", { OWNER_USER_ID: "u1", VERCEL_ENV: "production" }), false);
    assert.equal(ownerToolsFor("u2", { OWNER_USER_ID: " u1 " }), false);
  });
  it("fails closed on production when no owner is pinned", () => {
    assert.equal(ownerToolsFor("anyone", { VERCEL_ENV: "production" }), false);
    assert.equal(ownerToolsFor("anyone", { OWNER_USER_ID: "  ", VERCEL_ENV: "production" }), false);
  });
  it("stays open in development and previews before pinning", () => {
    assert.equal(ownerToolsFor("anyone", {}), true);
    assert.equal(ownerToolsFor("anyone", { VERCEL_ENV: "preview" }), true);
  });
});
