const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function originHost(origin: string): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function isTrustedHost(host: string): boolean {
  if (LOCAL_HOSTS.has(host)) return true;
  if (host.endsWith(".grok-sandbox.com") || host.endsWith(".grok.me")) return true;
  if (!host.endsWith(".vercel.app")) return false;
  return (
    host === "verityx-portal.vercel.app" ||
    host === "verityx-sovereign-desk.vercel.app" ||
    host === "verityx-sgre-live.vercel.app" ||
    host === "vxsg-desk-20260906.vercel.app" ||
    host === "verityx-live-core.vercel.app" ||
    host.startsWith("verityx-") ||
    host.startsWith("vxsg-")
  );
}

export function allowedOrigin(origin: string, envAllow?: string | null): boolean {
  if (!origin) return false;
  const configured = (envAllow ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured.includes(origin);
  const host = originHost(origin);
  if (!host) return false;
  return isTrustedHost(host);
}

export function corsHeaders(
  request: Request,
  envAllow = process.env.FRONTEND_ORIGINS,
): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Allow-Credentials": "true",
    "X-Request-Id": request.headers.get("x-request-id") || crypto.randomUUID(),
  };
  if (origin && allowedOrigin(origin, envAllow)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function matchPath(path: string, pattern: string): Record<string, string> | null {
  const a = path.split("/").filter(Boolean);
  const b = pattern.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i += 1) {
    if (b[i].startsWith(":")) params[b[i].slice(1)] = decodeURIComponent(a[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
