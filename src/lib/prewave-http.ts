import { fetchLiveBundle, SUPPLIER_PO, type LiveBundle } from "./feeds.ts";
import { flattenAlerts, prewaveTaxonomy, type PrewaveRisk } from "./prewave.ts";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "X-Prewave-Protocol": "v1-media-risk-analog",
    },
  });
}

function poFor(supplier: string) {
  return SUPPLIER_PO[supplier];
}

export function bindPrewavePo(row: PrewaveRisk): PrewaveRisk {
  return { ...row, po: row.po || poFor(row.supplier) };
}

export function prewaveListBody(live: LiveBundle) {
  const risks = Object.values(live.prewave).map(bindPrewavePo);
  return {
    protocol: "Prewave media-risk analog",
    vendor: {
      subscribed: false,
      note: "Prewave is not a tenant. Heat is live news RSS on the same PO the EcoVadis analog scores.",
    },
    count: risks.length,
    risks,
  };
}

export async function handlePrewaveHttp(request: Request, live?: LiveBundle): Promise<Response | null> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/prewave")) path = path.replace(/^\/api\/prewave/, "/prewave/api");
  if (!path.startsWith("/prewave/")) return null;

  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      },
    });
  }

  if (path === "/prewave/api/v1/taxonomy" && method === "GET") {
    return json(prewaveTaxonomy());
  }

  const bundle = live ?? (await fetchLiveBundle());
  const risks = Object.values(bundle.prewave).map(bindPrewavePo);

  if (path === "/prewave/api/v1/risks" && method === "GET") {
    return json(prewaveListBody(bundle));
  }

  if (path === "/prewave/api/v1/alerts" && method === "GET") {
    const alerts = flattenAlerts(risks);
    return json({
      protocol: "Prewave media-risk analog",
      count: alerts.length,
      alerts,
    });
  }

  const one = path.match(/^\/prewave\/api\/v1\/risks\/([^/]+)$/);
  if (one && method === "GET") {
    const id = decodeURIComponent(one[1]);
    const rec = risks.find((r) => r.id === id || r.supplier === id || r.po === id);
    if (!rec) return json({ error: "risk not found" }, 404);
    return json(rec);
  }

  return json({ error: "Not found on Prewave analog tenant" }, 404);
}
