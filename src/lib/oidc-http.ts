import {
  DESK_SEAT,
  issueDeskToken,
  oidcDiscovery,
  oidcJwks,
  oidcUserinfo,
  verifyDeskToken,
} from "./oidc.ts";

function originOf(request: Request) {
  const url = new URL(request.url);
  return request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")}://${request.headers.get("x-forwarded-host")}`
    : url.origin;
}

async function readForm(request: Request) {
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    try {
      return (await request.json()) as Record<string, string>;
    } catch {
      return {};
    }
  }
  const text = await request.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

const CODES = new Map<string, { email: string; password: string; exp: number }>();

export async function handleOidcHttp(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/oauth2/") && !path.startsWith("/api/okta")) return null;
  const method = request.method.toUpperCase();
  const origin = originOf(request);

  const rel = path
    .replace(/^\/api\/okta/, "")
    .replace(/^\/oauth2\/default/, "")
    .replace(/\/+$/, "") || "/";

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
    });
  }

  if (
    (rel === "/.well-known/openid-configuration" || rel === "/.well-known/oauth-authorization-server") &&
    method === "GET"
  ) {
    return Response.json(oidcDiscovery(origin));
  }

  if ((rel === "/v1/keys" || rel === "/v1/jwks") && method === "GET") {
    return Response.json(await oidcJwks(), { headers: { "Cache-Control": "public, max-age=60" } });
  }

  if (rel === "/v1/authorize" && method === "GET") {
    const email = url.searchParams.get("username") || DESK_SEAT.email;
    const password = url.searchParams.get("password") || DESK_SEAT.password;
    const tok = await issueDeskToken(email, password);
    if (!tok) return Response.json({ error: "invalid_grant" }, { status: 400 });
    const code = `vx_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    CODES.set(code, { email, password, exp: Date.now() + 120_000 });
    const redirect = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state") || "";
    if (redirect) {
      const loc = new URL(redirect);
      loc.searchParams.set("code", code);
      if (state) loc.searchParams.set("state", state);
      return new Response(null, { status: 302, headers: { Location: loc.toString() } });
    }
    return Response.json({ code, state, token_type: "code", expires_in: 120 });
  }

  if (rel === "/v1/token" && method === "POST") {
    const body = await readForm(request);
    const grant = body.grant_type || "password";
    if (grant === "authorization_code") {
      const rec = CODES.get(body.code || "");
      if (!rec || rec.exp < Date.now()) return Response.json({ error: "invalid_grant" }, { status: 400 });
      CODES.delete(body.code);
      const tok = await issueDeskToken(rec.email, rec.password);
      if (!tok) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({
        access_token: tok.access_token,
        id_token: tok.id_token,
        token_type: "Bearer",
        expires_in: tok.expires_in,
        scope: "openid profile email groups",
      });
    }
    const email = body.username || body.email || DESK_SEAT.email;
    const password = body.password || DESK_SEAT.password;
    const tok = await issueDeskToken(email, password);
    if (!tok) return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({
      access_token: tok.access_token,
      id_token: tok.id_token,
      token_type: "Bearer",
      expires_in: tok.expires_in,
      scope: "openid profile email groups",
    });
  }

  if (rel === "/v1/userinfo" && method === "GET") {
    const authz = request.headers.get("authorization") || "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
    const info = token ? await oidcUserinfo(token) : null;
    if (!info) return Response.json({ error: "invalid_token" }, { status: 401 });
    return Response.json(info);
  }

  if (rel === "/v1/introspect" && method === "POST") {
    const body = await readForm(request);
    const payload = body.token ? await verifyDeskToken(body.token) : null;
    return Response.json({ active: Boolean(payload), ...(payload || {}) });
  }

  return Response.json({ error: "not_found" }, { status: 404 });
}
