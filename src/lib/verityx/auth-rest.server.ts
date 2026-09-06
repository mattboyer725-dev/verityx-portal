import { auth } from "@/lib/auth/server";
import { MIN_PASSWORD_LENGTH } from "./constants";
import { normalizeEmail } from "./format";
import { corsHeaders } from "./http";

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function forwardHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return headers;
}

function withCors(request: Request, response: Response): Response {
  const next = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request))) {
    if (!next.has(k)) next.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers: next });
}

async function proxyAuth(request: Request, pathname: string, body: unknown): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = pathname;
  const forwarded = new Request(url.toString(), {
    method: "POST",
    headers: forwardHeaders(request),
    body: JSON.stringify(body),
  });
  const res = await auth.handler(forwarded);
  return withCors(request, res);
}

function jsonError(request: Request, message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders(request) });
}

/**
 * Spec aliases over Better Auth:
 * POST /api/auth/register, /api/auth/login, /api/auth/logout
 * Returns null when the path is a native Better Auth route.
 */
export async function dispatchAuthAlias(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS" && (path === "/api/auth/register" || path === "/api/auth/login" || path === "/api/auth/logout")) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (path === "/api/auth/register" && method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const name = String(body.name ?? email.split("@")[0] ?? "Founder").trim();
    if (!email.includes("@")) return jsonError(request, "Enter a valid email.");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonError(request, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return proxyAuth(request, "/api/auth/sign-up/email", { email, password, name });
  }

  if (path === "/api/auth/login" && method === "POST") {
    const body = await readJson(request);
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    if (!email.includes("@") || !password) return jsonError(request, "Email and password are required.");
    return proxyAuth(request, "/api/auth/sign-in/email", { email, password });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    return proxyAuth(request, "/api/auth/sign-out", {});
  }

  return null;
}
