import { buildAdapterCards } from "@/lib/adapters";
import { listCirculorLots, getCirculorLot, recordCirculorLot } from "@/lib/circulor";
import { fetchLiveBundle } from "@/lib/feeds";
import { SCENARIOS } from "@/lib/engine";
import { clusterSnapshot, lastPbftRound, pbftSeq, runPbft } from "@/lib/pbft";
import { handleOidcHttp } from "@/lib/oidc-http";
import { handleSapHttp } from "@/lib/sap-http";
import { handleAribaHttp } from "@/lib/ariba-http";
import { handleMinespiderHttp } from "@/lib/minespider-http";
import { handleEcovadisHttp } from "@/lib/ecovadis-http";
import { handlePrewaveHttp } from "@/lib/prewave-http";
import { listSapPos, listAribaRfqs, seedSapPo, sapWritebackLog } from "@/lib/sap";
import { listMinespiderBatches, getMinespiderByLot } from "@/lib/minespider";

async function seedDesk() {
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

export async function handlePublicAdapterHttp(request: Request): Promise<Response | null> {
  await seedDesk();
  const sap = await handleSapHttp(request);
  if (sap) {
    if (["PATCH", "POST", "PUT"].includes(request.method.toUpperCase())) {
      void import("@/lib/adapter-store.server")
        .then((m) => m.persistAdapters())
        .catch(() => undefined);
    }
    return sap;
  }
  const ariba = await handleAribaHttp(request);
  if (ariba) {
    if (["PATCH", "POST", "PUT"].includes(request.method.toUpperCase())) {
      void import("@/lib/adapter-store.server")
        .then((m) => m.persistAdapters())
        .catch(() => undefined);
    }
    return ariba;
  }
  const oidc = await handleOidcHttp(request);
  if (oidc) return oidc;
  const minespider = await handleMinespiderHttp(request);
  if (minespider) return minespider;
  const eco = await handleEcovadisHttp(request);
  if (eco) return eco;
  const pre = await handlePrewaveHttp(request);
  if (pre) return pre;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS" && (path.startsWith("/api/oracle") || path.startsWith("/api/pbft") || path.startsWith("/api/circulor") || path.startsWith("/ariba/") || path.startsWith("/minespider/") || path.startsWith("/ecovadis/") || path.startsWith("/prewave/") || path === "/api/adapters")) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (path === "/api/adapters" && method === "GET") {
    const live = await fetchLiveBundle();
    const last = lastPbftRound();
    return Response.json({
      adapters: buildAdapterCards({
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
      }),
      sap: listSapPos().map((p) => ({
        PurchaseOrder: p.PurchaseOrder,
        ReleaseStatus: p.ReleaseStatus,
        Supplier: p.Supplier,
        ETag: p.ETag,
      })),
      ariba: listAribaRfqs().map((r) => ({
        eventId: r.eventId,
        status: r.status,
        po: r.po,
        supplier: r.supplier,
      })),
      writebacks: sapWritebackLog().slice(0, 8),
      cluster: clusterSnapshot(last || undefined),
      lastRound: last
        ? {
            seq: last.seq,
            digest: last.digest,
            committed: last.committed,
            primary: last.primary,
            prepareOk: last.prepareOk,
            commitOk: last.commitOk,
            network: last.network,
          }
        : null,
      lots: listCirculorLots().map((l) => ({ lot: l.lot, commodity: l.commodity, events: l.events.length, dppId: l.dppId, minespiderBatch: l.minespiderBatch })),
      minespider: listMinespiderBatches().map((b) => ({
        batchId: b.batchId,
        lot: b.lot,
        events: b.events.length,
        certificate: b.certificate.hash,
      })),
      vendor: {
        note: "Siemens S/4HANA, Argus Metals, EcoVadis, Prewave, RapidRatings, Circulor, and Okta Workforce are not subscribed. Adapters above are live protocol implementations on this host.",
      },
      ecovadis: Object.values(live.ecovadis).slice(0, 8),
      prewave: Object.values(live.prewave).slice(0, 8),
    });
  }

  if ((path === "/api/oracle" || path === "/api/oracle/tape") && method === "GET") {
    const live = await fetchLiveBundle();
    return Response.json({
      argus: live.argus,
      lme: {
        copperUsdMt: live.lme.copperUsdMt,
        aluminiumUsdMt: live.lme.aluminiumUsdMt,
        source: live.lme.source,
        ts: live.lme.ts,
      },
      fx: live.fx,
      health: live.health,
    });
  }

  if (path === "/api/oracle/stream" && method === "GET") {
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const push = async () => {
          if (closed) return;
          try {
            const live = await fetchLiveBundle();
            const payload = JSON.stringify({
              t: Date.now(),
              argus: live.argus,
              lme: {
                copperUsdMt: live.lme.copperUsdMt,
                aluminiumUsdMt: live.lme.aluminiumUsdMt,
                source: live.lme.source,
              },
              fx: live.fx,
            });
            controller.enqueue(encoder.encode(`event: tick\ndata: ${payload}\n\n`));
          } catch {
            closed = true;
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }
        };
        await push();
        const id = setInterval(() => void push(), 4000);
        const t = setTimeout(() => {
          clearInterval(id);
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }, 60_000);
        const abort = () => {
          clearInterval(id);
          clearTimeout(t);
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        request.signal.addEventListener("abort", abort);
      },
      cancel() {
        closed = true;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  if (path === "/api/pbft" && method === "GET") {
    const last = lastPbftRound();
    return Response.json({
      n: 27,
      f: 8,
      quorum: 19,
      seq: pbftSeq(),
      last: last
        ? {
            seq: last.seq,
            digest: last.digest,
            committed: last.committed,
            primary: last.primary,
            byzantine: last.byzantine,
            prepareOk: last.prepareOk,
            commitOk: last.commitOk,
            network: last.network,
            ts: last.ts,
          }
        : null,
      cluster: clusterSnapshot(last || undefined),
    });
  }

  if (path === "/api/pbft/round" && method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { payload?: string };
    const round = await runPbft(body.payload || `adapter-seal:${Date.now()}`);
    return Response.json(round);
  }

  if (path === "/api/circulor/lots" && method === "GET") {
    return Response.json({ lots: listCirculorLots() });
  }

  const lotMatch = path.match(/^\/api\/circulor\/lots\/([^/]+)$/);
  if (lotMatch && method === "GET") {
    const lot = getCirculorLot(decodeURIComponent(lotMatch[1]));
    if (!lot) return Response.json({ error: "lot not found" }, { status: 404 });
    return Response.json(lot);
  }

  return null;
}
