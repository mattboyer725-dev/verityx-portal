/**
 * BUYER PORTFOLIO — pure rules shared by server and browser.
 *
 * A buyer lists the magnet-bearing parts on its contracts and the lot
 * passport code each one ships with. VerityX resolves every code against
 * the published passports and reports, per part: no passport, code not
 * found, revoked, incomplete, covered country declared, or declared clear.
 * A part whose state changed since the buyer last acknowledged it is an
 * alert (a supplier revoked a lot, or an upstream lot was revoked).
 */
import { pyJson } from "../canonical.ts";
import { isPassportCode, sha256Hex, type ChainAnalysis, type Material } from "./passport.ts";

export const PACK_VERSION = "vx-evidence-pack-1";
export const MAX_IMPORT_ROWS = 2000;

export type PortfolioItemInput = {
  partNumber: string;
  description: string;
  program: string;
  supplier: string;
  passportCode: string;
};

export type ItemState = "no-passport" | "not-found" | "revoked" | ChainAnalysis["status"];

export const STATE_LABEL: Record<ItemState, string> = {
  "no-passport": "No passport",
  "not-found": "Code not found",
  revoked: "Lot revoked",
  incomplete: "Incomplete chain",
  "covered-country-declared": "Covered country declared",
  "declared-clear": "Declared clear",
};

/** Worst first: what a contracting officer would ask about first. */
export const STATE_ORDER: ItemState[] = [
  "covered-country-declared",
  "revoked",
  "not-found",
  "no-passport",
  "incomplete",
  "declared-clear",
];

export type ResolvedLot = {
  code: string;
  publisher: string;
  lotRef: string;
  material: Material;
  status: "sealed" | "revoked";
  digest: string | null;
  sealedAt: string | null;
  revokedReason: string | null;
};

export function itemState(code: string, lot: ResolvedLot | undefined, analysis: ChainAnalysis | undefined): ItemState {
  if (!code) return "no-passport";
  if (!lot) return "not-found";
  if (lot.status === "revoked") return "revoked";
  return analysis?.status ?? "incomplete";
}

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normalizeItem(o: Partial<Record<keyof PortfolioItemInput, unknown>>): PortfolioItemInput {
  const partNumber = clean(o.partNumber, 80);
  if (!partNumber) throw new Error("Each part needs a part number.");
  const passportCode = clean(o.passportCode, 20).toUpperCase();
  if (passportCode && !isPassportCode(passportCode)) {
    throw new Error(`${partNumber}: "${passportCode}" is not a passport code (LP-XXXX-XXXX).`);
  }
  return {
    partNumber,
    description: clean(o.description, 200),
    program: clean(o.program, 80),
    supplier: clean(o.supplier, 120),
    passportCode,
  };
}

/** RFC 4180-style CSV: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const HEADERS: Record<keyof PortfolioItemInput, string[]> = {
  partNumber: ["part", "part number", "part_number", "partnumber", "part no", "pn", "nsn"],
  description: ["description", "desc", "item", "nomenclature"],
  program: ["program", "contract", "contract number", "programme", "project"],
  supplier: ["supplier", "vendor", "manufacturer", "source"],
  passportCode: ["passport", "passport code", "passport_code", "code", "lot passport", "lp"],
};

export type CsvImport = { items: PortfolioItemInput[]; errors: string[]; header: string[] };

/** Map a CSV with a header row onto portfolio items. Bad rows are reported, not fatal. */
export function parsePortfolioCsv(text: string): CsvImport {
  const rows = parseCsvRows(text);
  if (!rows.length) return { items: [], errors: ["The file is empty."], header: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));
  const col: Partial<Record<keyof PortfolioItemInput, number>> = {};
  for (const [key, names] of Object.entries(HEADERS) as [keyof PortfolioItemInput, string[]][]) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx >= 0) col[key] = idx;
  }
  if (col.partNumber === undefined) {
    return { items: [], errors: ['Add a header row with a "part number" column (and ideally "passport code").'], header };
  }
  const items: PortfolioItemInput[] = [];
  const errors: string[] = [];
  const body = rows.slice(1);
  if (body.length > MAX_IMPORT_ROWS) errors.push(`Only the first ${MAX_IMPORT_ROWS} rows were read.`);
  body.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const get = (k: keyof PortfolioItemInput) => (col[k] === undefined ? "" : (r[col[k]!] ?? ""));
    try {
      items.push(
        normalizeItem({
          partNumber: get("partNumber"),
          description: get("description"),
          program: get("program"),
          supplier: get("supplier"),
          passportCode: get("passportCode"),
        }),
      );
    } catch (err) {
      errors.push(`Row ${i + 2}: ${(err as Error).message}`);
    }
  });
  return { items, errors, header };
}

