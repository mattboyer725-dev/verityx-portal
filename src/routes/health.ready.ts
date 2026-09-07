import { createFileRoute } from "@tanstack/react-router";
import { durableDatabaseRequired } from "@/lib/postgres-url";

export const Route = createFileRoute("/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        const hasUrl = Boolean(process.env.DATABASE_URL?.trim());
        const durable = durableDatabaseRequired() || hasUrl;
        if (durableDatabaseRequired() && !hasUrl) {
          return Response.json(
            {
              status: "not-ready",
              db: false,
              error: "DATABASE_URL is required on Google Cloud (Cloud SQL). PGLite is preview-only.",
            },
            { status: 503 },
          );
        }
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await Promise.race([
            getSql(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 6500)),
          ]);
          if (!sql) {
            return Response.json(
              { status: durable ? "not-ready" : "ready", db: "warming" },
              { status: durable ? 503 : 200 },
            );
          }
          const ping = await Promise.race([
            sql`select 1 as ok`,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
          if (!ping) {
            return Response.json(
              { status: durable ? "not-ready" : "ready", db: "timeout" },
              { status: durable ? 503 : 200 },
            );
          }
          return Response.json({ status: "ready", db: true });
        } catch (err) {
          return Response.json(
            {
              status: durable ? "not-ready" : "ready",
              db: false,
              error: err instanceof Error ? err.message : "db",
            },
            { status: durable ? 503 : 200 },
          );
        }
      },
    },
  },
});
