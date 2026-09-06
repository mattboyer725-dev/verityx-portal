import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLiveBundle } from "@/lib/feeds";
import { runPipeline, sapWriteback, SCENARIOS, BUYER } from "@/lib/engine";
import { issueDeskToken, oidcDiscovery, oidcJwks } from "@/lib/oidc";
import { clusterSnapshot } from "@/lib/pbft";
import { getAriba, getSapPo, listSapPos, sapGetEntity, sapWritebackLog, seedSapPo } from "@/lib/sap";
import { ensureGenesis, merkleSnapshot, verifyChain, listEvents, LOCAL_CORE, doctor } from "@/lib/core-ledger";

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

export const getLiveSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  seedAll();
  try {
    await ensureGenesis();
  } catch {
    /* genesis is best-effort */
  }
  let live: Awaited<ReturnType<typeof fetchLiveBundle>>;
  try {
    live = await fetchLiveBundle();
  } catch {
    live = await fetchLiveBundle(true).catch(() => {
      throw new Error("live bundle failed");
    });
  }
  let core: Awaited<ReturnType<typeof merkleSnapshot>> | null = null;
  let chain = { ok: false, depth: 0 };
  let coreDoctor: Awaited<ReturnType<typeof doctor>> | null = null;
  try {
    core = await merkleSnapshot();
    chain = await verifyChain();
    coreDoctor = await doctor();
  } catch {
    /* core best-effort */
  }
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
    core: core
      ? {
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
        }
      : undefined,
  };
});

export const runLiveVerify = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1).max(40) }).parse(data))
  .handler(async ({ data }) => {
    seedAll();
    const live = await fetchLiveBundle();
    return runPipeline(data.id, live);
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
