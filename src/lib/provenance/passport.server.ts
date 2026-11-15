/**
 * Lot passport storage and sealing. Every read and write is scoped to the
 * caller's organization, except the chain walk, which reads other
 * organizations' passports only once they are sealed (or revoked) and only
 * by exact code — a draft never leaves its own organization.
 */
import { getSql } from "@/lib/db";
import { newId, iso, isoOrNull, parseJson } from "@/lib/verityx/format";
import { assertCan } from "@/lib/verityx/rbac";
import { ensureActor, mutateGuard, writeAudit, type Actor } from "@/lib/verityx/actor";
import {
  analyzeChain,
  canonicalPassport,
  isPassportCode,
  ledgerNotes,
  MATERIALS,
  newPassportCode,
  parseDraft,
  sealProblems,
  sha256Hex,
  type ChainAnalysis,
  type ChainNode,
  type Material,
  type PassportBody,
  type PassportStatus,
  type StageDeclaration,
} from "./passport";

type Row = Record<string, unknown>;

export type Passport = PassportBody & {
  id: string;
  status: PassportStatus;
  organizationId: string;
  digest: string | null;
  ledgerHash: string | null;
  receiptJson: string | null;
  sealedAt: string | null;
  supersedes: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PassportSummary = Pick<
  Passport,
  "id" | "code" | "lotRef" | "material" | "massKg" | "status" | "sealedAt" | "updatedAt" | "supersedes"
> & { stageCount: number; inputCount: number };

/** What another organization may see of a passport in someone's chain: the sealed declaration, nothing else. */
export type ChainEntry = {
  code: string;
  publisher: string;
  lotRef: string;
  material: Material;
  massKg: number;
  status: PassportStatus;
  digest: string | null;
  sealedAt: string | null;
  stages: StageDeclaration[];
  inputs: string[];
};

function mapPassport(r: Row): Passport {
  return {
    id: String(r.id),
    code: String(r.code),
    organizationId: String(r.organization_id),
    publisher: String(r.publisher),
    lotRef: String(r.lot_ref ?? ""),
    material: String(r.material) as Material,
    massKg: Number(r.mass_kg ?? 0),
    description: String(r.description ?? ""),
    stages: parseJson<StageDeclaration[]>(r.stages_json, []),
    inputs: parseJson<string[]>(r.inputs_json, []),
    status: String(r.status) as PassportStatus,
    digest: r.digest ? String(r.digest) : null,
    ledgerHash: r.ledger_hash ? String(r.ledger_hash) : null,
    receiptJson: r.receipt_json ? String(r.receipt_json) : null,
    sealedAt: isoOrNull(r.sealed_at),
    supersedes: r.supersedes ? String(r.supersedes) : null,
    revokedAt: isoOrNull(r.revoked_at),
    revokedReason: r.revoked_reason ? String(r.revoked_reason) : null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function toSummary(p: Passport): PassportSummary {
  return {
    id: p.id,
    code: p.code,
    lotRef: p.lotRef,
    material: p.material,
    massKg: p.massKg,
    status: p.status,
    sealedAt: p.sealedAt,
    updatedAt: p.updatedAt,
    supersedes: p.supersedes,
    stageCount: p.stages.length,
    inputCount: p.inputs.length,
  };
}

function toChainEntry(p: Passport): ChainEntry {
  return {
    code: p.code,
    publisher: p.publisher,
    lotRef: p.lotRef,
    material: p.material,
    massKg: p.massKg,
    status: p.status,
    digest: p.digest,
    sealedAt: p.sealedAt,
    stages: p.stages,
    inputs: p.inputs,
  };
}

function toNode(p: Pick<Passport, keyof PassportBody | "status" | "digest">): ChainNode {
  return {
    code: p.code,
    publisher: p.publisher,
    lotRef: p.lotRef,
    material: p.material,
    massKg: p.massKg,
    description: p.description,
    stages: p.stages,
    inputs: p.inputs,
    status: p.status,
    digest: p.digest,
  };
}

async function scopedPassport(actor: Actor, id: string): Promise<Passport> {
  const sql = await getSql();
  const rows = await sql`select * from lot_passports where id = ${id} and organization_id = ${actor.organizationId} limit 1`;
  if (!rows[0]) throw new Error("Passport not found");
  return mapPassport(rows[0]);
}

/** Every published (sealed or revoked) passport reachable from these codes, breadth-first. */
export async function loadPublishedChain(codes: string[], maxDepth = 12): Promise<Map<string, Passport>> {
  const sql = await getSql();
  const found = new Map<string, Passport>();
  let frontier = [...new Set(codes.filter(isPassportCode))];
  for (let level = 0; level < maxDepth && frontier.length; level++) {
    const rows = await sql`
      select * from lot_passports
      where code = any(${frontier}) and status in ('sealed', 'revoked')
    `;
    const next: string[] = [];
    for (const r of rows) {
      const p = mapPassport(r);
      if (found.has(p.code)) continue;
      found.set(p.code, p);
      for (const c of p.inputs) if (!found.has(c)) next.push(c);
    }
    frontier = [...new Set(next)];
    if (found.size > 400) break;
  }
  return found;
}

export function analyze(p: Passport, chain: Map<string, Passport>): ChainAnalysis {
  return analyzeChain(toNode(p), (code) => {
    const hit = chain.get(code);
    return hit ? toNode(hit) : undefined;
  });
}

export async function listPassports(userId: string): Promise<PassportSummary[]> {
  const actor = await ensureActor(userId);
  const sql = await getSql();
  const rows = await sql`
    select * from lot_passports where organization_id = ${actor.organizationId}
    order by updated_at desc limit 500
  `;
  return rows.map((r) => toSummary(mapPassport(r)));
}

export async function getPassport(userId: string, data: { id: string }) {
  const actor = await ensureActor(userId);
  const passport = await scopedPassport(actor, data.id);
  const chain = await loadPublishedChain(passport.inputs);
  return {
    passport,
    analysis: analyze(passport, chain),
    chain: [...chain.values()].map(toChainEntry),
    problems: passport.status === "draft" ? sealProblems(passport, [...chain.values()].map(toNode)) : [],
    canSeal: actor.role === "founder" || actor.role === "admin",
  };
}

export async function createPassport(userId: string, data: { material: string; supersedesId?: string }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "passport.write");
  await mutateGuard(actor, "passport.write");
  const sql = await getSql();
  let base: Omit<PassportBody, "code" | "publisher"> = {
    lotRef: "",
    material: (Object.prototype.hasOwnProperty.call(MATERIALS, data.material) ? data.material : "ndfeb_magnet") as Material,
    massKg: 0,
    description: "",
    stages: [],
    inputs: [],
  };
  let supersedes: string | null = null;
  if (data.supersedesId) {
    const old = await scopedPassport(actor, data.supersedesId);
    if (old.status === "draft") throw new Error("Edit the draft instead of superseding it.");
    base = { lotRef: old.lotRef, material: old.material, massKg: old.massKg, description: old.description, stages: old.stages, inputs: old.inputs };
    supersedes = old.code;
  }
  const id = newId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPassportCode();
    try {
      await sql`
        insert into lot_passports (
          id, code, organization_id, created_by, publisher, lot_ref, material, mass_kg,
          description, stages_json, inputs_json, status, supersedes
        ) values (
          ${id}, ${code}, ${actor.organizationId}, ${actor.userId}, ${actor.orgName}, ${base.lotRef},
          ${base.material}, ${base.massKg}, ${base.description}, ${JSON.stringify(base.stages)},
          ${JSON.stringify(base.inputs)}, ${"draft"}, ${supersedes}
        )
      `;
      await writeAudit(actor, "passport.create", "passport", id, { code, supersedes });
      return { id, code };
    } catch (err) {
      if (!/unique|duplicate/i.test(String(err))) throw err;
    }
  }
  throw new Error("Could not mint a passport code; try again.");
}

export async function saveDraft(userId: string, data: { id: string; draft: unknown }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "passport.write");
  await mutateGuard(actor, "passport.write");
  const current = await scopedPassport(actor, data.id);
  if (current.status !== "draft") throw new Error("A sealed passport cannot be edited. Supersede it with a corrected one.");
  const d = parseDraft(data.draft);
  if (d.inputs.includes(current.code)) throw new Error("A lot cannot be its own input.");
  const sql = await getSql();
  await sql`
    update lot_passports set
      lot_ref = ${d.lotRef}, material = ${d.material}, mass_kg = ${d.massKg}, description = ${d.description},
      stages_json = ${JSON.stringify(d.stages)}, inputs_json = ${JSON.stringify(d.inputs)}, updated_at = now()
    where id = ${current.id} and organization_id = ${actor.organizationId} and status = 'draft'
  `;
  return getPassport(userId, { id: current.id });
}

