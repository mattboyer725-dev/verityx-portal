import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/prices            → 30-day price history + drift alerts on open POs
 * GET /api/prices?record=1   → also record a snapshot if one is due (daily cron)
 */
export const Route = createFileRoute("/api/prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days")) || 30));
        const { fetchLiveBundle } = await import("@/lib/feeds");
        const { recordSnapshotIfDue, historyAndDrift } = await import("@/lib/price-history.server");
        const { SCENARIOS } = await import("@/lib/engine");
        let recorded = false;
        if (url.searchParams.get("record") === "1") {
          recorded = await recordSnapshotIfDue(await fetchLiveBundle());
        }
        const orders = SCENARIOS.map((s) => ({ id: s.id, po: s.po, title: s.title, commodity: s.commodity }));
        const { series, report } = await historyAndDrift(orders, days);
        return Response.json(
          { recorded, days, series, report },
          { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
        );
      },
    },
  },
});
