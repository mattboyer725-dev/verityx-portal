/**
 * Buyer portfolio storage, live status and sealed evidence packs. Every query
 * is scoped to the caller's organization. Passports are resolved through the
 * public chain reader (sealed or revoked only, exact code).
 */
import { getSql } from "@/lib/db";
import { newId, iso } from "@/lib/verityx/format";
import { assertCan } from "@/lib/verityx/rbac";
import { ensureActor, mutateGuard, writeAudit } from "@/lib/verityx/actor";
import { analyze, ledgerSeal, loadPublishedChain } from "./passport.server";
import {
  canonicalPack,
  isChanged,
  itemState,
  MAX_IMPORT_ROWS,
  normalizeItem,
  PACK_STATEMENT,
  PACK_VERSION,
  parsePortfolioCsv,
  sortRows,
  summarize,
  toPackItem,
  STATE_ORDER,
  type EvidencePackBody,
  type ItemState,
  type PortfolioItemInput,
  type PortfolioRow,
  type ResolvedLot,
} from "./portfolio";
import { sha256Hex } from "./passport";

type Row = Record<string, unknown>;

function asState(v: unknown): ItemState | null {
  return typeof v === "string" && (STATE_ORDER as string[]).includes(v) ? (v as ItemState) : null;
}

async function resolveRows(rows: Row[]): Promise<PortfolioRow[]> {
  const codes = [...new Set(rows.map((r) => String(r.passport_code ?? "")).filter(Boolean))];
  const chain = codes.length ? await loadPublishedChain(codes) : new Map();
  return rows.map((r) => {
    const code = String(r.passport_code ?? "");
    const p = code ? chain.get(code) : undefined;
    const lot: ResolvedLot | null = p
      ? {
          code: p.code,
          publisher: p.publisher,
          lotRef: p.lotRef,
          material: p.material,
          status: p.status === "revoked" ? "revoked" : "sealed",
          digest: p.digest,
          sealedAt: p.sealedAt,
          revokedReason: p.revokedReason,
        }
      : null;
    const analysis = p ? analyze(p, chain) : null;
    const state = itemState(code, lot ?? undefined, analysis ?? undefined);
    const ackState = asState(r.ack_state);
    return {
      id: String(r.id),
      partNumber: String(r.part_number),
      description: String(r.description ?? ""),
      program: String(r.program ?? ""),
      supplier: String(r.supplier ?? ""),
      passportCode: code,
      state,
      ackState,
      changed: isChanged(state, ackState),
      lot,
      analysis,
    };
  });
}

export async function getPortfolio(userId: string, data: { program?: string }) {
  const actor = await ensureActor(userId);
  const sql = await getSql();
  const rows = await sql`
    select * from portfolio_items where organization_id = ${actor.organizationId}
    order by program, part_number limit 5000
  `;
  const resolved = await resolveRows(rows);
  // First sight of a part sets its baseline silently, so only later changes alert.
  const unseen = resolved.filter((r) => r.ackState === null);
  if (unseen.length) {
    for (const r of unseen) {
      await sql`
        update portfolio_items set ack_state = ${r.state}, ack_at = now()
        where id = ${r.id} and organization_id = ${actor.organizationId} and ack_state is null
      `;
      r.ackState = r.state;
    }
  }
  const programs = [...new Set(resolved.map((r) => r.program).filter(Boolean))].sort();
  const filtered = data.program ? resolved.filter((r) => r.program === data.program) : resolved;
  const packs = await sql`
    select id, program, item_count, digest, ledger_hash, created_at from portfolio_packs
    where organization_id = ${actor.organizationId} order by created_at desc limit 20
  `;
  return {
    rows: sortRows(filtered),
    summary: summarize(filtered),
    programs,
    canWrite: actor.role !== "viewer",
    buyer: actor.orgName,
    packs: packs.map((p) => ({
      id: String(p.id),
      program: String(p.program ?? ""),
      itemCount: Number(p.item_count ?? 0),
      digest: String(p.digest),
      ledgerHash: p.ledger_hash ? String(p.ledger_hash) : null,
      createdAt: iso(p.created_at),
    })),
  };
}

