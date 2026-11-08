import assert from "node:assert/strict";
import { test } from "node:test";
import { finishHead, SITE_ORIGIN } from "./head-finish.ts";

const HEAD =
  '<head><title>VerityX</title><meta name="grok-project-id" content="abc"><meta property="grok:app_id" content="abc">' +
  '<script src="https://grok.com/grok-app-builder/extensions.js" data-project-id="abc" defer></script></head>';

test("production on Vercel drops the builder script and Grok id metas", () => {
  const out = finishHead(HEAD, { VERCEL_ENV: "production" });
  assert.ok(!out.includes("extensions.js"));
  assert.ok(!out.includes("grok-project-id"));
  assert.ok(!out.includes("grok:app_id"));
  assert.ok(out.includes("<title>VerityX</title>"));
});

test("preview and grok.me publishes keep the builder script", () => {
  assert.ok(finishHead(HEAD, { VERCEL_ENV: "preview" }).includes("extensions.js"));
  assert.ok(finishHead(HEAD, {}).includes("extensions.js"));
  assert.ok(finishHead(HEAD, { VERCEL_ENV: "production", VITE_PUBLIC_HOSTNAME: "x.grok.me" }).includes("extensions.js"));
});

test("adds the seal share image when the platform emitted none, once, on the fixed origin", () => {
  const out = finishHead("<head></head>", {});
  assert.ok(out.includes(`<meta property="og:image" content="${SITE_ORIGIN}/og.jpg">`));
  assert.ok(out.includes(`<meta name="twitter:image" content="${SITE_ORIGIN}/og.jpg">`));
  assert.equal(finishHead(out, {}), out, "idempotent");
});

test("leaves an existing og:image alone", () => {
  const head = '<head><meta property="og:image" content="https://custom.example/card.jpg"></head>';
  assert.equal(finishHead(head, {}), head);
});
