import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretWebhook, shouldMarkPaid } from "./billing.ts";

describe("stripe webhook gating", () => {
  it("rejects when no signing secret is configured", () => {
    const r = interpretWebhook({
      signatureHeader: "t=1,v1=abc",
      secretConfigured: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 503);
  });

  it("rejects a missing signature even when a secret exists", () => {
    const r = interpretWebhook({
      signatureHeader: null,
      secretConfigured: true,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 400);
  });

  it("only marks paid on completed checkout / succeeded intent", () => {
    assert.equal(shouldMarkPaid("checkout.session.completed", "paid"), true);
    assert.equal(shouldMarkPaid("customer.created"), false);
    assert.equal(shouldMarkPaid("checkout.session.expired"), false);
  });
});