async function upsert(orgId: string, userId: string, it: PortfolioItemInput) {
  const sql = await getSql();
  await sql`
    insert into portfolio_items (id, organization_id, part_number, description, program, supplier, passport_code, created_by)
    values (${newId()}, ${orgId}, ${it.partNumber}, ${it.description}, ${it.program}, ${it.supplier}, ${it.passportCode}, ${userId})
    on conflict (organization_id, part_number, passport_code) do update set
      description = excluded.description, program = excluded.program, supplier = excluded.supplier, updated_at = now()
  `;
}

export async function importPortfolio(userId: string, data: { csv: string }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "portfolio.write");
  await mutateGuard(actor, "portfolio.write");
  if (typeof data.csv !== "string" || data.csv.length > 2_000_000) throw new Error("The file is too large (2 MB max).");
  const parsed = parsePortfolioCsv(data.csv);
  if (!parsed.items.length) throw new Error(parsed.errors[0] ?? "No parts found in the file.");
  const { assertPortfolioFits } = await import("./billing.server");
  await assertPortfolioFits(actor.organizationId, parsed.items.slice(0, MAX_IMPORT_ROWS));
  for (const it of parsed.items.slice(0, MAX_IMPORT_ROWS)) await upsert(actor.organizationId, actor.userId, it);
  await writeAudit(actor, "portfolio.import", "portfolio", actor.organizationId, { rows: parsed.items.length, errors: parsed.errors.length });
  return { imported: parsed.items.length, errors: parsed.errors.slice(0, 50) };
}

export async function addPortfolioItem(userId: string, data: { item: unknown }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "portfolio.write");
  await mutateGuard(actor, "portfolio.write");
  const it = normalizeItem((data.item ?? {}) as Partial<Record<keyof PortfolioItemInput, unknown>>);
  const { assertPortfolioFits } = await import("./billing.server");
  await assertPortfolioFits(actor.organizationId, [it]);
  await upsert(actor.organizationId, actor.userId, it);
  await writeAudit(actor, "portfolio.add", "portfolio", actor.organizationId, { part: it.partNumber, code: it.passportCode });
  return { ok: true as const };
}

export async function removePortfolioItems(userId: string, data: { ids: string[] }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "portfolio.write");
  await mutateGuard(actor, "portfolio.write");
  const ids = (Array.isArray(data.ids) ? data.ids : []).filter((x) => typeof x === "string").slice(0, 500);
  if (!ids.length) return { removed: 0 };
  const sql = await getSql();
  const rows = await sql`
    delete from portfolio_items where organization_id = ${actor.organizationId} and id = any(${ids}) returning id
  `;
  await writeAudit(actor, "portfolio.remove", "portfolio", actor.organizationId, { removed: rows.length });
  return { removed: rows.length };
}

/** Mark the current state of these parts as reviewed, clearing their alerts. */
export async function acknowledgeItems(userId: string, data: { ids: string[] }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "portfolio.write");
  const ids = (Array.isArray(data.ids) ? data.ids : []).filter((x) => typeof x === "string").slice(0, 500);
  if (!ids.length) return { acknowledged: 0 };
  const sql = await getSql();
  const rows = await sql`select * from portfolio_items where organization_id = ${actor.organizationId} and id = any(${ids})`;
  const resolved = await resolveRows(rows);
  for (const r of resolved) {
    await sql`update portfolio_items set ack_state = ${r.state}, ack_at = now() where id = ${r.id} and organization_id = ${actor.organizationId}`;
  }
  await writeAudit(actor, "portfolio.acknowledge", "portfolio", actor.organizationId, {
    items: resolved.map((r) => ({ part: r.partNumber, state: r.state })),
  });
  return { acknowledged: resolved.length };
}

/**
 * Build an evidence pack for one program (or all parts), seal its digest on
 * the ledger, and return the JSON (with its receipt) and a PDF of the same data.
 */