export async function deleteDraft(userId: string, data: { id: string }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "passport.write");
  const current = await scopedPassport(actor, data.id);
  if (current.status !== "draft") throw new Error("Only drafts can be deleted. Revoke a sealed passport instead.");
  const sql = await getSql();
  await sql`delete from lot_passports where id = ${current.id} and organization_id = ${actor.organizationId} and status = 'draft'`;
  await writeAudit(actor, "passport.delete", "passport", current.id, { code: current.code });
  return { ok: true as const };
}

/** Append a passport event to the ledger and issue its Ed25519 receipt, under the ledger lock. */
export async function ledgerSeal(actor: Actor, payload: { title: string; location: string; kind: string; notes: string }) {
  const { appendCoreEvent, eventHashes, merkleProofAt } = await import("@/lib/core-ledger");
  const { withLedger } = await import("@/lib/core-store.server");
  const { entry, index, proof, leafCount } = await withLedger(async () => {
    const entry = await appendCoreEvent("artifact.record", payload, actor.userId.slice(0, 80));
    const index = eventHashes().indexOf(entry.hash);
    return { entry, index, proof: await merkleProofAt(index), leafCount: eventHashes().length };
  });
  const { issueReceipt } = await import("@/lib/receipt.server");
  const receipt = await issueReceipt(entry, { root: proof.root, index, leafCount, path: proof.path });
  if (!receipt) throw new Error("The ledger entry was written but no receipt could be signed. Check seal signing on /api/readiness.");
  return { entry, receiptJson: JSON.stringify(receipt, null, 2) };
}

