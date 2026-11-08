/**
 * Launch readiness: what is configured, as on/off flags. Never a value, a
 * prefix beyond test/live, or any detail an attacker could use. Public, so the
 * owner's checklist and the uptime job can read it without signing in.
 */
type Check = { ok: boolean; note: string };

const set = (k: string) => Boolean(process.env[k]?.trim());

function stripeMode(): "live" | "test" | "none" {
  const k = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!k) return "none";
  return /^(sk|rk)_live_/.test(k) ? "live" : "test";
}

export async function readiness() {
  const checks: Record<string, Check> = {};

  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`select 1`;
    checks.database = { ok: true, note: "Postgres reachable" };
  } catch {
    checks.database = { ok: false, note: "database unreachable" };
  }

  checks.owner = set("OWNER_USER_ID")
    ? { ok: true, note: "owner account pinned" }
    : { ok: false, note: "OWNER_USER_ID not set: platform command closed, leads wait in pilot_requests" };

  const mode = stripeMode();
  checks.stripe = mode === "live"
    ? { ok: true, note: "live key" }
    : { ok: false, note: mode === "test" ? "test key: payments are not real" : "no key: checkout disabled" };
  checks.stripeWebhook = set("STRIPE_WEBHOOK_SECRET")
    ? { ok: true, note: "webhook secret set" }
    : { ok: false, note: "no webhook secret: payments will not mark pilots paid" };

  checks.email = set("RESEND_API_KEY")
    ? { ok: true, note: "lead emails on" }
    : { ok: false, note: "no RESEND_API_KEY: leads only appear in the workspace" };

  try {
    const { publishedSealKey } = await import("@/lib/receipt.server");
    const k = await publishedSealKey();
    checks.sealSigning = k.available ? { ok: true, note: `signing with ${k.kid}` } : { ok: false, note: k.reason };
  } catch {
    checks.sealSigning = { ok: false, note: "seal key check failed" };
  }

  const authHost = (() => {
    try {
      return new URL(process.env.BETTER_AUTH_URL ?? "").host;
    } catch {
      return "";
    }
  })();
  checks.customDomain = authHost && !authHost.endsWith(".vercel.app")
    ? { ok: true, note: authHost }
    : { ok: false, note: "still on vercel.app" };

  checks.supportEmail = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim()
    ? { ok: true, note: "public contact address set" }
    : { ok: false, note: "no VITE_SUPPORT_EMAIL: pages point to the request form" };

  const blocking = ["database", "owner", "stripe", "stripeWebhook", "sealSigning"];
  const ready = blocking.every((k) => checks[k]?.ok);
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 12) || null;
  return { ready, stripeMode: mode, commit, blocking, checks, at: new Date().toISOString() };
}
