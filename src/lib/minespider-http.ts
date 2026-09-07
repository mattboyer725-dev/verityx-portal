import { getMinespiderBatch, listMinespiderBatches } from "./minespider.ts";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "X-Minespider-Protocol": "v1-batch-passport",
    },
  });
}

export async function handleMinespiderHttp(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/minespider")) path = path.replace(/^\/api\/minespider/, "/minespider/api");
  if (!path.startsWith("/minespider/")) return null;

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

  if (path === "/minespider/api/v1/batches" && method === "GET") {
    const batches = listMinespiderBatches();
    return json({
      protocol: "Minespider-shaped SHA-256 batch passport",
      count: batches.length,
      batches,
    });
  }

  const one = path.match(/^\/minespider\/api\/v1\/batches\/([^/]+)$/);
  if (one && method === "GET") {
    const rec = getMinespiderBatch(decodeURIComponent(one[1]));
    if (!rec) return json({ error: "batch not found" }, 404);
    return json(rec);
  }

  const passport = path.match(/^\/minespider\/api\/v1\/passports\/([^/]+)$/);
  if (passport && method === "GET") {
    const id = decodeURIComponent(passport[1]);
    const rec =
      getMinespiderBatch(id) ||
      listMinespiderBatches().find((b) => b.dppId === id || b.lot === id) ||
      null;
    if (!rec) return json({ error: "passport not found" }, 404);
    return json({
      productPassportId: rec.dppId,
      batchId: rec.batchId,
      gs1DigitalLink: rec.gs1,
      certificate: rec.certificate,
      events: rec.events,
    });
  }

  return json({ error: "Not found on Minespider analog tenant" }, 404);
}