export async function sealPassport(userId: string, data: { id: string }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "passport.seal");
  await mutateGuard(actor, "passport.seal");
  const p = await scopedPassport(actor, data.id);
  if (p.status !== "draft") throw new Error(`This passport is already ${p.status}.`);
  const chain = await loadPublishedChain(p.inputs);
  const problems = sealProblems(p, [...chain.values()].map(toNode));
  if (problems.length) throw new Error(problems.join(" "));
  const analysis = analyze(p, chain);
  const inputDigests: Record<string, string> = {};
  for (const code of p.inputs) inputDigests[code] = chain.get(code)?.digest ?? "";
  const canonical = canonicalPassport(p, inputDigests);
  const digest = await sha256Hex(canonical);

  // Claim the draft first so two concurrent seals cannot both write a ledger entry.
  const sql = await getSql();
  const claimed = await sql`
    update lot_passports set status = 'sealed', sealed_at = now(), sealed_by = ${actor.userId},
      digest = ${digest}, canonical = ${canonical}, analysis_json = ${JSON.stringify(analysis)}, updated_at = now()
    where id = ${p.id} and organization_id = ${actor.organizationId} and status = 'draft'
    returning id
  `;
  if (!claimed[0]) throw new Error("This passport changed while sealing. Reload and try again.");
  try {
    const { entry, receiptJson } = await ledgerSeal(actor, {
      title: `Lot passport ${p.code} · ${p.lotRef}`.slice(0, 200),
      location: `/passport/${p.code}`,
      kind: "lot-passport",
      notes: ledgerNotes(digest, analysis),
    });
    await sql`
      update lot_passports set ledger_hash = ${entry.hash}, receipt_json = ${receiptJson}, updated_at = now()
      where id = ${p.id} and organization_id = ${actor.organizationId}
    `;
    if (p.supersedes) {
      await revokeByCode(actor, p.supersedes, `Superseded by ${p.code}`);
    }
    await writeAudit(actor, "passport.seal", "passport", p.id, { code: p.code, digest, status: analysis.status, hash: entry.hash });
  } catch (err) {
    // No ledger entry, no seal: return the passport to draft.
    await sql`
      update lot_passports set status = 'draft', sealed_at = null, sealed_by = null, digest = null,
        canonical = null, analysis_json = null, updated_at = now()
      where id = ${p.id} and organization_id = ${actor.organizationId} and ledger_hash is null
    `;
    throw err;
  }
  return getPassport(userId, { id: p.id });
}

async function revokeByCode(actor: Actor, code: string, reason: string) {
  const sql = await getSql();
  const rows = await sql`
    update lot_passports set status = 'revoked', revoked_at = now(), revoked_reason = ${reason}, updated_at = now()
    where code = ${code} and organization_id = ${actor.organizationId} and status = 'sealed'
    returning id, digest
  `;
  if (!rows[0]) return false;
  await ledgerSeal(actor, {
    title: `Lot passport ${code} revoked`.slice(0, 200),
    location: `/passport/${code}`,
    kind: "lot-passport-revoked",
    notes: `sha256:${String(rows[0].digest ?? "")} · ${reason}`.slice(0, 500),
  });
  await writeAudit(actor, "passport.revoke", "passport", String(rows[0].id), { code, reason });
  return true;
}

