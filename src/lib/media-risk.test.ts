import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flattenAlerts, mediaLevel, scoreMediaRisk } from "./media-risk.ts";

describe("Media-risk heat", () => {
  it("bands heat and classifies RSS incidents on the PO", () => {
    assert.equal(mediaLevel(70), "CRITICAL");
    assert.equal(mediaLevel(50), "HIGH");
    assert.equal(mediaLevel(28), "MED");
    assert.equal(mediaLevel(10), "LOW");

    const nj = scoreMediaRisk({
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
    assert.equal(nj.issuer, "VerityX media-risk heat");
    assert.ok(nj.headlines.length >= 1);
  });

  it("marks sanctions as high heat and flattens alerts", () => {
    const hit = scoreMediaRisk({
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

  });
});

it("no headlines fetched = not checked, never a clean bill", () => {
  const r = scoreMediaRisk({ supplier: "Nanjing RareTech Ltd.", news: [], sanctionsHit: false, now: "2026-11-08T00:00:00Z" });
  assert.equal(r.checked, false);
  assert.match(r.source, /NOT CHECKED/);
  const ok = scoreMediaRisk({ supplier: "Nanjing RareTech Ltd.", news: [], sanctionsHit: false, newsAvailable: true, now: "2026-11-08T00:00:00Z" });
  assert.equal(ok.checked, true);
});
