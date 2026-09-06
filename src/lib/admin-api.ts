import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { AGENTS, BUYER, SCENARIOS, consensusAgent, money, type Scenario } from "@/lib/engine";
import {
  ADMIN_ROLES,
  CONSOLE_ROLES,
  OWNER_EMAIL,
  can,
  isOwnerIdentity,
  permissionsFor,
  presenceOf,
  type AdminPerm,
  type AdminRole,
  type Presence,
} from "@/lib/admin";

export type AdminActor = {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  status: "active" | "suspended";
  allowed: boolean;
  reason: string;
  permissions: AdminPerm[];
};

export type IdentityRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  role: AdminRole;
  status: string;
  lastSeenAt: string | null;
  notes: string;
  presence: Presence;
  sessionCount: number;
};

export type SeatRow = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  title: string;
  plant: string;
  role: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
  presence: Presence;
};

export type SessionRow = {
  id: string;
  userId: string;
  email: string;
  name: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: string;
  createdAt: string;
};

export type AgentRow = {
  id: string;
  role: string;
  status: string;
  latencyMs: number;
  lastBeat: string;
  notes: string;
};

export type PolicyRow = {
  key: string;
  label: string;
  value: string;
  unit: string;
  description: string;
  updatedAt: string;
  updatedBy: string;
};

export type AlertRow = {
  id: string;
  severity: string;
  source: string;
  title: string;
  detail: string;
  status: string;
  createdAt: string;
  ackedBy: string | null;
};

export type AuditRow = {
  id: number;
  actorId: string;
  actorEmail: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
};

export type FlagRow = {
  key: string;
  label: string;
  enabled: boolean;
  description: string;
  updatedAt: string;
};

export type BookRow = {
  id: string;
  po: string;
  title: string;
  desk: Scenario["desk"];
  supplier: string;
  plant: string;
  buyer: string;
  proposed: number;
  market: number;
  proposedLabel: string;
  marketLabel: string;
  confidence: number;
  hold: boolean;
  due: string;
};

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plants: string;
  seatsLicensed: number;
  status: string;
};

export type InviteRow = {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  name: string;
  title: string;
  invitedBy: string;
  status: string;
  createdAt: string;
};

