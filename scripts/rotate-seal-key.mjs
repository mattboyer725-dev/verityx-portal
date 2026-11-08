#!/usr/bin/env node
/**
 * Rotate VerityX's Ed25519 seal key — run on your own machine.
 *
 *   node scripts/rotate-seal-key.mjs                       routine rotation (old key → retired)
 *   node scripts/rotate-seal-key.mjs --revoke "reason"     compromise (old key → revoked)
 *   node scripts/rotate-seal-key.mjs --dry-run             show what would change, touch nothing
 *
 * What it does, in an order that is safe if it stops part-way:
 *   1. Checks you are on an up-to-date, clean main branch and logged in to Vercel.
 *   2. Generates a new key pair in this process. The private seed is never
 *      printed, written to disk, or sent anywhere but Vercel.
 *   3. Sets VERITYX_SEAL_KEY on the Vercel production environment.
 *      (Until step 4 lands, the server refuses to sign: its key is not yet the
 *      keyring's active key. Fail closed, never a wrong signature.)
 *   4. Updates src/data/seal-keyring.json — new key active, old key retired
 *      or revoked — commits and pushes. The push deploys both together.
 *   5. Waits for https://verityx-portal.vercel.app/api/seal-key to show the new key.
 *
 * Requires Node 18+, git, and the Vercel CLI (run via npx; log in once with
 * `npx vercel login`). Receipts signed by a retired key keep verifying.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const ORG = "team_hmdMyBfWSwV5QTQ9S7fS6okN";
const PROJECT = "prj_KfrT5B8tpUV8yuTLGXBaIpBP1tKr";
const SITE = "https://verityx-portal.vercel.app";
const RING = "src/data/seal-keyring.json";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const ri = args.indexOf("--revoke");
const revokeReason = ri >= 0 ? (args[ri + 1] || "").trim() : null;
if (ri >= 0 && (!revokeReason || revokeReason.startsWith("--"))) die('--revoke needs a reason, e.g. --revoke "seed exposed in a chat transcript"');

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const vercelEnv = { ...process.env, VERCEL_ORG_ID: ORG, VERCEL_PROJECT_ID: PROJECT };
function vercel(a, input) {
  return spawnSync("npx", ["--yes", "vercel@latest", ...a], {
    env: vercelEnv,
    input,
    encoding: "utf8",
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
  });
}

// 1. Preconditions
if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") die("Switch to the main branch first.");
if (git("status", "--porcelain")) die("Commit or stash your local changes first.");
git("pull", "--ff-only", "--quiet");
const who = vercel(["whoami"]);
if (who.status !== 0) die("Not logged in to Vercel. Run: npx vercel login");
console.log(`✓ main is clean and current · Vercel user ${who.stdout.trim().split("\n").pop()}`);

// 2. New key, in memory only
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const der = privateKey.export({ format: "der", type: "pkcs8" });
const seed = Buffer.from(der.subarray(der.length - 32));
const x = publicKey.export({ format: "jwk" }).x;
const kid = createHash("sha256").update(Buffer.from(x, "base64url")).digest("hex").slice(0, 16);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const ring = JSON.parse(readFileSync(RING, "utf8"));
const old = ring.keys.find((k) => k.status === "active");
if (!old) die("The keyring has no active key; fix it by hand before rotating.");
if (ring.keys.some((k) => k.kid === kid)) die("Key id collision — run again.");
old.status = revokeReason ? "revoked" : "retired";
old.retiredAt = now;
if (revokeReason) {
  old.revokedAt = now;
  old.revokedReason = revokeReason;
}
ring.keys.push({ kid, alg: "Ed25519", publicKey: x, status: "active", activatedAt: now });

console.log(`\n  ${old.kid}  active → ${old.status}${revokeReason ? ` (${revokeReason})` : ""}`);
console.log(`  ${kid}  new → active\n`);
if (dry) {
  seed.fill(0);
  console.log("Dry run: nothing changed.");
  process.exit(0);
}

// 3. Vercel production env (replace)
vercel(["env", "rm", "VERITYX_SEAL_KEY", "production", "--yes"]);
let add = vercel(["env", "add", "VERITYX_SEAL_KEY", "production", "--sensitive"], seed.toString("hex"));
if (add.status !== 0) add = vercel(["env", "add", "VERITYX_SEAL_KEY", "production"], seed.toString("hex"));
seed.fill(0);
if (add.status !== 0) die(`Vercel did not accept the key:\n${add.stderr}\nNothing was committed; the old key is still the keyring's active key.`);
console.log("✓ VERITYX_SEAL_KEY set on Vercel production (signing pauses until the deploy below lands)");

// 4. Keyring commit + push → deploy
writeFileSync(RING, JSON.stringify(ring, null, 2) + "\n");
git("add", RING);
git(
  "commit",
  "--quiet",
  "-m",
  `Rotate seal key: ${old.kid} ${old.status}, ${kid} active${revokeReason ? `\n\nRevoked: ${revokeReason}` : ""}`,
);
git("push", "--quiet", "origin", "main");
console.log("✓ Keyring committed and pushed; Vercel is deploying");

// 5. Wait for the live key
const deadline = Date.now() + 8 * 60_000;
process.stdout.write("  waiting for the live site to publish the new key");
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15_000));
  process.stdout.write(".");
  try {
    const j = await (await fetch(`${SITE}/api/seal-key`, { cache: "no-store" })).json();
    if (j.available && j.kid === kid) {
      console.log(`\n✓ Live: ${SITE}/api/seal-key now signs with ${kid}. Old receipts still verify.\n`);
      process.exit(0);
    }
  } catch {
    /* keep waiting */
  }
}
console.log(`\n! The deploy has not published ${kid} yet. Check the Vercel dashboard; the server will not sign until it does.\n`);
process.exit(2);
