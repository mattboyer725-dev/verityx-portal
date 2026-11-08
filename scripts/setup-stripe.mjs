#!/usr/bin/env node
/**
 * Connect VerityX to Stripe — run on your own machine. Test mode first, then live.
 *
 *   node scripts/setup-stripe.mjs                    prompts for the key (hidden), test or live
 *   node scripts/setup-stripe.mjs --url https://verityx.example   when on a custom domain
 *
 * What it does:
 *   1. Checks you are on a clean, current main and logged in to Vercel.
 *   2. Asks for your Stripe secret key without echoing it (never as an argument,
 *      so it stays out of shell history) and confirms the account with Stripe.
 *   3. Creates the webhook endpoint VerityX needs, replacing one this script made
 *      before. Stripe returns its signing secret once; it goes straight to Vercel.
 *   4. Sets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on Vercel production.
 *   5. Pushes an empty commit to redeploy, then waits for /api/readiness to
 *      report the Stripe mode you just set.
 *
 * Keys are held only in this process's memory. Requires Node 18+, git and the
 * Vercel CLI via npx (`npx vercel login` once).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const ORG = "team_hmdMyBfWSwV5QTQ9S7fS6okN";
const PROJECT = "prj_KfrT5B8tpUV8yuTLGXBaIpBP1tKr";
const ui = process.argv.indexOf("--url");
const SITE = (ui >= 0 ? process.argv[ui + 1] : "https://verityx-portal.vercel.app").replace(/\/+$/, "");
const HOOK_URL = `${SITE}/api/billing/stripe/webhook`;
const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
];

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
function setEnv(name, value) {
  vercel(["env", "rm", name, "production", "--yes"]);
  let r = vercel(["env", "add", name, "production", "--sensitive"], value);
  if (r.status !== 0) r = vercel(["env", "add", name, "production"], value);
  if (r.status !== 0) die(`Vercel did not accept ${name}:\n${r.stderr}`);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(prompt)) rl.output.write(s);
    };
    rl.question(prompt, (v) => {
      rl.close();
      process.stdout.write("\n");
      resolve(v.trim());
    });
  });
}

async function stripe(key, method, path, form) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await res.json();
  if (!res.ok) die(`Stripe ${method} ${path}: ${j.error?.message ?? res.status}`);
  return j;
}

// 1. Preconditions
if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") die("Switch to the main branch first.");
if (git("status", "--porcelain")) die("Commit or stash your local changes first.");
git("pull", "--ff-only", "--quiet");
if (vercel(["whoami"]).status !== 0) die("Not logged in to Vercel. Run: npx vercel login");

// 2. Key
const key = await askHidden("Stripe secret key (sk_test_… for a test run, sk_live_… to go live; hidden): ");
if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key)) die("That does not look like a Stripe secret key.");
const live = /_live_/.test(key);
const acct = await stripe(key, "GET", "/v1/account");
const name = acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.id;
console.log(`✓ Stripe account: ${name} · ${live ? "LIVE" : "test mode"}`);
if (live && !acct.charges_enabled) die("This live account cannot take payments yet. Finish activation in the Stripe Dashboard first.");

// 3. Webhook endpoint (replace one this script created before)
const existing = await stripe(key, "GET", "/v1/webhook_endpoints?limit=100");
for (const ep of existing.data ?? []) {
  if (ep.url === HOOK_URL && ep.metadata?.created_by === "verityx-setup-stripe") {
    await stripe(key, "DELETE", `/v1/webhook_endpoints/${ep.id}`);
    console.log(`  replaced earlier endpoint ${ep.id}`);
  }
}
const form = { url: HOOK_URL, description: "VerityX pilot payments", "metadata[created_by]": "verityx-setup-stripe" };
EVENTS.forEach((e, i) => (form[`enabled_events[${i}]`] = e));
const ep = await stripe(key, "POST", "/v1/webhook_endpoints", form);
console.log(`✓ Webhook ${ep.id} → ${HOOK_URL}`);

// 4. Vercel env
setEnv("STRIPE_SECRET_KEY", key);
setEnv("STRIPE_WEBHOOK_SECRET", ep.secret);
console.log("✓ STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set on Vercel production");

// 5. Redeploy and confirm
git("commit", "--allow-empty", "--quiet", "-m", `Stripe connected (${live ? "live" : "test"} mode)`);
git("push", "--quiet", "origin", "main");
const head = git("rev-parse", "HEAD").slice(0, 12);
process.stdout.write("  redeploying");
const want = live ? "live" : "test";
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15_000));
  process.stdout.write(".");
  try {
    const j = await (await fetch(`${SITE}/api/readiness`, { cache: "no-store" })).json();
    if (j.commit === head && j.stripeMode === want && j.checks?.stripeWebhook?.ok) {
      console.log(`\n✓ Live site reports Stripe ${want} mode with webhook.\n`);
      console.log(
        live
          ? "Live charges are real. To prove the live path once: pay one pilot yourself, confirm it shows Paid in /work, then refund it in the Stripe Dashboard.\n"
          : "Next: in /work create a pilot, press Create checkout, pay with card 4242 4242 4242 4242 (any future date, any CVC), and confirm the pilot shows Paid.\n",
      );
      process.exit(0);
    }
  } catch {
    /* keep waiting */
  }
}
console.log("\n! Not confirmed yet. Check /api/readiness after the deploy finishes.\n");
process.exit(2);
