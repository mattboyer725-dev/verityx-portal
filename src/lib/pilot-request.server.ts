/**
 * Store a public pilot request, drop it into the owner's pipeline as a lead,
 * and (when an email key is configured) notify the owner. Server-only.
 *
 * Never loses a request: the row is written first; the pipeline lead and the
 * email are best-effort on top and recorded on the row.
 */
import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { OWNER_EMAIL } from "@/lib/admin";
import { newId } from "@/lib/verityx/format";
import { parsePilotRequest, prospectNote, type PilotRequest } from "@/lib/pilot-request";

const PER_CLIENT_PER_HOUR = 5;
const PER_DAY_TOTAL = 200;

function clientHash(): string {
  let ip = "unknown";
  try {
    const h = getRequest().headers;
    ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  } catch {
    /* no request context */
  }
  // The raw address is never stored: a per-day hash is enough to rate-limit.
  return createHash("sha256").update(`${ip}|${new Date().toISOString().slice(0, 10)}`).digest("hex").slice(0, 32);
}

async function addToOwnerPipeline(r: PilotRequest, requestId: string): Promise<string | null> {
  const ownerId = (process.env.OWNER_USER_ID ?? "").trim();
  if (!ownerId) return null;
  const sql = await getSql();
  const m = await sql<{ organization_id: string }>`
    select organization_id from memberships where user_id = ${ownerId} order by created_at asc limit 1`;
  if (!m[0]) return null;
  const id = newId();
  await sql`
    insert into prospects (id, organization_id, user_id, company_name, contact_name, contact_email, sector, stage, notes)
    values (${id}, ${m[0].organization_id}, ${ownerId}, ${r.company}, ${r.name}, ${r.email}, ${r.commodity}, ${"lead"},
            ${prospectNote(r, requestId)})`;
  return id;
}

async function notifyOwner(r: PilotRequest, requestId: string): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM?.trim() || "VerityX <onboarding@resend.dev>",
      to: [process.env.NOTIFY_TO?.trim() || OWNER_EMAIL],
      reply_to: r.email,
      subject: `Pilot request: ${r.company} (${r.commodity}, ${r.poBand})`,
      text: `${prospectNote(r, requestId)}\n\nReply to this email to answer ${r.name} directly.`,
    }),
    signal: AbortSignal.timeout(5000),
  });
  return res.ok;
}

export async function submitPilotRequest(raw: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = parsePilotRequest(raw);
  if (!parsed.ok) return parsed;
  const id = `PR-${newId().slice(0, 8).toUpperCase()}`;
  if (parsed.bot) return { ok: true, id }; // honeypot: look accepted, store nothing

  const sql = await getSql();
  const hash = clientHash();
  const [recent] = await sql<{ mine: number; today: number }>`
    select
      count(*) filter (where client_hash = ${hash} and created_at > now() - interval '1 hour')::int as mine,
      count(*) filter (where created_at > now() - interval '1 day')::int as today
    from pilot_requests`;
  if ((recent?.mine ?? 0) >= PER_CLIENT_PER_HOUR) return { ok: false, error: "Too many requests from this connection. Try again in an hour." };
  if ((recent?.today ?? 0) >= PER_DAY_TOTAL) return { ok: false, error: "Requests are paused for today. Please try again tomorrow." };

  const r = parsed.value;
  await sql`
    insert into pilot_requests (id, name, email, company, role, commodity, po_band, message, client_hash)
    values (${id}, ${r.name}, ${r.email}, ${r.company}, ${r.role}, ${r.commodity}, ${r.poBand}, ${r.message}, ${hash})`;

  const [prospectId, notified] = await Promise.all([
    addToOwnerPipeline(r, id).catch(() => null),
    notifyOwner(r, id).catch(() => false),
  ]);
  await sql`update pilot_requests set prospect_id = ${prospectId}, notified = ${notified} where id = ${id}`.catch(() => undefined);
  return { ok: true, id };
}

/** Owner-only list for the workspace (requests that arrived before the pipeline existed included). */
export async function listPilotRequests(limit = 50) {
  const sql = await getSql();
  return sql<{
    id: string;
    name: string;
    email: string;
    company: string;
    commodity: string;
    po_band: string;
    status: string;
    prospect_id: string | null;
    notified: boolean;
    created_at: string;
  }>`select id, name, email, company, commodity, po_band, status, prospect_id, notified, created_at::text
     from pilot_requests order by created_at desc limit ${limit}`;
}
