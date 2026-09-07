import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flattenAlerts, prewaveLevel, scorePrewave } from "./prewave.ts";
import { handlePrewaveHttp } from "./prewave-http.ts";
import { fallbackBundle } from "./feeds.ts";

describe("Prewave analog", () => {
  it("bands heat and classifies RSS incidents on the PO", () => {
    assert.equal(prewaveLevel(70), "CRITICAL");
    assert.equal(prewaveLevel(50), "HIGH");
    assert.equal(prewaveLevel(28), "MED");
    assert.equal(prewaveLevel(10), "LOW");

    const nj = scorePrewave({
      supplier: "Nanjing RareTech Ltd.",
      po: "4500187742",
      sanctionsHit: false,
      news: [
        { title: "China rare earth export ban rattles magnet buyers", source: "Google News", url: "https://example.test/a" },
        { title: "Nanjing plant strike delays NdFeB lots", source: "Google News", url: "https://example.test/b" },
      ],
    });
    assert.equal(nj.po, "4500187742");
    assert.equal(nj.heat, nj.risk);
    assert.ok(nj.heat >= 28);
    assert.ok(nj.incidents.some((i) => i.category === "DISRUPTION"));
    assert.equal(nj.issuer, "Prewave analog · VerityX host");
    assert.ok(nj.headlines.length >= 1);
  });

  it("marks sanctions as CRITICAL heat and serves risks plus alerts over HTTP", async () => {
    const hit = scorePrewave({
      supplier: "Baotou Rare Earth Co.",
      po: "4500188011",
      sanctionsHit: true,
      news: [{ title: "UN investigation into rare earth trade", source: "Google News", url: "https://example.test/c" }],
    });
    assert.ok(hit.heat >= 50);
    assert.ok(["HIGH", "CRITICAL"].includes(hit.level));
    const alerts = flattenAlerts([hit]);
    assert.ok(alerts.length >= 1);
    assert.equal(alerts[0].po, "4500188011");

    const live = fallbackBundle();
    const list = await handlePrewaveHttp(new Request("https://verityx.test/prewave/api/v1/risks"), live);
    const body = await list!.json();
    assert.ok(body.count >= 8);
    assert.equal(body.vendor.subscribed, false);
    assert.ok(body.risks.some((r: { po?: string }) => r.po === "4500187742"));

    const one = await handlePrewaveHttp(
      new Request("https://verityx.test/prewave/api/v1/risks/4500187742"),
      live,
    );
    assert.equal(one!.status, 200);
    const rec = await one!.json();
    assert.equal(rec.po, "4500187742");

    const tax = await handlePrewaveHttp(new Request("https://verityx.test/prewave/api/v1/taxonomy"), live);
    const t = await tax!.json();
    assert.ok(t.categories.includes("DISRUPTION"));

    const missing = await handlePrewaveHttp(
      new Request("https://verityx.test/prewave/api/v1/risks/PW-NONE"),
      live,
    );
    assert.equal(missing!.status, 404);
  });
});
