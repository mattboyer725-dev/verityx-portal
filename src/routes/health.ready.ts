import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await sql`select 1 as ok`;
          return Response.json({ status: "ready", db: true });
        } catch (err) {
          return Response.json(
            { status: "not_ready", error: err instanceof Error ? err.message : "db" },
            { status: 503 },
          );
        }
      },
    },
  },
});
