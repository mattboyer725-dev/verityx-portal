import { fetchLiveBundle, SUPPLIER_PO, type LiveBundle } from "./feeds.ts";
import { ecovadisMethodology, type EcoVadisScore } from "./ecovadis.ts";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "X-EcoVadis-Protocol": "v2-scorecard-analog",
    },
  });
}

function poFor(supplier: string) {
  return SUPPLIER_PO[supplier];
}

export function bindEcovadisPo(card: EcoVadisScore): EcoVadisScore {
  return { ...card, po: card.po || poFor(card.supplier) };
}

export function ecovadisListBody(live: LiveBundle) {
  const scorecards = Object.values(live.ecovadis).map(bindEcovadisPo);
  return {
    protocol: "EcoVadis scorecard analog",
    methodology: "21-criteria · 4 themes · GLEIF + UN/OpenSanctions + news RSS",
    industry: "NACE 27 · Manufacture of electrical equipment",
    vendor: {
      subscribed: false,
      note: "EcoVadis is not a tenant. Scorecards are public-methodology analogs on this host.",
    },
    count: scorecards.length,
    scorecards,
  };
}

export async function handleEcovadisHttp(request: Request, live?: LiveBundle): Promise<Response | null> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/ecovadis")) path = path.replace(/^\/api\/ecovadis/, "/ecovadis/api");
  if (!path.startsWith("/ecovadis/")) return null;

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

  if (path === "/ecovadis/api/v2/methodology" && method === "GET") {
    return json(ecovadisMethodology());
  }

  const bundle = live ?? (await fetchLiveBundle());

  if (path === "/ecovadis/api/v2/scorecards" && method === "GET") {
    return json(ecovadisListBody(bundle));
  }

  const one = path.match(/^\/ecovadis\/api\/v2\/scorecards\/([^/]+)$/);
  if (one && method === "GET") {
    const id = decodeURIComponent(one[1]);
    const rec = Object.values(bundle.ecovadis)
      .map(bindEcovadisPo)
      .find((c) => c.id === id || c.supplier === id || c.po === id);
    if (!rec) return json({ error: "scorecard not found" }, 404);
    return json(rec);
  }

  return json({ error: "Not found on EcoVadis analog tenant" }, 404);
}
