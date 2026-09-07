import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleOidcHttp } from "./oidc-http.ts";
import { DESK_SEAT, verifyDeskToken } from "./oidc.ts";

describe("Okta-shaped OIDC IdP", () => {
  it("serves discovery and JWKS on this host", async () => {
    const disc = await handleOidcHttp(
      new Request("https://verityx.test/oauth2/default/.well-known/openid-configuration"),
    );
    assert.ok(disc);
    const body = await disc.json();
    assert.equal(body.issuer, "https://verityx.okta.com/oauth2/default");
    assert.match(body.token_endpoint, /verityx.test\/oauth2\/default\/v1\/token/);
    const jwks = await handleOidcHttp(new Request("https://verityx.test/oauth2/default/v1/keys"));
    const keys = await jwks!.json();
    assert.equal(keys.keys[0].alg, "RS256");
  });

  it("issues a password-grant RS256 seat token and answers userinfo", async () => {
    const tokenRes = await handleOidcHttp(
      new Request("https://verityx.test/oauth2/default/v1/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `grant_type=password&username=${encodeURIComponent(DESK_SEAT.email)}&password=${DESK_SEAT.password}`,
      }),
    );
    assert.equal(tokenRes!.status, 200);
    const tok = await tokenRes!.json();
    assert.equal(tok.token_type, "Bearer");
    const payload = await verifyDeskToken(tok.access_token);
    assert.equal(payload?.email, DESK_SEAT.email);
    const info = await handleOidcHttp(
      new Request("https://verityx.test/oauth2/default/v1/userinfo", {
        headers: { authorization: `Bearer ${tok.access_token}` },
      }),
    );
    assert.equal((await info!.json()).email, DESK_SEAT.email);
  });
});
