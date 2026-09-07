import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ECOVADIS_WEIGHTS, medalFor, scoreEcovadis } from "./ecovadis.ts";
import { handleEcovadisHttp } from "./ecovadis-http.ts";
import { fallbackBundle } from "./feeds.ts";

describe("EcoVadis analog", () => {
  it("weights four themes to 100 and medals from published cutoffs", () => {
    const w = ECOVADIS_WEIGHTS;
    assert.equal(w.environment + w.labor + w.ethics + w.procurement, 100);
    assert.equal(medalFor(73), "Platinum");
    assert.equal(medalFor(66), "Gold");
    assert.equal(medalFor(56), "Silver");
    assert.equal(medalFor(45), "Bronze");
    assert.equal(medalFor(44), "None");
  });

  it("scores Infineon as a listed EU name and Nanjing lower without inventing a tenant", () => {
    const ifx = scoreEcovadis({
      supplier: "Infineon Technologies AG",
      gleif: { lei: "529900F3AE2O0P2B3K59", name: "Infineon", country: "DE", status: "ACTIVE" },
      sanctionsHit: false,
      listed: true,
      news: [],
      now: "2026-09-06T00:00:00.000Z",
    });
    assert.equal(ifx.issuer, "EcoVadis analog · VerityX host");
    assert.ok(ifx.score >= 56, String(ifx.score));
    assert.ok(["Silver", "Gold", "Platinum"].includes(ifx.medal));
    assert.match(ifx.source, /GLEIF/);
    assert.ok(ifx.evidence.environment.some((e) => /GLEIF|EU/i.test(e)));

    const nj = scoreEcovadis({
      supplier: "Nanjing RareTech Ltd.",
      gleif: null,
      sanctionsHit: false,
      listed: false,
      news: [{ title: "China rare earth export controls widen", source: "Google News", url: "https://example.test/x" }],
      now: "2026-09-06T00:00:00.000Z",
    });
    assert.ok(nj.score < ifx.score);
    assert.ok(nj.themes.environment < ifx.themes.environment);
    assert.equal(nj.issuer, "EcoVadis analog · VerityX host");
  });

  it("crushes ethics on a sanctions hit and serves scorecards over HTTP", async () => {
    const hit = scoreEcovadis({
      supplier: "Hexion GmbH",
      gleif: { lei: "X", name: "Hexion", country: "DE", status: "ACTIVE" },
      sanctionsHit: true,
      listed: true,
      news: [],
    });
    const clear = scoreEcovadis({
      supplier: "Hexion GmbH",
      gleif: { lei: "X", name: "Hexion", country: "DE", status: "ACTIVE" },
      sanctionsHit: false,
      listed: true,
      news: [],
    });
    assert.ok(hit.themes.ethics < 30);
    assert.ok(hit.score < clear.score);

    const live = fallbackBundle();
    const list = await handleEcovadisHttp(new Request("https://verityx.test/ecovadis/api/v2/scorecards"), live);
    assert.ok(list);
    const body = await list.json();
    assert.ok(body.count >= 8);
    assert.equal(body.vendor.subscribed, false);
    assert.ok(body.scorecards[0].themes.environment >= 0);
    assert.ok(body.scorecards[0].po || body.scorecards.some((c: { po?: string }) => c.po));

    const method = await handleEcovadisHttp(new Request("https://verityx.test/ecovadis/api/v2/methodology"), live);
    const m = await method!.json();
    assert.equal(m.weights.labor, 35);

    const missing = await handleEcovadisHttp(
      new Request("https://verityx.test/ecovadis/api/v2/scorecards/EV-NONE"),
      live,
    );
    assert.equal(missing!.status, 404);
  });
});
