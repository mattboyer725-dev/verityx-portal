import { createFileRoute } from "@tanstack/react-router";

/** Launch readiness as on/off flags (no secrets). Used by the owner checklist and the uptime job. */
export const Route = createFileRoute("/api/readiness")({
  server: {
    handlers: {
      GET: async () => {
        const { readiness } = await import("@/lib/readiness.server");
        return Response.json(await readiness(), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
