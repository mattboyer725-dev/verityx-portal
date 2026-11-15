/**
 * LOT PASSPORTS — pure rules, shared by the server and the browser.
 *
 * A lot passport is a supplier's own signed declaration of where each
 * restricted processing stage of one lot happened, with fingerprints
 * (SHA-256) of the evidence documents behind each stage. Passports chain:
 * a magnet lot names the alloy lot it was made from, which names the metal
 * lot, and so on back to the mine.
 *
 * The stages are the ones DFARS 225.7018 / 252.225-7052 restricts from
 * January 1, 2027 for NdFeB and SmCo magnets: mined, separated, refined,
 * melted, produced. Covered countries: China, Russia, Iran, North Korea.
 *
 * What this module never does: certify compliance. It reports what the
 * declared chain says. A declaration is only as true as its publisher;
 * VerityX does not audit facilities.
 */
import { pyJson } from "../canonical.ts";

export const PASSPORT_VERSION = "vx-passport-1";

/** Restricted stages, upstream to downstream. */
export const STAGES = ["mined", "separated", "refined", "melted", "produced"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  mined: "Mined (or recycled feedstock recovered)",
  separated: "Separated (oxides)",
  refined: "Refined (metal)",
  melted: "Melted (alloy)",
  produced: "Produced (finished magnet)",
};

/** DFARS 225.7003-1 covered countries for this restriction. */
export const COVERED_COUNTRIES: Record<string, string> = {
  CN: "China",
  RU: "Russia",
  IR: "Iran",
  KP: "North Korea",
};

export const MATERIALS = {
  concentrate: { label: "Ore or recycled concentrate", through: "mined" },
  oxide: { label: "Rare-earth oxide", through: "separated" },
  metal: { label: "Rare-earth metal", through: "refined" },
  alloy: { label: "Magnet alloy", through: "melted" },
  ndfeb_magnet: { label: "NdFeB magnet", through: "produced" },
  smco_magnet: { label: "SmCo magnet", through: "produced" },
} as const satisfies Record<string, { label: string; through: Stage }>;
export type Material = keyof typeof MATERIALS;

export function isMaterial(v: unknown): v is Material {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MATERIALS, v);
}

export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}

/** Every stage a lot of this material must account for, upstream first. */
export function requiredStages(material: Material): Stage[] {
  const through = MATERIALS[material].through;
  return STAGES.slice(0, STAGES.indexOf(through) + 1);
}

export type EvidenceFile = {
  name: string;
  /** Lowercase hex SHA-256 of the file bytes, computed in the browser. The file itself is never uploaded. */
  sha256: string;
  bytes: number;
};

export type StageDeclaration = {
  stage: Stage;
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  facility: string;
  operator: string;
  /** Mined stage only: the feedstock is recycled material, recovered at this facility. */
  recycled: boolean;
  evidence: EvidenceFile[];
};

export type PassportStatus = "draft" | "sealed" | "revoked";

/** The fields a passport is sealed over. */
export type PassportBody = {
  code: string;
  publisher: string;
  lotRef: string;
  material: Material;
  massKg: number;
  description: string;
  stages: StageDeclaration[];
  /** Codes of the input lots this lot was made from. */
  inputs: string[];
};

/** A passport as the chain analysis sees it (inputs resolved by the caller). */
export type ChainNode = PassportBody & {
  status: PassportStatus;
  digest: string | null;
};

export const CODE_RE = /^LP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function isPassportCode(v: unknown): v is string {
  return typeof v === "string" && CODE_RE.test(v);
}

/** Short shareable code, e.g. LP-7K3Q-9XWD (Crockford base32, 40 bits). */
/** Accepts "lp7k2m9q4r", "LP-7K2M 9Q4R", a pasted /passport/… link, and Crockford look-alikes (O→0, I/L→1). */
export function normalizePassportCode(raw: string): string | null {
  let v = raw.trim();
  const fromUrl = v.match(/passport\/([A-Za-z0-9-]+)/);
  if (fromUrl) v = fromUrl[1];
  v = v.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (v.startsWith("LP")) v = v.slice(2);
  v = v.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (v.length !== 8) return null;
  const code = `LP-${v.slice(0, 4)}-${v.slice(4)}`;
  return CODE_RE.test(code) ? code : null;
}

