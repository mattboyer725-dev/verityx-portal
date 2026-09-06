import { getSql } from "@/lib/db";
import { PILOT_PRICE_USD, PILOT_SLA_HOURS, RULE_VERSION } from "./constants";
import { iso, newId, slugify } from "./format";
import { rateLimit } from "./rate-limit";
import type { Role, Workspace } from "./types";

export type Actor = {
  userId: string;
  organizationId: string;
  role: Role;
  orgName: string;
  orgSlug: string;
  orgCreatedAt: string;
  requestId: string;
};

const SENSITIVE = /password|token|secret|authorization|cookie|signature|card/i;

export function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE.test(k)) out[k] = "[redacted]";
    else out[k] = v;
  }
  return out;
}

export function logEvent(
  actor: Pick<Actor, "userId" | "organizationId" | "requestId">,
  action: string,
  extra?: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({
      level: "info",
      ts: new Date().toISOString(),
      request_id: actor.requestId,
      organization_id: actor.organizationId,
      user_id: actor.userId,
      action,
      ...redact(extra ?? {}),
    }),
  );
}

export async function ensureActor(userId: string): Promise<Actor> {
  const sql = await getSql();
  const requestId = newId();
  const existing = await sql<{
    organization_id: string;
    role: Role;
    name: string;
    slug: string;
    created_at: unknown;
  }>`
    select m.organization_id, m.role, o.name, o.slug, o.created_at
    from memberships m
    join organizations o on o.id = m.organization_id
    where m.user_id = ${userId}
    limit 1
  `;
  if (existing[0]) {
    return {
      userId,
      organizationId: existing[0].organization_id,
      role: existing[0].role,
      orgName: existing[0].name,
      orgSlug: existing[0].slug,
      orgCreatedAt: iso(existing[0].created_at),
      requestId,
    };
  }

  const users = await sql<{ name: string; email: string }>`
    select name, email from "user" where id = ${userId} limit 1
  `;
  const display =
    users[0]?.name?.trim() ||
    users[0]?.email?.split("@")[0] ||
    "Workspace";
  const orgName = `${display} · Verityx`;
  const orgId = newId();
  const memberId = newId();
  const slug = slugify(display);
  const createdAt = new Date().toISOString();

  await sql`
    insert into organizations (id, name, slug)
    values (${orgId}, ${orgName}, ${slug})
  `;
  await sql`
    insert into memberships (id, organization_id, user_id, role)
    values (${memberId}, ${orgId}, ${userId}, ${"founder"})
  `;
  await sql`
    insert into audit_logs (
      id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json, request_id
    ) values (
      ${newId()}, ${orgId}, ${userId}, ${"org.create"}, ${"organization"}, ${orgId},
      ${JSON.stringify({ name: orgName })}, ${requestId}
    )
  `;

  return {
    userId,
    organizationId: orgId,
    role: "founder",
    orgName,
    orgSlug: slug,
    orgCreatedAt: createdAt,
    requestId,
  };
}

export async function writeAudit(
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const sql = await getSql();
  await sql`
    insert into audit_logs (
      id, organization_id, actor_user_id, action, entity_type, entity_id, metadata_json, request_id
    ) values (
      ${newId()},
      ${actor.organizationId},
      ${actor.userId},
      ${action},
      ${entityType},
      ${entityId},
      ${JSON.stringify(redact(metadata))},
      ${actor.requestId}
    )
  `;
  logEvent(actor, action, { entity_type: entityType, entity_id: entityId });
}

export async function mutateGuard(actor: Actor, action: string) {
  rateLimit(actor.userId, action);
}

export function toWorkspace(actor: Actor): Workspace {
  return {
    userId: actor.userId,
    role: actor.role,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    ruleVersion: RULE_VERSION,
    organization: {
      id: actor.organizationId,
      name: actor.orgName,
      slug: actor.orgSlug,
      createdAt: actor.orgCreatedAt,
    },
  };
}

export { PILOT_PRICE_USD, PILOT_SLA_HOURS, iso };