export type OpsEventRow = {
  id: string;
  kind: string;
  actorEmail: string;
  actorName: string;
  target: string;
  detail: string;
  createdAt: string;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  role: string;
  status: string;
  lastUsedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type WebhookRow = {
  id: string;
  url: string;
  event: string;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type SecurityState = {
  requireVerified: boolean;
  maintenance: boolean;
  announce: string;
  sessionDays: string;
};

export type AdminSnapshot = {
  ok: true;
  actor: AdminActor;
  frozen: boolean;
  ownerEmail: string;
  generatedAt: string;
  security: SecurityState;
  tenants: TenantRow[];
  seats: SeatRow[];
  identities: IdentityRow[];
  sessions: SessionRow[];
  agents: AgentRow[];
  policies: PolicyRow[];
  alerts: AlertRow[];
  audit: AuditRow[];
  flags: FlagRow[];
  invites: InviteRow[];
  book: BookRow[];
  activity: OpsEventRow[];
  keys: ApiKeyRow[];
  webhooks: WebhookRow[];
  kpis: {
    pos: number;
    hold: number;
    release: number;
    seats: number;
    seatsActive: number;
    identities: number;
    sessions: number;
    alertsOpen: number;
    agentsHealthy: number;
    agentsTotal: number;
    overpay: string;
    online: number;
    idle: number;
    pendingInvites: number;
    keysActive: number;
    verifies: number;
  };
};

export type AdminDenied = {
  ok: false;
  actor: AdminActor;
};

export type AdminState = AdminSnapshot | AdminDenied;

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = iso(v);
  return s || null;
}

function asRole(v: string): AdminRole {
  return (ADMIN_ROLES as string[]).includes(v) ? (v as AdminRole) : "viewer";
}

function clip(v: string, n: number) {
  return v.trim().slice(0, n);
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function audit(
  sql: Sql,
  actor: Pick<AdminActor, "userId" | "email" | "name">,
  action: string,
  target: string,
  detail: string,
) {
  await sql`insert into admin_audit (actor_id, actor_email, action, target, detail)
    values (${actor.userId}, ${actor.email}, ${action}, ${target}, ${detail})`;
  await sql`insert into ops_events (id, kind, actor_email, actor_name, target, detail)
    values (${`ev-${crypto.randomUUID().slice(0, 10)}`}, ${`admin.${action.toLowerCase()}`}, ${actor.email}, ${actor.name || actor.email}, ${target}, ${detail})`;
}

async function settingMap(sql: Sql): Promise<Record<string, string>> {
  const rows = await sql<{ key: string; value: string }>`select key, value from admin_settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function resolveActor(sql: Sql, userId: string): Promise<AdminActor> {
  const users = await sql<{ id: string; name: string; email: string }>`
    select id, name, email from "user" where id = ${userId}`;
  const u = users[0];
  const email = u?.email ?? "";
  const name = u?.name ?? "";
  const owner = isOwnerIdentity(email, name);

  const existing = await sql<{ role: string; status: string }>`
    select role, status from admin_identities where user_id = ${userId}`;

  const invites = email
    ? await sql<{ role: string; status: string }>`
        select role, status from admin_invites
        where lower(email) = ${email.toLowerCase()} and status = 'pending'
        order by created_at desc limit 1`
    : [];

  let role: AdminRole = asRole(existing[0]?.role ?? "viewer");
  let status: "active" | "suspended" = existing[0]?.status === "suspended" ? "suspended" : "active";

  if (owner) {
    role = "owner";
    status = "active";
  } else if (!existing[0] && invites[0]) {
    role = asRole(invites[0].role);
    await sql`update admin_invites set status = 'accepted'
      where lower(email) = ${email.toLowerCase()} and status = 'pending'`;
  }

  if (u) {
    await sql`
      insert into admin_identities (user_id, email, name, role, status, last_seen_at)
      values (${userId}, ${email}, ${name}, ${role}, ${status}, now())
      on conflict (user_id) do update set
        email = excluded.email,
        name = excluded.name,
        last_seen_at = now(),
        role = ${role},
        status = ${status}`;
  }

  const settings = await settingMap(sql);
  const requireVerified = settings.require_verified === "true";
  const verifiedRows = u
    ? await sql<{ v: boolean }>`select "emailVerified" as v from "user" where id = ${userId}`
    : [];
  const verified = Boolean(verifiedRows[0]?.v);

  let allowed = status === "active" && CONSOLE_ROLES.includes(role);
  let reason = !u
    ? "No identity on file."
    : status === "suspended"
      ? "This identity is suspended."
      : allowed
        ? ""
        : `Role ${role} cannot enter platform command. Owner is ${OWNER_EMAIL}.`;

  if (allowed && requireVerified && !verified && !owner) {
    allowed = false;
    reason = "Email is not verified. Owner has required verified Google identities.";
  }

  return {
    userId,
    email,
    name,
    role,
    status,
    allowed,
    reason,
    permissions: allowed ? permissionsFor(role) : [],
  };
}

function requirePerm(actor: AdminActor, perm: AdminPerm) {
  if (!actor.allowed || !can(actor.role, perm)) {
    throw new Error(`Not permitted: ${perm}`);
  }
}

function bookFromScenarios(): BookRow[] {
  return SCENARIOS.map((s) => {
    const c = consensusAgent(s.observations);
    const anomaly = c.market ? ((s.proposed - c.market) / c.market) * 100 : 0;
    const hold = anomaly >= 8 || c.verdict !== "VERIFIED" || s.screens.exportPermit === "WATCH";
    return {
      id: s.id,
      po: s.po,
      title: s.title,
      desk: s.desk,
      supplier: s.supplier,
      plant: s.plant,
      buyer: s.buyer,
      proposed: s.proposed,
      market: Math.round(c.market),
      proposedLabel: money(s.proposed),
      marketLabel: money(c.market),
      confidence: Number(c.confidence.toFixed(3)),
      hold,
      due: s.due,
    };
  });
}

function readSecurity(settings: Record<string, string>): SecurityState {
  return {
    requireVerified: settings.require_verified === "true",
    maintenance: settings.maintenance === "true",
    announce: settings.announce ?? "",
    sessionDays: settings.session_days || "30",
  };
}

async function loadSnapshot(sql: Sql, actor: AdminActor): Promise<AdminSnapshot> {
  const [
    tenants,
    seats,
    identities,
    sessions,
    agents,
    policies,
    alerts,
    auditRows,
    flags,
    invites,
    settings,
    activity,
    keys,
    webhooks,
  ] = await Promise.all([
    sql<{ id: string; name: string; slug: string; plants: string; seats_licensed: number; status: string }>`
      select id, name, slug, plants, seats_licensed, status from tenant_orgs order by name`,
    sql<{
      id: string;
      tenant_id: string;
      name: string;
      email: string;
      title: string;
      plant: string;
      role: string;
      status: string;
      last_seen_at: unknown;
      created_at: unknown;
    }>`select id, tenant_id, name, email, title, plant, role, status, last_seen_at, created_at
       from tenant_seats order by name`,
    sql<{
      id: string;
      name: string;
      email: string;
      email_verified: boolean;
      image: string | null;
      created_at: unknown;
      role: string | null;
      status: string | null;
      last_seen_at: unknown;
      notes: string | null;
    }>`select u.id, u.name, u.email, u."emailVerified" as email_verified, u.image,
              u."createdAt" as created_at,
              i.role, i.status, i.last_seen_at, i.notes
       from "user" u
       left join admin_identities i on i.user_id = u.id
       order by u."createdAt" desc`,
    sql<{
      id: string;
      user_id: string;
      email: string;
      name: string;
      ip: string | null;
      user_agent: string | null;
      expires_at: unknown;
      created_at: unknown;
    }>`select s.id, s."userId" as user_id, u.email, u.name,
              s."ipAddress" as ip, s."userAgent" as user_agent,
              s."expiresAt" as expires_at, s."createdAt" as created_at
       from "session" s
       join "user" u on u.id = s."userId"
       order by s."createdAt" desc`,
    sql<{
      id: string;
      role: string;
      status: string;
      latency_ms: number;
      last_beat: unknown;
      notes: string;
    }>`select id, role, status, latency_ms, last_beat, notes from agent_nodes order by id`,
    sql<{
      key: string;
      label: string;
      value: string;
      unit: string;
      description: string;
      updated_at: unknown;
      updated_by: string;
    }>`select key, label, value, unit, description, updated_at, updated_by from admin_policies order by label`,
    sql<{
      id: string;
      severity: string;
      source: string;
      title: string;
      detail: string;
      status: string;
      created_at: unknown;
      acked_by: string | null;
    }>`select id, severity, source, title, detail, status, created_at, acked_by
       from admin_alerts
       order by case severity when 'critical' then 0 when 'high' then 1 when 'med' then 2 else 3 end,
                created_at desc`,
    sql<{
      id: number;
      actor_id: string;
      actor_email: string;
      action: string;
      target: string;
      detail: string;
      created_at: unknown;
    }>`select id, actor_id, actor_email, action, target, detail, created_at
       from admin_audit order by created_at desc, id desc limit 120`,
    sql<{
      key: string;
      label: string;
      enabled: boolean;
      description: string;
      updated_at: unknown;
    }>`select key, label, enabled, description, updated_at from feature_flags order by label`,
    sql<{
      id: string;
      email: string;
      role: string;
      tenant_id: string | null;
      name: string;
      title: string;
      invited_by: string;
      status: string;
      created_at: unknown;
    }>`select id, email, role, tenant_id, name, title, invited_by, status, created_at
       from admin_invites order by created_at desc`,
    sql<{ key: string; value: string }>`select key, value from admin_settings`,
    sql<{
      id: string;
      kind: string;
      actor_email: string;
      actor_name: string;
      target: string;
      detail: string;
      created_at: unknown;
    }>`select id, kind, actor_email, actor_name, target, detail, created_at
       from ops_events order by created_at desc limit 80`,
    sql<{
      id: string;
      name: string;
      prefix: string;
      role: string;
      status: string;
      last_used_at: unknown;
      created_by: string;
      created_at: unknown;
    }>`select id, name, prefix, role, status, last_used_at, created_by, created_at
       from admin_api_keys order by created_at desc`,
    sql<{
      id: string;
      url: string;
      event: string;
      status: string;
      created_by: string;
      created_at: unknown;
    }>`select id, url, event, status, created_by, created_at from admin_webhooks order by created_at desc`,
  ]);

  const book = bookFromScenarios();
  const hold = book.filter((b) => b.hold).length;
  const overpay = book.reduce((a, b) => a + Math.max(0, b.proposed - b.market), 0);
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const frozen = map.desk_frozen === "true";
  const security = readSecurity(map);
  const now = Date.now();
  const sessionCounts = new Map<string, number>();
  for (const s of sessions) {
    sessionCounts.set(s.user_id, (sessionCounts.get(s.user_id) ?? 0) + 1);
  }

  const agentRows: AgentRow[] =
    agents.length > 0
      ? agents.map((a) => ({
          id: a.id,
          role: a.role,
          status: a.status,
          latencyMs: Number(a.latency_ms),
          lastBeat: iso(a.last_beat),
          notes: a.notes,
        }))
      : AGENTS.map((a) => ({
          id: a.id,
          role: a.role,
          status: "healthy",
          latencyMs: 12,
          lastBeat: new Date().toISOString(),
          notes: "",
        }));

  const identityRows: IdentityRow[] = identities.map((i) => {
    const lastSeenAt = isoOrNull(i.last_seen_at);
    return {
      id: i.id,
      name: i.name,
      email: i.email,
      emailVerified: Boolean(i.email_verified),
      image: i.image,
      createdAt: iso(i.created_at),
      role: asRole(i.role ?? "viewer"),
      status: i.status ?? "active",
      lastSeenAt,
      notes: i.notes ?? "",
      presence: presenceOf(lastSeenAt, now),
      sessionCount: sessionCounts.get(i.id) ?? 0,
    };
  });

  const seatRows: SeatRow[] = seats.map((s) => {
    const lastSeenAt = isoOrNull(s.last_seen_at);
    return {
      id: s.id,
      tenantId: s.tenant_id,
      name: s.name,
      email: s.email,
      title: s.title,
      plant: s.plant,
      role: s.role,
      status: s.status,
      lastSeenAt,
      createdAt: iso(s.created_at),
      presence: presenceOf(lastSeenAt, now),
    };
  });

  const activityRows: OpsEventRow[] = activity.map((e) => ({
    id: e.id,
    kind: e.kind,
    actorEmail: e.actor_email,
    actorName: e.actor_name,
    target: e.target,
    detail: e.detail,
    createdAt: iso(e.created_at),
  }));

  const online = identityRows.filter((i) => i.presence === "online").length + seatRows.filter((s) => s.presence === "online").length;
  const idle = identityRows.filter((i) => i.presence === "idle").length + seatRows.filter((s) => s.presence === "idle").length;

  return {
    ok: true,
    actor,
    frozen,
    ownerEmail: OWNER_EMAIL,
    generatedAt: new Date().toISOString(),
    security,
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plants: t.plants,
      seatsLicensed: Number(t.seats_licensed),
      status: t.status,
    })),
    seats: seatRows,
    identities: identityRows,
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.user_id,
      email: s.email,
      name: s.name,
      ip: s.ip,
      userAgent: s.user_agent,
      expiresAt: iso(s.expires_at),
      createdAt: iso(s.created_at),
    })),
    agents: agentRows,
    policies: policies.map((p) => ({
      key: p.key,
      label: p.label,
      value: p.value,
      unit: p.unit,
      description: p.description,
      updatedAt: iso(p.updated_at),
      updatedBy: p.updated_by,
    })),
    alerts: alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      source: a.source,
      title: a.title,
      detail: a.detail,
      status: a.status,
      createdAt: iso(a.created_at),
      ackedBy: a.acked_by,
    })),
    audit: auditRows.map((a) => ({
      id: Number(a.id),
      actorId: a.actor_id,
      actorEmail: a.actor_email,
      action: a.action,
      target: a.target,
      detail: a.detail,
      createdAt: iso(a.created_at),
    })),
    flags: flags.map((f) => ({
      key: f.key,
      label: f.label,
      enabled: Boolean(f.enabled),
      description: f.description,
      updatedAt: iso(f.updated_at),
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      tenantId: i.tenant_id,
      name: i.name,
      title: i.title,
      invitedBy: i.invited_by,
      status: i.status,
      createdAt: iso(i.created_at),
    })),
    book,
    activity: activityRows,
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      role: k.role,
      status: k.status,
      lastUsedAt: isoOrNull(k.last_used_at),
      createdBy: k.created_by,
      createdAt: iso(k.created_at),
    })),
    webhooks: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      event: w.event,
      status: w.status,
      createdBy: w.created_by,
      createdAt: iso(w.created_at),
    })),
    kpis: {
      pos: book.length,
      hold,
      release: book.length - hold,
      seats: seats.length,
      seatsActive: seats.filter((s) => s.status === "active").length,
      identities: identities.length,
      sessions: sessions.length,
      alertsOpen: alerts.filter((a) => a.status === "open").length,
      agentsHealthy: agentRows.filter((a) => a.status === "healthy").length,
      agentsTotal: agentRows.length,
      overpay: money(overpay),
      online,
      idle,
      pendingInvites: invites.filter((i) => i.status === "pending").length,
      keysActive: keys.filter((k) => k.status === "active").length,
      verifies: activityRows.filter((e) => e.kind === "desk.verify").length,
    },
  };
}

export { getDeskControls, recordDeskEvent } from "@/lib/desk-ops";

export const getAdminState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminState> => {
    const sql = await getSql();
    const actor = await resolveActor(sql, context.userId);
    if (!actor.allowed) return { ok: false, actor };
    return loadSnapshot(sql, actor);
  });

const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("seat.status"),
    id: z.string().min(1),
    status: z.enum(["active", "suspended"]),
  }),
  z.object({
    type: z.literal("seat.role"),
    id: z.string().min(1),
    role: z.string().min(1),
  }),
  z.object({
    type: z.literal("seat.invite"),
    email: z.email(),
    name: z.string().min(1),
    title: z.string().min(1),
    role: z.string().min(1),
    plant: z.string().optional(),
  }),
  z.object({ type: z.literal("seat.remove"), id: z.string().min(1) }),
  z.object({ type: z.literal("invite.revoke"), id: z.string().min(1) }),
  z.object({
    type: z.literal("identity.role"),
    userId: z.string().min(1),
    role: z.string().min(1),
  }),
  z.object({
    type: z.literal("identity.status"),
    userId: z.string().min(1),
    status: z.enum(["active", "suspended"]),
  }),
  z.object({
    type: z.literal("identity.note"),
    userId: z.string().min(1),
    notes: z.string().max(400),
  }),
  z.object({ type: z.literal("session.revoke"), id: z.string().min(1) }),
  z.object({ type: z.literal("session.revokeAll"), userId: z.string().min(1) }),
  z.object({
    type: z.literal("alert.set"),
    id: z.string().min(1),
    status: z.enum(["open", "ack", "closed"]),
  }),
  z.object({ type: z.literal("policy.set"), key: z.string().min(1), value: z.string().min(1) }),
  z.object({ type: z.literal("flag.toggle"), key: z.string().min(1), enabled: z.boolean() }),
  z.object({
    type: z.literal("agent.status"),
    id: z.string().min(1),
    status: z.enum(["healthy", "degraded", "down", "restarted"]),
  }),
  z.object({ type: z.literal("desk.freeze"), frozen: z.boolean() }),
  z.object({
    type: z.literal("security.set"),
    key: z.enum(["require_verified", "maintenance", "announce", "session_days"]),
    value: z.string().max(280),
  }),
  z.object({
    type: z.literal("tenant.seats"),
    id: z.string().min(1),
    seatsLicensed: z.number().int().min(1).max(500),
  }),
  z.object({ type: z.literal("key.revoke"), id: z.string().min(1) }),
  z.object({
    type: z.literal("webhook.create"),
    url: z.url(),
    event: z.string().min(1),
  }),
  z.object({ type: z.literal("webhook.revoke"), id: z.string().min(1) }),
  z.object({
    type: z.literal("backup.restore"),
    payload: z.string().min(2).max(400_000),
  }),
]);

export type AdminAction = z.infer<typeof ActionSchema>;

async function upsertSetting(sql: Sql, key: string, value: string) {
  await sql`insert into admin_settings (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value`;
}

export const runAdminAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => ActionSchema.parse(data))
  .handler(async ({ context, data }): Promise<AdminState> => {
    const sql = await getSql();
    const actor = await resolveActor(sql, context.userId);
    if (!actor.allowed) return { ok: false, actor };

    switch (data.type) {
      case "seat.status": {
        requirePerm(actor, "users.suspend");
        await sql`update tenant_seats set status = ${data.status} where id = ${data.id}`;
        await audit(sql, actor, "SEAT.STATUS", data.id, data.status);
        break;
      }
      case "seat.role": {
        requirePerm(actor, "users.write");
        await sql`update tenant_seats set role = ${data.role} where id = ${data.id}`;
        await audit(sql, actor, "SEAT.ROLE", data.id, data.role);
        break;
      }
      case "seat.invite": {
        requirePerm(actor, "users.write");
        const id = `seat-${crypto.randomUUID().slice(0, 8)}`;
        const inviteId = `inv-${crypto.randomUUID().slice(0, 8)}`;
        const plant = data.plant ?? "";
        const email = data.email.trim().toLowerCase();
        await sql`insert into tenant_seats (id, tenant_id, name, email, title, plant, role, status)
          values (${id}, 'SIEMENS-GAMESA', ${data.name}, ${email}, ${data.title}, ${plant}, ${data.role}, 'invited')`;
        await sql`insert into admin_invites (id, email, role, tenant_id, name, title, invited_by, status)
          values (${inviteId}, ${email}, ${data.role}, 'SIEMENS-GAMESA', ${data.name}, ${data.title}, ${actor.email}, 'pending')`;
        await audit(sql, actor, "SEAT.INVITE", email, `${data.role} · ${data.name}`);
        break;
      }
      case "seat.remove": {
        requirePerm(actor, "users.write");
        const rows = await sql<{ status: string; email: string }>`select status, email from tenant_seats where id = ${data.id}`;
        if (!rows[0]) throw new Error("Seat not found.");
        if (rows[0].status === "active") throw new Error("Suspend the seat before removing it.");
        await sql`delete from tenant_seats where id = ${data.id}`;
        await audit(sql, actor, "SEAT.REMOVE", data.id, rows[0].email);
        break;
      }
      case "invite.revoke": {
        requirePerm(actor, "users.write");
        await sql`update admin_invites set status = 'revoked' where id = ${data.id} and status = 'pending'`;
        await audit(sql, actor, "INVITE.REVOKE", data.id, "revoked");
        break;
      }
      case "identity.role": {
        requirePerm(actor, "identities.write");
        if (data.userId === actor.userId && actor.role === "owner") {
          throw new Error("Owner cannot demote their own identity.");
        }
        const next = asRole(data.role);
        await sql`update admin_identities set role = ${next} where user_id = ${data.userId}`;
        await audit(sql, actor, "IDENTITY.ROLE", data.userId, next);
        break;
      }
      case "identity.status": {
        requirePerm(actor, "users.suspend");
        if (data.userId === actor.userId) {
          throw new Error("You cannot suspend your own identity.");
        }
        await sql`update admin_identities set status = ${data.status} where user_id = ${data.userId}`;
        await audit(sql, actor, "IDENTITY.STATUS", data.userId, data.status);
        break;
      }
      case "identity.note": {
        requirePerm(actor, "identities.write");
        await sql`update admin_identities set notes = ${clip(data.notes, 400)} where user_id = ${data.userId}`;
        await audit(sql, actor, "IDENTITY.NOTE", data.userId, "updated");
        break;
      }
      case "session.revoke": {
        requirePerm(actor, "sessions.revoke");
        await sql`delete from "session" where id = ${data.id}`;
        await audit(sql, actor, "SESSION.REVOKE", data.id, "revoked");
        break;
      }
      case "session.revokeAll": {
        requirePerm(actor, "sessions.revoke");
        if (data.userId === actor.userId) {
          throw new Error("Revoke other sessions individually — do not wipe your own seat.");
        }
        await sql`delete from "session" where "userId" = ${data.userId}`;
        await audit(sql, actor, "SESSION.REVOKE_ALL", data.userId, "all sessions");
        break;
      }
      case "alert.set": {
        requirePerm(actor, "alerts.manage");
        const acked = data.status === "ack" || data.status === "closed" ? actor.email : null;
        await sql`update admin_alerts set status = ${data.status}, acked_by = ${acked} where id = ${data.id}`;
        await audit(sql, actor, "ALERT", data.id, data.status);
        break;
      }
      case "policy.set": {
        requirePerm(actor, "policies.write");
        await sql`update admin_policies set value = ${data.value}, updated_at = now(), updated_by = ${actor.email} where key = ${data.key}`;
        await audit(sql, actor, "POLICY.SET", data.key, data.value);
        break;
      }
      case "flag.toggle": {
        requirePerm(actor, "flags.write");
        await sql`update feature_flags set enabled = ${data.enabled}, updated_at = now() where key = ${data.key}`;
        await audit(sql, actor, "FLAG", data.key, data.enabled ? "on" : "off");
        break;
      }
      case "agent.status": {
        requirePerm(actor, "agents.control");
        await sql`update agent_nodes set status = ${data.status}, last_beat = now() where id = ${data.id}`;
        await audit(sql, actor, "AGENT", data.id, data.status);
        break;
      }
      case "desk.freeze": {
        requirePerm(actor, "desk.freeze");
        await upsertSetting(sql, "desk_frozen", data.frozen ? "true" : "false");
        await audit(sql, actor, "DESK.FREEZE", "desk", data.frozen ? "true" : "false");
        break;
      }
      case "security.set": {
        requirePerm(actor, "security.write");
        await upsertSetting(sql, data.key, clip(data.value, 280));
        await audit(sql, actor, "SECURITY", data.key, clip(data.value, 80));
        break;
      }
      case "tenant.seats": {
        requirePerm(actor, "tenants.write");
        await sql`update tenant_orgs set seats_licensed = ${data.seatsLicensed} where id = ${data.id}`;
        await audit(sql, actor, "TENANT.SEATS", data.id, String(data.seatsLicensed));
        break;
      }
      case "key.revoke": {
        requirePerm(actor, "keys.write");
        await sql`update admin_api_keys set status = 'revoked' where id = ${data.id}`;
        await audit(sql, actor, "KEY.REVOKE", data.id, "revoked");
        break;
      }
      case "webhook.create": {
        requirePerm(actor, "keys.write");
        const id = `wh-${crypto.randomUUID().slice(0, 8)}`;
        await sql`insert into admin_webhooks (id, url, event, status, created_by)
          values (${id}, ${data.url}, ${data.event}, 'active', ${actor.email})`;
        await audit(sql, actor, "WEBHOOK.CREATE", id, data.event);
        break;
      }
      case "webhook.revoke": {
        requirePerm(actor, "keys.write");
        await sql`update admin_webhooks set status = 'revoked' where id = ${data.id}`;
        await audit(sql, actor, "WEBHOOK.REVOKE", data.id, "revoked");
        break;
      }
      case "backup.restore": {
        requirePerm(actor, "backup.restore");
        let parsed: {
          frozen?: boolean;
          policies?: { key: string; value: string }[];
          flags?: { key: string; enabled: boolean }[];
          agents?: { id: string; status: string }[];
          security?: Partial<SecurityState>;
        };
        try {
          parsed = JSON.parse(data.payload) as typeof parsed;
        } catch {
          throw new Error("Backup file is not valid JSON.");
        }
        if (typeof parsed.frozen === "boolean") {
          await upsertSetting(sql, "desk_frozen", parsed.frozen ? "true" : "false");
        }
        if (parsed.security) {
          if (typeof parsed.security.requireVerified === "boolean") {
            await upsertSetting(sql, "require_verified", parsed.security.requireVerified ? "true" : "false");
          }
          if (typeof parsed.security.maintenance === "boolean") {
            await upsertSetting(sql, "maintenance", parsed.security.maintenance ? "true" : "false");
          }
          if (typeof parsed.security.announce === "string") {
            await upsertSetting(sql, "announce", clip(parsed.security.announce, 280));
          }
          if (typeof parsed.security.sessionDays === "string") {
            await upsertSetting(sql, "session_days", clip(parsed.security.sessionDays, 8));
          }
        }
        for (const p of parsed.policies ?? []) {
          if (p?.key && typeof p.value === "string") {
            await sql`update admin_policies set value = ${p.value}, updated_at = now(), updated_by = ${actor.email} where key = ${p.key}`;
          }
        }
        for (const f of parsed.flags ?? []) {
          if (f?.key && typeof f.enabled === "boolean") {
            await sql`update feature_flags set enabled = ${f.enabled}, updated_at = now() where key = ${f.key}`;
          }
        }
        for (const a of parsed.agents ?? []) {
          if (a?.id && ["healthy", "degraded", "down", "restarted"].includes(a.status)) {
            await sql`update agent_nodes set status = ${a.status}, last_beat = now() where id = ${a.id}`;
          }
        }
        await audit(sql, actor, "BACKUP.RESTORE", "command", "policies · flags · agents · security");
        break;
      }
      default:
        break;
    }

    return loadSnapshot(sql, actor);
  });

const KeyCreateSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.enum(["operator", "auditor", "viewer"]),
});

export const createAdminKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => KeyCreateSchema.parse(data))
  .handler(async ({ context, data }): Promise<{ secret: string; state: AdminState }> => {
    const sql = await getSql();
    const actor = await resolveActor(sql, context.userId);
    if (!actor.allowed) return { secret: "", state: { ok: false, actor } };
    requirePerm(actor, "keys.write");
    const raw = `vx_${randomHex(24)}`;
    const hash = await sha256hex(raw);
    const prefix = raw.slice(0, 11);
    const id = `key-${crypto.randomUUID().slice(0, 8)}`;
    await sql`insert into admin_api_keys (id, name, prefix, hash, role, status, created_by)
      values (${id}, ${data.name}, ${prefix}, ${hash}, ${data.role}, 'active', ${actor.email})`;
    await audit(sql, actor, "KEY.CREATE", id, `${data.name} · ${data.role}`);
    return { secret: raw, state: await loadSnapshot(sql, actor) };
  });
