import { createFileRoute } from "@tanstack/react-router";

/** Launch readiness as on/off flags (no secrets). Used by the owner checklist and the uptime job. */
export const Route = createFileRoute("/api/readiness")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readiness } = await import("@/lib/readiness.server");
        const body: Record<string, unknown> = await readiness();
        if (new URL(request.url).searchParams.get("sources") === "1") {
          const { feedDiagnostics } = await import("@/lib/feeds");
          body.sources = await feedDiagnostics();
        }
        return Response.json(body, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
