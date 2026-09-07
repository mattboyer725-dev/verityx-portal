/**
 * Postgres URL for Neon (Vercel) and Cloud SQL (Google Cloud Run).
 *
 * Cloud Run talks to Cloud SQL over a Unix socket when
 * `CLOUD_SQL_CONNECTION_NAME` is set (`project:region:instance`).
 * Never log the resolved URL — it carries the password.
 *
 * Better Auth (`src/lib/auth/server.ts`, do not rewrite) builds its own `pg`
 * Pool from `process.env.DATABASE_URL`. `applyCloudSqlUrlToEnv()` rewrites
 * that env at process start so the auth pool uses the same socket.
 */
export function durableDatabaseRequired(
  env: NodeJS.Dict<string> = typeof process !== "undefined" ? process.env : {},
): boolean {
  return env.GCP_RUNTIME === "1" || env.REQUIRE_DATABASE === "1";
}

function alreadyCloudSqlSocket(raw: string): boolean {
  return raw.includes("/cloudsql/") || raw.includes("%2Fcloudsql%2F");
}

export function resolvePostgresUrl(
  env: NodeJS.Dict<string> = typeof process !== "undefined" ? process.env : {},
): string | undefined {
  const raw = env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  const conn = env.CLOUD_SQL_CONNECTION_NAME?.trim();
  if (!conn) return raw;
  if (alreadyCloudSqlSocket(raw)) return raw;

  const withoutProto = raw.replace(/^postgres(?:ql)?:\/\//i, "");
  const at = withoutProto.lastIndexOf("@");
  if (at < 0) return raw;
  const creds = withoutProto.slice(0, at);
  const rest = withoutProto.slice(at + 1);
  const slash = rest.indexOf("/");
  const dbAndQuery = slash >= 0 ? rest.slice(slash + 1) : "verityx";
  const [dbName, query] = dbAndQuery.split("?");
  const params = new URLSearchParams(query || "");
  params.delete("sslmode");
  params.delete("ssl");
  params.set("host", `/cloudsql/${conn}`);
  const db = dbName || "verityx";
  return `postgresql://${creds}@/${db}?${params.toString()}`;
}

/** Mutate `DATABASE_URL` in-place so every reader (including Better Auth) hits Cloud SQL. */
export function applyCloudSqlUrlToEnv(
  env: NodeJS.Dict<string> = typeof process !== "undefined" ? process.env : {},
): string | undefined {
  const resolved = resolvePostgresUrl(env);
  if (resolved && env.CLOUD_SQL_CONNECTION_NAME?.trim()) {
    env.DATABASE_URL = resolved;
  }
  return resolved;
}
