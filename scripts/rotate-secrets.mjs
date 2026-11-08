#!/usr/bin/env node
/**
 * Rotate VerityX's server secrets — run on your own machine.
 *
 *   node scripts/rotate-secrets.mjs                 all three below
 *   node scripts/rotate-secrets.mjs --only auth,ledger
 *
 *   auth    BETTER_AUTH_SECRET   signs sign-in sessions. Everyone is signed out once.
 *   ledger  LOCAL_CORE_SECRET    signs ledger entries. A new LEDGER_EPOCH is set with
 *                                it: the first write archives the old chain intact
 *                                (core_events_fork_archive) and starts a fresh one.
 *                                Already-issued seal receipts stay verifiable: they
 *                                carry their own Merkle proof and Ed25519 signature.
 *   db      DATABASE_URL         the verityx_app database password. You paste one
 *                                SQL line into the Supabase SQL editor; the site is
 *                                down for the minute between that and the redeploy.
 *
 * Then rotate the seal key with scripts/rotate-seal-key.mjs.
 *
 * New values are generated here and sent only to Vercel (and, for the database
 * password, to your clipboard for the SQL editor). Nothing is written to disk
 * or printed. Requires Node 18+, git, and `npx vercel login` once.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const ORG = "team_hmdMyBfWSwV5QTQ9S7fS6okN";
const PROJECT = "prj_KfrT5B8tpUV8yuTLGXBaIpBP1tKr";
const SITE = "https://verityx-portal.vercel.app";
const DB = { ref: "qbjbkyzixrwkzgtkiyll", role: "verityx_app", host: "aws-0-us-east-1.pooler.supabase.com", port: 5432 };
const SQL_EDITOR = `https://supabase.com/dashboard/project/${DB.ref}/sql/new`;

const oi = process.argv.indexOf("--only");
const only = new Set((oi >= 0 ? process.argv[oi + 1] ?? "" : "auth,ledger,db").split(",").map((s) => s.trim()).filter(Boolean));
for (const k of only) if (!["auth", "ledger", "db"].includes(k)) die(`Unknown part "${k}". Use auth, ledger, db.`);

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const vercelEnv = { ...process.env, VERCEL_ORG_ID: ORG, VERCEL_PROJECT_ID: PROJECT };
function vercel(a, input) {
  return spawnSync("npx", ["--yes", "vercel@latest", ...a], { env: vercelEnv, input, encoding: "utf8", stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"] });
}
function setEnv(name, value, sensitive = true) {
  vercel(["env", "rm", name, "production", "--yes"]);
  let r = vercel(["env", "add", name, "production", ...(sensitive ? ["--sensitive"] : [])], value);
  if (r.status !== 0 && sensitive) r = vercel(["env", "add", name, "production"], value);
  if (r.status !== 0) die(`Vercel did not accept ${name}:\n${r.stderr}`);
  console.log(`✓ ${name} set on Vercel production`);
}
const ask = (q) =>
  new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => {
      rl.close();
      res(a.trim());
    });
  });
function toClipboard(text) {
  for (const [cmd, args] of [["pbcopy", []], ["wl-copy", []], ["xclip", ["-selection", "clipboard"]], ["clip", []]]) {
    const r = spawnSync(cmd, args, { input: text });
    if (r.status === 0) return true;
  }
  return false;
}

// Preconditions
if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") die("Switch to the main branch first.");
if (git("status", "--porcelain")) die("Commit or stash your local changes first.");
git("pull", "--ff-only", "--quiet");
if (vercel(["whoami"]).status !== 0) die("Not logged in to Vercel. Run: npx vercel login");
console.log(`Rotating: ${[...only].join(", ")}\n`);

if (only.has("db")) {
  const pw = randomBytes(24).toString("hex");
  const sql = `alter role ${DB.role} password '${pw}';`;
  const copied = toClipboard(sql);
  console.log(`1. Open the Supabase SQL editor: ${SQL_EDITOR}`);
  if (copied) console.log("2. Paste (the SQL line is on your clipboard) and press Run.");
  else {
    console.log("2. Your clipboard could not be reached. Paste this line and press Run, then clear your terminal:");
    console.log(`   ${sql}`);
  }
  const ok = await ask('3. Type "done" when Supabase says Success: ');
  if (ok.toLowerCase() !== "done") die("Stopped before changing Vercel. The database password may already be new; re-run with --only db.");
  setEnv("DATABASE_URL", `postgresql://${DB.role}.${DB.ref}:${pw}@${DB.host}:${DB.port}/postgres?uselibpqcompat=true&sslmode=require`);
  if (copied) toClipboard(" ");
}
if (only.has("auth")) setEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
if (only.has("ledger")) {
  setEnv("LOCAL_CORE_SECRET", randomBytes(32).toString("hex"));
  setEnv("LEDGER_EPOCH", new Date().toISOString().replace(/[:.]/g, "-"), false);
}

git("commit", "--allow-empty", "--quiet", "-m", `Rotate server secrets: ${[...only].join(", ")}`);
git("push", "--quiet", "origin", "main");
const head = git("rev-parse", "HEAD").slice(0, 12);
process.stdout.write("\nRedeploying");
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15_000));
  process.stdout.write(".");
  try {
    const j = await (await fetch(`${SITE}/api/readiness`, { cache: "no-store" })).json();
    if (j.commit === head && j.checks?.database?.ok) {
      console.log("\n✓ Live and connected to the database with the new secrets.");
      console.log("Next: node scripts/rotate-seal-key.mjs\n");
      process.exit(0);
    }
  } catch {
    /* keep waiting */
  }
}
console.log("\n! Not confirmed yet: check https://verityx-portal.vercel.app/api/readiness after the deploy finishes.\n");
process.exit(2);
