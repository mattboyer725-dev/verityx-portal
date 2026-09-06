import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BUYER } from "@/lib/engine";

/**
 * Desk control + telemetry RPCs. Intentionally does not import `@/lib/db` at
 * module scope — a top-level getSql() bootstraps PGLite/WASM and wedges the
 * serverless isolate before the handler can time out.
 */
export const getDeskControls = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await Promise.race([
      getSql(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ]);
    if (!sql) return { frozen: false, maintenance: false, announce: "" };
    const rows = await Promise.race([
      sql<{ key: string; value: string }>`select key, value from admin_settings`,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ]);
    if (!rows) return { frozen: false, maintenance: false, announce: "" };
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      frozen: map.desk_frozen === "true",
      maintenance: map.maintenance === "true",
      announce: map.announce ?? "",
    };
  } catch {
    return { frozen: false, maintenance: false, announce: "" };
  }
});

const DeskEventSchema = z.object({
  kind: z.enum(["desk.login", "desk.verify", "desk.writeback", "desk.export", "desk.logout"]),
  target: z.string().max(120).optional(),
  detail: z.string().max(280).optional(),
});

export const recordDeskEvent = createServerFn({ method: "POST" })
  .validator((data: unknown) => DeskEventSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await Promise.race([
        getSql(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
      ]);
      if (!sql) return { ok: true as const };
      const id = `ev-${crypto.randomUUID().slice(0, 10)}`;
      const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
      await sql`insert into ops_events (id, kind, actor_email, actor_name, target, detail)
      values (${id}, ${data.kind}, ${BUYER.email}, ${BUYER.name}, ${clip(data.target ?? "", 120)}, ${clip(data.detail ?? "", 280)})`;
      return { ok: true as const };
    } catch {
      return { ok: true as const };
    }
  });
