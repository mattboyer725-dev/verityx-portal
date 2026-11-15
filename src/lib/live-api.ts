import { createServerFn } from "@tanstack/react-start";
import { parseQuoteInput } from "@/lib/quote-check";
import { z } from "zod";
import { fallbackBundle, fetchLiveBundle } from "@/lib/feeds";
import { buildAdapterCards } from "@/lib/adapters";

const adapterHealth = (h: string | undefined) => (h === "LIVE" || h === "REFERENCE" || h === "DOWN" ? h : "STALE");
import { merkleSnapshot, merkleProofAt, verifyChain, listEvents, LOCAL_CORE, doctor } from "@/lib/core-ledger";

function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Load the true chain for display. Reads only: a slow database shows the last loaded state, never a new chain. */
async function hydrateIfDurable() {
  if (typeof process === "undefined") return;
  try {
    const { refreshLedger } = await import("@/lib/core-store.server");
    await Promise.race([refreshLedger(), new Promise<void>((resolve) => setTimeout(resolve, 2800))]);
  } catch {
    /* the status view reports what it has */
  }
}

async function coreSlice() {
  try {
    await hydrateIfDurable();
    const core = await merkleSnapshot();
    const chain = await verifyChain();
    const coreDoctor = await doctor();
    return {
      ...core,
      ok: chain.ok,
      repo: LOCAL_CORE.repo,
      sha: LOCAL_CORE.sha,
      doctor: coreDoctor || undefined,
      events: listEvents().slice(-6).map((e) => ({
        id: e.id,
        type: e.type,
        hash: e.hash,
        mac: e.mac.slice(0, 16),
        ts: e.ts,
      })),
    };
  } catch {
    return undefined;
  }
}

export const getLiveSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const live = await withBudget(fetchLiveBundle(), 4000, fallbackBundle());
  // Dated history: record prices at most every 15 minutes (never blocks the response).
  void import("@/lib/price-history.server").then((m) => m.recordSnapshotIfDue(live)).catch(() => undefined);
  const core = await withBudget(coreSlice(), 3200, undefined);
  const adapters = buildAdapterCards({
    prices: live.health.metals === "DOWN" ? "DOWN" : live.health.fx === "LIVE" ? "LIVE" : "REFERENCE",
    gleif: adapterHealth(live.health.gleif),
    sanctions: adapterHealth(live.health.sanctions),
    news: adapterHealth(live.health.news),
  });
  return { ...live, adapters, core };
});

export const getCoreStatus = createServerFn({ method: "GET" }).handler(async () => {
  await hydrateIfDurable();
  const [chain, snap, doc] = await Promise.all([verifyChain(), merkleSnapshot(), doctor()]);
  let proof: Awaited<ReturnType<typeof merkleProofAt>> | null = null;
  if (snap.leaf_count > 0) {
    try {
      proof = await merkleProofAt(snap.leaf_count - 1);
    } catch {
      proof = null;
    }
  }
  return {
    chain,
    snap,
    doctor: doc,
    events: listEvents(),
    proof,
    core: LOCAL_CORE,
  };
});

/**
 * Check any quote — public and read-only: nothing is written to the ledger.
 * Sealing a result needs a signed-in workspace seat (sealQuoteCheck).
 */
export const checkCustomQuote = createServerFn({ method: "POST" })
  .validator((data: unknown) => parseQuoteInput(data))
  .handler(async ({ data }) => {
    const { runQuoteCheck } = await import("@/lib/quote-check.server");
    return runQuoteCheck(data);
  });

/** Ed25519 seal receipt for one ledger entry, with its Merkle proof at the current root. */
async function receiptFor(entry: { hash: string } & Parameters<typeof import("@/lib/receipt.server").issueReceipt>[0]) {
  try {
    const { eventHashes, inclusionProof } = await import("@/lib/core-ledger");
    const { issueReceipt } = await import("@/lib/receipt.server");
    const hashes = eventHashes();
    const index = hashes.indexOf(entry.hash);
    if (index < 0) return null;
    const { root, path } = await inclusionProof(hashes, index);
    const r = await issueReceipt(entry, { root, index, leafCount: hashes.length, path });
    return r ? JSON.stringify(r, null, 2) : null;
  } catch {
    return null;
  }
}