export async function generatePack(userId: string, data: { program?: string }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "portfolio.write");
  await mutateGuard(actor, "portfolio.write");
  const sql = await getSql();
  const all = await sql`select * from portfolio_items where organization_id = ${actor.organizationId} order by program, part_number limit 5000`;
  const program = typeof data.program === "string" ? data.program.slice(0, 80) : "";
  const rows = await resolveRows(program ? all.filter((r) => String(r.program ?? "") === program) : all);
  if (!rows.length) throw new Error("There are no parts to put in a pack.");
  const { assertCanPack } = await import("./billing.server");
  await assertCanPack(actor.organizationId);
  const sorted = sortRows(rows.map((r) => ({ ...r, changed: false })));
  const codes = new Set<string>();
  for (const r of sorted) for (const s of r.analysis?.stages ?? []) for (const src of s.sources) codes.add(src.code);
  for (const r of sorted) if (r.passportCode) codes.add(r.passportCode);
  const chain = await loadPublishedChain([...codes]);
  const body: EvidencePackBody = {
    version: PACK_VERSION,
    buyer: actor.orgName,
    program,
    generatedAt: new Date().toISOString(),
    summary: summarize(sorted),
    items: sorted.map(toPackItem),
    passports: [...codes]
      .sort()
      .map((c) => chain.get(c))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ code: p.code, digest: p.digest, publisher: p.publisher, status: p.status })),
    statement: PACK_STATEMENT,
  };
  const canonical = canonicalPack(body);
  const digest = await sha256Hex(canonical);
  const { entry, receiptJson } = await ledgerSeal(actor, {
    title: `Evidence pack · ${actor.orgName}${program ? ` · ${program}` : ""}`.slice(0, 200),
    location: `/work/portfolio#pack-${digest.slice(0, 16)}`,
    kind: "evidence-pack",
    notes: `sha256:${digest} · ${sorted.length} parts · ${body.summary["declared-clear"]} declared clear · ${body.summary["covered-country-declared"]} covered country · ${body.summary.revoked} revoked`.slice(0, 500),
  });
  const receipt = JSON.parse(receiptJson);
  // Receipt first, so /verify finds it; the canonical body follows unchanged, so its digest can be recomputed.
  const packJson = JSON.stringify({ receipt, digest, canonical, pack: body }, null, 2);
  const id = newId();
  await sql`
    insert into portfolio_packs (id, organization_id, program, item_count, digest, ledger_hash, pack_json, created_by)
    values (${id}, ${actor.organizationId}, ${program}, ${sorted.length}, ${digest}, ${entry.hash}, ${packJson}, ${actor.userId})
  `;
  await writeAudit(actor, "portfolio.pack", "portfolio_pack", id, { program, digest, items: sorted.length, hash: entry.hash });
  const { buildPackPdf } = await import("./pack-pdf");
  const { bytesToBase64 } = await import("@/lib/verityx/pdf");
  const pdf = await buildPackPdf(body, { digest, ledgerHash: entry.hash, receiptKid: String(receipt.kid ?? "") });
  return { id, digest, json: packJson, pdfBase64: bytesToBase64(pdf), fileStem: `evidence-pack-${(program || "all").replace(/[^A-Za-z0-9._-]+/g, "_")}-${body.generatedAt.slice(0, 10)}` };
}

export async function downloadPack(userId: string, data: { id: string }) {
  const actor = await ensureActor(userId);
  const sql = await getSql();
  const rows = await sql`select * from portfolio_packs where id = ${data.id} and organization_id = ${actor.organizationId} limit 1`;
  if (!rows[0]) throw new Error("Pack not found");
  const json = String(rows[0].pack_json);
  const parsed = JSON.parse(json) as { pack: EvidencePackBody; digest: string; receipt: { kid?: string } };
  const { buildPackPdf } = await import("./pack-pdf");
  const { bytesToBase64 } = await import("@/lib/verityx/pdf");
  const pdf = await buildPackPdf(parsed.pack, {
    digest: parsed.digest,
    ledgerHash: rows[0].ledger_hash ? String(rows[0].ledger_hash) : "",
    receiptKid: String(parsed.receipt?.kid ?? ""),
  });
  return {
    json,
    pdfBase64: bytesToBase64(pdf),
    fileStem: `evidence-pack-${(parsed.pack.program || "all").replace(/[^A-Za-z0-9._-]+/g, "_")}-${parsed.pack.generatedAt.slice(0, 10)}`,
  };
}
