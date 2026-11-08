/**
 * Client-safe Local Core identity. Nothing in this module may touch key
 * material: routes and components import it for display, so it ships to the
 * browser. Signing lives in core-ledger.ts and reads its key from the server
 * environment only.
 */
export const CORE_VERSION = "1.7.0";
export const CORE_SHA = "0188c849fc4482a5a15cf2a9e624b3a8550978d6";
export const CORE_REPO = "mattboyer725-dev/verityx-local-core";

export const LOCAL_CORE = {
  version: CORE_VERSION,
  repo: CORE_REPO,
  sha: CORE_SHA,
};