export type PortfolioRow = PortfolioItemInput & {
  id: string;
  state: ItemState;
  /** The state the buyer last acknowledged; null = never reviewed. */
  ackState: ItemState | null;
  changed: boolean;
  lot: ResolvedLot | null;
  analysis: ChainAnalysis | null;
};

export type PortfolioSummary = Record<ItemState, number> & { total: number; changed: number; parts: number };

export function summarize(rows: PortfolioRow[]): PortfolioSummary {
  const base = Object.fromEntries(STATE_ORDER.map((s) => [s, 0])) as Record<ItemState, number>;
  for (const r of rows) base[r.state] += 1;
  return {
    ...base,
    total: rows.length,
    changed: rows.filter((r) => r.changed).length,
    parts: new Set(rows.map((r) => r.partNumber)).size,
  };
}

/** Is this alert worth showing? Any move away from what the buyer last saw. First sight is not an alert. */
export function isChanged(state: ItemState, ackState: ItemState | null): boolean {
  return ackState !== null && ackState !== state;
}

export type EvidencePackItem = {
  partNumber: string;
  description: string;
  program: string;
  supplier: string;
  passportCode: string;
  state: ItemState;
  lot: ResolvedLot | null;
  /** Every restricted stage and the declared country/facility, from the chain analysis. */
  stages: { stage: string; covered: boolean; sources: { code: string; country: string; facility: string }[] }[];
  coveredCountryStages: ChainAnalysis["coveredCountryStages"];
  revokedInputs: string[];
};

export type EvidencePackBody = {
  version: string;
  buyer: string;
  program: string;
  generatedAt: string;
  summary: PortfolioSummary;
  items: EvidencePackItem[];
  /** Digest of every passport in the chains, so each can be re-checked on its public page. */
  passports: { code: string; digest: string | null; publisher: string; status: string }[];
  statement: string;
};

export const PACK_STATEMENT =
  "This pack lists, for each part, the lot passport its supplier published and the declared location of each restricted stage (mined, separated, refined, melted, produced). Passports are the publishers' own declarations, sealed unchanged on the VerityX ledger. VerityX does not audit facilities and does not certify compliance with DFARS 252.225-7052; the contractor remains responsible for its representations. Each passport can be re-checked at /passport/<code>.";

export function toPackItem(r: PortfolioRow): EvidencePackItem {
  return {
    partNumber: r.partNumber,
    description: r.description,
    program: r.program,
    supplier: r.supplier,
    passportCode: r.passportCode,
    state: r.state,
    lot: r.lot,
    stages: (r.analysis?.stages ?? []).map((s) => ({
      stage: s.stage,
      covered: s.covered,
      sources: s.sources.map((x) => ({ code: x.code, country: x.country, facility: x.facility })),
    })),
    coveredCountryStages: r.analysis?.coveredCountryStages ?? [],
    revokedInputs: r.analysis?.revokedInputs ?? [],
  };
}

export function canonicalPack(body: EvidencePackBody): string {
  return pyJson(body);
}

export async function packDigest(body: EvidencePackBody): Promise<string> {
  return sha256Hex(canonicalPack(body));
}

export function sortRows(rows: PortfolioRow[]): PortfolioRow[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.changed) - Number(a.changed) ||
      STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
      a.program.localeCompare(b.program) ||
      a.partNumber.localeCompare(b.partNumber),
  );
}
