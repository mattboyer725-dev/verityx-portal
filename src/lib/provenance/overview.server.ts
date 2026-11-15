/**
 * Workspace overview: what needs attention first, for a supplier or a buyer.
 */
import { getSql } from "@/lib/db";
import { ensureActor } from "@/lib/verityx/actor";
import { getPortfolio } from "./portfolio.server";
import { orgBilling, orgUsage } from "./billing.server";
import { limitsFor } from "./plans";

export async function getOverview(userId: string) {
  const actor = await ensureActor(userId);
  const sql = await getSql();
  const [portfolio, billing, usage, passportRows, recent] = await Promise.all([
    getPortfolio(userId, {}),
    orgBilling(actor.organizationId),
    orgUsage(actor.organizationId),
    sql`select status, count(*)::int as n from lot_passports where organization_id = ${actor.organizationId} group by status`,
    sql`
      select id, code, lot_ref, material, status, updated_at from lot_passports
      where organization_id = ${actor.organizationId} order by updated_at desc limit 5
    `,
  ]);
  const passports = { draft: 0, sealed: 0, revoked: 0 } as Record<"draft" | "sealed" | "revoked", number>;
  for (const r of passportRows) {
    const k = String(r.status) as keyof typeof passports;
    if (k in passports) passports[k] = Number(r.n ?? 0);
  }
  return {
    organization: actor.orgName,
    role: actor.role,
    portfolio: {
      summary: portfolio.summary,
      changed: portfolio.rows.filter((r) => r.changed).slice(0, 5),
      attention: portfolio.rows.filter((r) => !r.changed && r.state !== "declared-clear").slice(0, 5),
      programs: portfolio.programs.length,
    },
    passports: {
      ...passports,
      recent: recent.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        lotRef: String(r.lot_ref ?? ""),
        material: String(r.material),
        status: String(r.status),
      })),
    },
    billing,
    usage,
    limits: limitsFor(billing),
  };
}
