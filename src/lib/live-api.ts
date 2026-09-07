import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fallbackBundle, fetchLiveBundle } from "@/lib/feeds";
import { runPipeline, sapWriteback, SCENARIOS, BUYER } from "@/lib/engine";
import { issueDeskToken, oidcDiscovery, oidcJwks } from "@/lib/oidc";
import { clusterSnapshot, lastPbftRound, pbftSeq, runPbft } from "@/lib/pbft";
import { getAriba, getSapPo, listSapPos, listAribaRfqs, sapGetEntity, sapWritebackLog, seedSapPo } from "@/lib/sap";
import { getCirculorLot, listCirculorLots, recordCirculorLot } from "@/lib/circulor";
import { getMinespiderByLot, listMinespiderBatches } from "@/lib/minespider";
import { buildAdapterCards } from "@/lib/adapters";
import { ensureGenesis, merkleSnapshot, merkleProofAt, verifyChain, listEvents, LOCAL_CORE, doctor } from "@/lib/core-ledger";

async function seedAll() {
  for (const s of SCENARIOS) {
    seedSapPo({
      po: s.po,
      id: s.id,
      supplier: s.supplier,
      title: s.title,
      plant: s.plant,
      commodity: s.commodity,
      amount: s.proposed,
      currency: s.currency,
    });
    const key = `CIR-SGRE-${s.po.slice(-8)}`;
    if (!getCirculorLot(key) || !getMinespiderByLot(key)) {
      await recordCirculorLot({
        id: s.id,
        po: s.po,
        commodity: s.commodity,
        plant: s.plant,
        tiers: s.tiers,
      });
    }
  }
  if (pbftSeq() === 0) await runPbft("adapter-genesis");
}

function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function hydrateIfDurable() {
  if (typeof process === "undefined") return;
  if (!process.env.DATABASE_URL?.trim()) return;
  try {
    const { hydrateCoreLedger } = await import("@/lib/core-store.server");
    await Promise.race([
      hydrateCoreLedger(),
      new Promise<void>((resolve) => setTimeout(resolve, 2800)),
    ]);
  } catch {
    /* in-memory genesis is enough */
  }
}

async function persistIfDurable() {
  if (typeof process === "undefined") return;
  try {
    const tasks: Promise<unknown>[] = [];
    if (process.env.DATABASE_URL?.trim()) {
      const { persistCoreLedger } = await import("@/lib/core-store.server");
      tasks.push(persistCoreLedger());
    }
    const { persistAdapters } = await import("@/lib/adapter-store.server");
    tasks.push(persistAdapters());
    await Promise.race([
      Promise.all(tasks),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    /* best-effort */
  }
}

async function hydrateAdaptersIfAny() {
  if (typeof process === "undefined") return;
  try {
    const { hydrateAdapters } = await import("@/lib/adapter-store.server");
    await Promise.race([
      hydrateAdapters(),
      new Promise<void>((resolve) => setTimeout(resolve, 1600)),
    ]);
  } catch {
    /* in-memory is enough */
  }
}

async function coreSlice() {
  try {
    await hydrateIfDurable();
    await ensureGenesis();
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
  await hydrateAdaptersIfAny();
  await seedAll();
  const live = await withBudget(fetchLiveBundle(), 4000, fallbackBundle());
  const core = await withBudget(coreSlice(), 3200, undefined);
  const last = lastPbftRound();
  const adapters = buildAdapterCards({
    sapCount: listSapPos().length,
    aribaCount: listAribaRfqs().length,
    argus: live.health.argus,
    gleif: live.health.gleif,
    sanctions: live.health.sanctions,
    opensanctions: live.health.opensanctions,
    news: live.health.news,
    pbftSeq: pbftSeq(),
    pbftCommitted: last?.committed,
    circulorLots: listCirculorLots().length,
    minespiderBatches: listMinespiderBatches().length,
    okta: "LIVE",
  });
  return {
    ...live,
    sapCount: listSapPos().length,
    sap: listSapPos().map((p) => ({
      PurchaseOrder: p.PurchaseOrder,
      ReleaseStatus: p.ReleaseStatus,
      NetAmount: p.NetAmount,
      Supplier: p.Supplier,
      LastChangeDateTime: p.LastChangeDateTime,
      ETag: p.ETag,
    })),
    ariba: listAribaRfqs(),
    writebacks: sapWritebackLog().slice(0, 8),
    cluster: clusterSnapshot(last || undefined),
    adapters,
    core,
  };
});

export const runLiveVerify = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1).max(40) }).parse(data))
  .handler(async ({ data }) => {
    await hydrateAdaptersIfAny();
    await seedAll();
    const live = await withBudget(fetchLiveBundle(), 2800, fallbackBundle());
    const packet = await runPipeline(data.id, live);
    await persistIfDurable();
    return packet;
  });

export const postSapWriteback = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1).max(40), action: z.enum(["HOLD", "RELEASE"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    await hydrateAdaptersIfAny();
    await seedAll();
    const s = SCENARIOS.find((x) => x.id === data.id) || SCENARIOS[0];
    const rec = sapWriteback(s, data.action, data.action === "HOLD" ? "HOLD_PO" : "RELEASE_PO");
    void persistIfDurable();
    return {
      rec,
      sap: getSapPo(s.po),
      ariba: getAriba(s.po),
      entity: sapGetEntity(s.po),
    };
  });

export const oidcToken = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        email: z.string().email().optional(),
        password: z.string().min(1).max(80).optional(),
        seat: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.seat ? BUYER.email : data.email || "";
    const password = data.seat ? BUYER.password : data.password || "";
    const tok = await issueDeskToken(email, password);
    if (!tok) return { ok: false as const, error: "invalid_grant" };
    return {
      ok: true as const,
      access_token: tok.access_token,
      id_token: tok.id_token,
      token_type: "Bearer" as const,
      expires_in: tok.expires_in,
      claims: {
        sub: String(tok.claims.sub || ""),
        iss: String(tok.claims.iss || ""),
        email: String(tok.claims.email || ""),
        name: String(tok.claims.name || ""),
        idp: "okta",
      },
    };
  });

export const oidcWellKnown = createServerFn({ method: "GET" }).handler(async () => oidcDiscovery());

export const oidcKeys = createServerFn({ method: "GET" }).handler(async () => oidcJwks());

export const getCoreStatus = createServerFn({ method: "GET" }).handler(async () => {
  await hydrateIfDurable();
  await ensureGenesis();
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
