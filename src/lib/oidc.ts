import { SignJWT, jwtVerify, generateKeyPair, exportJWK, importJWK, type JWTPayload, type JWK } from "jose";

export const OIDC_ISSUER = "https://verityx.okta.com/oauth2/default";
export const OIDC_AUD = "verityx-sgre-desk";
export const OIDC_CLIENT = "0oa_verityx_sgre";

const SEAT = {
  email: "elena.hartmann@siemensgamesa.com",
  password: "demo2026",
  name: "Elena Hartmann",
  title: "Head of Magnetics Procurement",
  tenant: "SIEMENS-GAMESA",
  sub: "00u_elena_hartmann",
  groups: ["sgre-magnetics", "buyer", "okta-workforce"],
};

export const DESK_SEAT = SEAT;


type KeyPair = { privateKey: CryptoKey; publicJwk: JWK };

let keys: KeyPair | null = null;

async function getKeys(): Promise<KeyPair> {
  if (keys) return keys;
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "verityx-okta-1";
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";
  keys = { privateKey, publicJwk };
  return keys;
}

export type DeskToken = {
  access_token: string;
  id_token: string;
  token_type: "Bearer";
  expires_in: number;
  claims: JWTPayload;
};

async function sign(claims: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { privateKey } = await getKeys();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 8 * 3600;
  return new SignJWT({ ...claims, ...extra })
    .setProtectedHeader({ alg: "RS256", kid: "verityx-okta-1", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(OIDC_ISSUER)
    .setAudience(OIDC_AUD)
    .setSubject(String(claims.sub))
    .sign(privateKey);
}

export async function issueDeskToken(email: string, password: string): Promise<DeskToken | null> {
  if (email.trim().toLowerCase() !== SEAT.email || password !== SEAT.password) return null;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 8 * 3600;
  const claims = {
    sub: SEAT.sub,
    iss: OIDC_ISSUER,
    aud: OIDC_AUD,
    cid: OIDC_CLIENT,
    uid: SEAT.sub,
    email: SEAT.email,
    name: SEAT.name,
    preferred_username: SEAT.email,
    ver: 1,
    tenant: SEAT.tenant,
    title: SEAT.title,
    groups: SEAT.groups,
    idp: "okta",
  };
  const access_token = await sign(claims);
  const id_token = await sign(claims, { amr: ["pwd"], at_hash: "okta" });
  return { access_token, id_token, token_type: "Bearer", expires_in: 8 * 3600, claims: { ...claims, iat: now, exp } };
}

export async function verifyDeskToken(token: string) {
  try {
    const { publicJwk } = await getKeys();
    const key = await importJWK(publicJwk, "RS256");
    const { payload } = await jwtVerify(token, key, { issuer: OIDC_ISSUER, audience: OIDC_AUD });
    return payload;
  } catch {
    return null;
  }
}

export async function oidcJwks() {
  const { publicJwk } = await getKeys();
  return { keys: [publicJwk] };
}

export function oidcDiscovery(origin?: string) {
  const host = origin ? `${origin.replace(/\/+$/, "")}/oauth2/default` : OIDC_ISSUER;
  return {
    issuer: OIDC_ISSUER,
    authorization_endpoint: `${host}/v1/authorize`,
    token_endpoint: `${host}/v1/token`,
    userinfo_endpoint: `${host}/v1/userinfo`,
    jwks_uri: `${host}/v1/keys`,
    grant_types_supported: ["password", "authorization_code", "refresh_token"],
    id_token_signing_alg_values_supported: ["RS256"],
    response_types_supported: ["code", "token", "id_token", "token id_token"],
    subject_types_supported: ["public"],
    scopes_supported: ["openid", "profile", "email", "groups"],
    claims_supported: ["sub", "iss", "aud", "email", "name", "groups", "tenant"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    note: "Okta Workforce-shaped IdP hosted on this plane. Issuer claim stays verityx.okta.com. Okta the vendor is not provisioned.",
  };
}

export async function oidcUserinfo(token: string) {
  const payload = await verifyDeskToken(token);
  if (!payload) return null;
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    preferred_username: payload.preferred_username || payload.email,
    groups: payload.groups,
    tenant: payload.tenant,
    title: payload.title,
  };
}

