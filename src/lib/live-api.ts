import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fallbackBundle, fetchLiveBundle } from "@/lib/feeds";
import { runPipeline, sapWriteback, SCENARIOS, BUYER } from "@/lib/engine";
import { issueDeskToken, oidcDiscovery, oidcJwks } from "@/lib/oidc";
import { clusterSnapshot } from "@/lib/pbft";
import { getAriba, getSapPo, listSapPos, sapGetEntity, sapWritebackLog, seedSapPo } from "@/lib/sap";
import { ensureGenesis, merkleSnapshot, merkleProofAt, verifyChain, listEvents, LOCAL_CORE, doctor } from "@/lib/core-ledger";

function seedAll() {
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
  }
}

function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function hydrateCoreSoft(ms = 400) {
  void withBudget(
    (async () => {
      try {
        const { hydrateCoreLedger } = await import("@/lib/core-store.server");
        await hydrateCoreLedger();
      } catch {
        await ensureGenesis();
      }
    })(),
    ms,
    undefined,
  );
}

async function coreSlice() {
  try {
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
  seedAll();
  void hydrateCoreSoft(400);
  const live = await withBudget(fetchLiveBundle(), 5500, fallbackBundle());
  const core = await withBudget(coreSlice(), 400, undefined);
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
    ariba: SCENARIOS.map((s) => getAriba(s.po)).filter(Boolean),
    writebacks: sapWritebackLog().slice(0, 8),
    cluster: clusterSnapshot(),
    core,
  };
});

export const runLiveVerify = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1).max(40) }).parse(data))
  .handler(async ({ data }) => {
    seedAll();
    void hydrateCoreSoft(400);
    const live = await withBudget(fetchLiveBundle(), 5500, fallbackBundle());
    const result = await runPipeline(data.id, live);
    try {
      const { persistCoreLedger } = await import("@/lib/core-store.server");
      void persistCoreLedger();
    } catch {
      /* durable write is best-effort */
    }
    return result;
  });

export const postSapWriteback = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1).max(40), action: z.enum(["HOLD", "RELEASE"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    seedAll();
    const s = SCENARIOS.find((x) => x.id === data.id) || SCENARIOS[0];
    const rec = sapWriteback(s, data.action, data.action === "HOLD" ? "HOLD_PO" : "RELEASE_PO");
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
  try {
    const { hydrateCoreLedger } = await import("@/lib/core-store.server");
    await withBudget(hydrateCoreLedger(), 1500, undefined);
  } catch {
    await ensureGenesis().catch(() => undefined);
  }
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

