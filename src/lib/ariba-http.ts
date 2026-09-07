import {
  getAribaByEvent,
  listAribaRfqs,
  patchAribaEvent,
  type AribaRfq,
} from "./sap.ts";

function eventView(rfq: AribaRfq) {
  return {
    eventId: rfq.eventId,
    title: rfq.title,
    status: rfq.status,
    eventType: "RFQ" as const,
    commodities: [{ name: rfq.commodity }],
    suppliers: [{ name: rfq.supplier }],
    baselineSpend: { amount: rfq.amount, currency: rfq.currency },
    relatedDocument: { type: "PurchaseOrder", id: rfq.po },
    createdDate: rfq.createdAt,
    lastModifiedDate: new Date().toISOString(),
  };
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "X-Ariba-API": "sourcing-v2",
    },
  });
}

export async function handleAribaHttp(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/ariba")) path = path.replace(/^\/api\/ariba/, "/ariba/api");
  if (!path.startsWith("/ariba/")) return null;

  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,PATCH,POST,OPTIONS",
      },
    });
  }

  if (path === "/ariba/api/sourcing/v2/events" && method === "GET") {
    const events = listAribaRfqs().map(eventView);
    return json({ d: { results: events }, count: events.length });
  }

  const one = path.match(/^\/ariba\/api\/sourcing\/v2\/events\/([^/]+)$/);
  if (one && method === "GET") {
    const rfq = getAribaByEvent(decodeURIComponent(one[1]));
    if (!rfq) return json({ error: { message: "Event not found" } }, 404);
    return json({ d: eventView(rfq) });
  }

  if (one && (method === "PATCH" || method === "POST")) {
    let status: "Open" | "Awarded" | "OnHold" = "OnHold";
    try {
      const body = (await request.json()) as { status?: string };
      const raw = String(body.status || "").toLowerCase();
      if (raw === "open") status = "Open";
      else if (raw === "awarded" || raw === "award") status = "Awarded";
      else status = "OnHold";
    } catch {
      /* default OnHold */
    }
    const rec = patchAribaEvent(decodeURIComponent(one[1]), status);
    if (!rec) return json({ error: { message: "Event not found" } }, 404);
    return json({ d: eventView(rec), po: rec.po, status: rec.status });
  }

  return json({ error: { message: "Not found on Ariba analog tenant" } }, 404);
}
