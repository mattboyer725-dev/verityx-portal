import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await Promise.race([
            getSql(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
          ]);
          if (!sql) return Response.json({ status: "ready", db: "warming" });
          await Promise.race([
            sql`select 1 as ok`,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
          return Response.json({ status: "ready", db: true });
        } catch (err) {
          return Response.json(
            { status: "ready", db: false, error: err instanceof Error ? err.message : "db" },
            { status: 200 },
          );
        }
      },
    },
  },
});
