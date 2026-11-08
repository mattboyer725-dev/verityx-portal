#!/usr/bin/env node
/**
 * Keyring guard: the committed seal keyring must be valid, and every change to
 * it must be append-only and monotonic (see src/lib/seal-keyring.ts).
 *
 *   node --experimental-strip-types scripts/check-keyring.mjs [previous-git-ref]
 *
 * Without a ref only the current file is validated. Exit 1 on any problem.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { validateKeyring, validateTransition } from "../src/lib/seal-keyring.ts";

const PATH = "src/data/seal-keyring.json";
const next = JSON.parse(readFileSync(new URL(`../${PATH}`, import.meta.url), "utf8"));
const errs = await validateKeyring(next);

const ref = process.argv[2];
if (ref && !/^0+$/.test(ref)) {
  let prevText = null;
  try {
    prevText = execFileSync("git", ["show", `${ref}:${PATH}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    console.log(`[keyring] ${PATH} did not exist at ${ref}; validating the current file only.`);
  }
  if (prevText) errs.push(...validateTransition(JSON.parse(prevText), next));
}

if (errs.length) {
  for (const e of errs) console.error(`[keyring] ${e}`);
  process.exit(1);
}
const active = next.keys.find((k) => k.status === "active");
console.log(`[keyring] ok · ${next.keys.length} key(s) · active ${active.kid}`);