export function newPassportCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => CROCKFORD[b % 32]).join("");
  return `LP-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Normalise untrusted draft input. Throws on anything that cannot be stored. */
export function parseDraft(input: unknown): Omit<PassportBody, "code" | "publisher"> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid passport");
  const o = input as Record<string, unknown>;
  if (!isMaterial(o.material)) throw new Error("Choose a material");
  const massKg = Number(o.massKg);
  if (!Number.isFinite(massKg) || massKg < 0 || massKg > 1e9) throw new Error("Mass must be between 0 and 1,000,000,000 kg");
  const rawStages = Array.isArray(o.stages) ? o.stages : [];
  if (rawStages.length > STAGES.length) throw new Error("Too many stages");
  const seen = new Set<Stage>();
  const stages: StageDeclaration[] = rawStages.map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    if (!isStage(s.stage)) throw new Error("Unknown stage");
    if (seen.has(s.stage)) throw new Error(`Stage "${s.stage}" is declared twice`);
    seen.add(s.stage);
    const country = text(s.country, 2).toUpperCase();
    if (country && !COUNTRY_RE.test(country)) throw new Error(`${s.stage}: country must be a two-letter code`);
    const files = Array.isArray(s.evidence) ? s.evidence : [];
    if (files.length > 20) throw new Error(`${s.stage}: at most 20 evidence files`);
    const evidence = files.map((f) => {
      const e = (f ?? {}) as Record<string, unknown>;
      const sha256 = text(e.sha256, 64).toLowerCase();
      if (!SHA256_RE.test(sha256)) throw new Error(`${s.stage}: bad evidence fingerprint`);
      const bytes = Number(e.bytes);
      return { name: text(e.name, 160) || "file", sha256, bytes: Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : 0 };
    });
    return {
      stage: s.stage,
      country,
      facility: text(s.facility, 160),
      operator: text(s.operator, 160),
      recycled: s.stage === "mined" && s.recycled === true,
      evidence,
    };
  });
  stages.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  const rawInputs = Array.isArray(o.inputs) ? o.inputs : [];
  if (rawInputs.length > 12) throw new Error("At most 12 input lots");
  const inputs = [...new Set(rawInputs.map((c) => text(c, 12).toUpperCase()))];
  for (const c of inputs) if (!isPassportCode(c)) throw new Error(`"${c}" is not a passport code (LP-XXXX-XXXX)`);
  return {
    lotRef: text(o.lotRef, 80),
    material: o.material,
    massKg,
    description: text(o.description, 500),
    stages,
    inputs: inputs.sort(),
  };
}

/** Problems that stop a draft from being sealed. Empty = ready. */
export function sealProblems(body: PassportBody, inputs: ChainNode[]): string[] {
  const out: string[] = [];
  if (!body.lotRef) out.push("Add the lot or batch number.");
  if (!(body.massKg > 0)) out.push("Add the lot mass in kg.");
  if (!body.stages.length) out.push("Declare at least the stage your own facility performed.");
  const required = requiredStages(body.material);
  for (const s of body.stages) {
    if (!required.includes(s.stage)) out.push(`${STAGE_LABEL[s.stage]} is downstream of ${MATERIALS[body.material].label}.`);
    if (!s.country) out.push(`${STAGE_LABEL[s.stage]}: add the country.`);
    if (!s.facility) out.push(`${STAGE_LABEL[s.stage]}: add the facility.`);
    if (!s.evidence.length) out.push(`${STAGE_LABEL[s.stage]}: attach at least one evidence document.`);
  }
  const byCode = new Map(inputs.map((n) => [n.code, n]));
  for (const code of body.inputs) {
    const n = byCode.get(code);
    if (!n) out.push(`Input ${code} was not found.`);
    else if (n.status !== "sealed") out.push(`Input ${code} is ${n.status}; only sealed passports can be inputs.`);
  }
  if (body.inputs.includes(body.code)) out.push("A lot cannot be its own input.");
  return out;
}

export type StageCoverage = {
  stage: Stage;
  /** Every declaration that supplies this stage somewhere in the chain. */
  sources: { code: string; country: string; facility: string; recycled: boolean }[];
  /** True when the stage is declared by this lot, or by every input chain. */
  covered: boolean;
};

export type ChainAnalysis = {
  code: string;
  material: Material;
  /** Every required stage, upstream first. */
  stages: StageCoverage[];
  missing: Stage[];
  coveredCountryStages: { code: string; stage: Stage; country: string; facility: string }[];
  revokedInputs: string[];
  depth: number;
  /** declared-clear: complete chain, no covered-country stage declared. Never "compliant". */
  status: "declared-clear" | "covered-country-declared" | "incomplete";
};

type Resolver = (code: string) => ChainNode | undefined;

/**
 * Walk the declared chain. A stage this lot does not declare must be supplied
 * by EVERY input chain (a blend is only as traceable as its least traced input).
 */
export function analyzeChain(root: ChainNode, resolve: Resolver, maxDepth = 12): ChainAnalysis {
  const coveredCountryStages: ChainAnalysis["coveredCountryStages"] = [];
  const revokedInputs = new Set<string>();
  let depth = 0;

  function walk(node: ChainNode, level: number, path: Set<string>): Map<Stage, StageCoverage["sources"]> {
    depth = Math.max(depth, level);
    const supplied = new Map<Stage, StageCoverage["sources"]>();
    for (const s of node.stages) {
      supplied.set(s.stage, [{ code: node.code, country: s.country, facility: s.facility, recycled: s.recycled }]);
      if (COVERED_COUNTRIES[s.country]) {
        coveredCountryStages.push({ code: node.code, stage: s.stage, country: s.country, facility: s.facility });
      }
    }
    if (level >= maxDepth) return supplied;
    const upstream = requiredStages(node.material).filter((st) => !supplied.has(st));
    const children = node.inputs
      .filter((c) => !path.has(c))
      .map((c) => resolve(c))
      .filter((n): n is ChainNode => !!n);
    for (const child of children) if (child.status === "revoked") revokedInputs.add(child.code);
    const childMaps = children.map((child) => walk(child, level + 1, new Set([...path, child.code])));
    for (const st of upstream) {
      if (!childMaps.length) continue;
      if (childMaps.every((m) => m.has(st))) supplied.set(st, childMaps.flatMap((m) => m.get(st) ?? []));
    }
    return supplied;
  }

  const supplied = walk(root, 0, new Set([root.code]));
  const stages = requiredStages(root.material).map((stage) => ({
    stage,
    sources: supplied.get(stage) ?? [],
    covered: supplied.has(stage),
  }));
  const missing = stages.filter((s) => !s.covered).map((s) => s.stage);
  const status: ChainAnalysis["status"] = coveredCountryStages.length
    ? "covered-country-declared"
    : missing.length || revokedInputs.size
      ? "incomplete"
      : "declared-clear";
  return {
    code: root.code,
    material: root.material,
    stages,
    missing,
    coveredCountryStages,
    revokedInputs: [...revokedInputs].sort(),
    depth,
    status,
  };
}

export const STATUS_TEXT: Record<ChainAnalysis["status"], string> = {
  "declared-clear":
    "Every restricted stage is declared, and no stage is declared in China, Russia, Iran or North Korea. This is the publishers' declaration, not a certification.",
  "covered-country-declared":
    "At least one restricted stage is declared in a covered country (China, Russia, Iran or North Korea).",
  incomplete: "The declared chain does not yet account for every restricted stage.",
};

/**
 * The exact bytes a passport is sealed over: canonical JSON (the ledger's own
 * encoding) of the body plus each input's digest, so a seal also fixes the
 * upstream chain it was built on.
 */
export function canonicalPassport(body: PassportBody, inputDigests: Record<string, string>): string {
  return pyJson({
    version: PASSPORT_VERSION,
    code: body.code,
    publisher: body.publisher,
    lotRef: body.lotRef,
    material: body.material,
    massKg: body.massKg,
    description: body.description,
    stages: body.stages.map((s) => ({
      stage: s.stage,
      country: s.country,
      facility: s.facility,
      operator: s.operator,
      recycled: s.recycled,
      evidence: s.evidence.map((e) => ({ name: e.name, sha256: e.sha256, bytes: e.bytes })),
    })),
    inputs: body.inputs.map((code) => ({ code, digest: inputDigests[code] ?? "" })),
  });
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function passportDigest(body: PassportBody, inputDigests: Record<string, string>): Promise<string> {
  return sha256Hex(canonicalPassport(body, inputDigests));
}

/** The ledger entry's notes: digest first, so the receipt alone pins the content. Max 500 chars. */
export function ledgerNotes(digest: string, analysis: ChainAnalysis): string {
  const stages = analysis.stages
    .map((s) => `${s.stage}=${s.covered ? [...new Set(s.sources.map((x) => x.country))].join("+") : "?"}`)
    .join(" ");
  return `sha256:${digest} · ${analysis.status} · ${stages}`.slice(0, 500);
}

export type IntegrityCheck = { id: "content" | "page" | "inputs" | "ledger"; ok: boolean; detail: string };

type PublicView = {
  code: string;
  publisher: string;
  lotRef: string;
  material: Material;
  massKg: number;
  description: string;
  stages: StageDeclaration[];
  inputs: string[];
  digest: string | null;
};

/**
 * Checks a reader can run on a public passport without trusting the server:
 * the sealed bytes hash to the digest, the page shows exactly those bytes,
 * each input digest matches the input passport, and the signed ledger entry
 * names this passport and this digest. (The receipt's own signature is
 * checked separately with verifyReceipt.)
 */
export async function passportIntegrity(
  view: PublicView,
  canonical: string | null,
  ledgerPayload: Record<string, unknown> | null,
  chainDigests: Record<string, string | null>,
): Promise<IntegrityCheck[]> {
  const out: IntegrityCheck[] = [];
  if (!canonical || !view.digest) {
    return [{ id: "content", ok: false, detail: "This passport has no sealed content to check." }];
  }
  const digest = await sha256Hex(canonical);
  out.push({
    id: "content",
    ok: digest === view.digest,
    detail: digest === view.digest ? "The sealed content hashes to the published digest." : "The sealed content does NOT hash to the published digest.",
  });

  let sealed: Record<string, unknown> | null = null;
  try {
    sealed = JSON.parse(canonical) as Record<string, unknown>;
  } catch {
    sealed = null;
  }
  const expected = sealed
    ? canonicalPassport(view, Object.fromEntries(((sealed.inputs as { code: string; digest: string }[]) ?? []).map((i) => [i.code, i.digest])))
    : "";
  out.push({
    id: "page",
    ok: expected === canonical,
    detail: expected === canonical ? "Every field on this page is exactly what was sealed." : "This page differs from what was sealed.",
  });

  const sealedInputs = ((sealed?.inputs as { code: string; digest: string }[]) ?? []);
  const badInputs = sealedInputs.filter((i) => !chainDigests[i.code] || chainDigests[i.code] !== i.digest).map((i) => i.code);
  out.push({
    id: "inputs",
    ok: badInputs.length === 0,
    detail: !sealedInputs.length
      ? "No input lots."
      : badInputs.length
        ? `Input digest mismatch or missing: ${badInputs.join(", ")}.`
        : sealedInputs.length === 1
          ? "The input lot matches the digest sealed into this one."
          : `All ${sealedInputs.length} input lots match the digests sealed into this one.`,
  });

  const notes = typeof ledgerPayload?.notes === "string" ? ledgerPayload.notes : "";
  const bound =
    ledgerPayload?.kind === "lot-passport" &&
    ledgerPayload?.location === `/passport/${view.code}` &&
    notes.startsWith(`sha256:${view.digest}`);
  out.push({
    id: "ledger",
    ok: bound,
    detail: bound
      ? "The signed ledger entry names this passport and this digest."
      : ledgerPayload
        ? "The ledger entry in the receipt does not name this passport and digest."
        : "No receipt to check against.",
  });
  return out;
}