export async function revokePassport(userId: string, data: { id: string; reason: string }) {
  const actor = await ensureActor(userId);
  assertCan(actor.role, "passport.seal");
  await mutateGuard(actor, "passport.seal");
  const p = await scopedPassport(actor, data.id);
  if (p.status !== "sealed") throw new Error("Only a sealed passport can be revoked.");
  const reason = String(data.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (reason.length < 8) throw new Error("Give a reason (at least 8 characters). Buyers who use this lot will see it.");
  await revokeByCode(actor, p.code, reason);
  return getPassport(userId, { id: p.id });
}

/** Look up a published passport by its code, so a supplier can check an input before linking it. */
export async function lookupPublished(userId: string, data: { code: string }) {
  await ensureActor(userId);
  const code = String(data.code ?? "").trim().toUpperCase();
  if (!isPassportCode(code)) throw new Error("Passport codes look like LP-XXXX-XXXX.");
  const chain = await loadPublishedChain([code]);
  const p = chain.get(code);
  if (!p) return null;
  return { entry: toChainEntry(p), analysis: analyze(p, chain) };
}

// ---------------------------------------------------------------- public read

const PUBLIC_PER_MINUTE = 60;
const publicHits = new Map<string, { n: number; reset: number }>();

async function publicThrottle() {
  let ip = "unknown";
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const h = getRequest().headers;
    ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  } catch {
    /* no request context (tests) */
  }
  const now = Date.now();
  const hit = publicHits.get(ip);
  if (!hit || hit.reset < now) {
    publicHits.set(ip, { n: 1, reset: now + 60_000 });
    if (publicHits.size > 5000) publicHits.clear();
    return;
  }
  hit.n += 1;
  if (hit.n > PUBLIC_PER_MINUTE) throw new Error("Too many requests. Wait a minute and retry.");
}

export type PublicPassport = {
  entry: ChainEntry & { description: string };
  /** The exact sealed bytes, so a browser can recompute the digest itself. */
  canonical: string | null;
  receiptJson: string | null;
  ledgerHash: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  supersedes: string | null;
  supersededBy: string | null;
  analysis: ChainAnalysis;
  /** Every published lot upstream of this one. */
  chain: ChainEntry[];
  /** Published lots that name this one as an input. */
  usedIn: Pick<ChainEntry, "code" | "publisher" | "lotRef" | "material" | "status">[];
};

/** Anyone with the code can read a sealed or revoked passport. Drafts do not exist publicly. */
export async function getPublicPassport(data: { code: string }): Promise<PublicPassport | null> {
  await publicThrottle();
  const code = String(data.code ?? "").trim().toUpperCase();
  if (!isPassportCode(code)) return null;
  const sql = await getSql();
  const rows = await sql`select * from lot_passports where code = ${code} and status in ('sealed', 'revoked') limit 1`;
  if (!rows[0]) return null;
  const p = mapPassport(rows[0]);
  const chain = await loadPublishedChain(p.inputs);
  const used = await sql`
    select code, publisher, lot_ref, material, status from lot_passports
    where status in ('sealed', 'revoked') and inputs_json like ${`%"${code}"%`}
    order by sealed_at desc limit 50
  `;
  const next = await sql`select code from lot_passports where supersedes = ${code} and status in ('sealed', 'revoked') limit 1`;
  return {
    entry: { ...toChainEntry(p), description: p.description },
    canonical: rows[0].canonical ? String(rows[0].canonical) : null,
    receiptJson: p.receiptJson,
    ledgerHash: p.ledgerHash,
    revokedAt: p.revokedAt,
    revokedReason: p.revokedReason,
    supersedes: p.supersedes,
    supersededBy: next[0] ? String(next[0].code) : null,
    analysis: analyze(p, chain),
    chain: [...chain.values()].map(toChainEntry),
    usedIn: used.map((r) => ({
      code: String(r.code),
      publisher: String(r.publisher),
      lotRef: String(r.lot_ref ?? ""),
      material: String(r.material) as Material,
      status: String(r.status) as PassportStatus,
    })),
  };
}
