/** Company-name matching for registry and sanctions screening. Pure. */
const LEGAL_SUFFIXES = /\b(LTD|LIMITED|CO|COMPANY|CORP|CORPORATION|INC|LLC|GMBH|AG|SA|SAS|SPA|S\.P\.A|BV|NV|PLC|AB|AS|OY|KG|SE|GROUP|HOLDINGS?)\b\.?/g;

/** Core of a company name for list matching: upper case, legal suffixes and punctuation removed. */
export function nameCore(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How well a registry name matches the name asked for, 0–1. GLEIF's legal-name
 * filter is fuzzy and can return an unrelated company first; a record is only
 * attributed to the supplier when its core name tokens genuinely overlap.
 */
export function nameMatchScore(asked: string, found: string): number {
  const a = new Set(nameCore(asked).split(" ").filter((t) => t.length > 1));
  const b = new Set(nameCore(found).split(" ").filter((t) => t.length > 1));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size); // Dice coefficient on core tokens
}
export const NAME_MATCH_MIN = 0.6;

export type GleifRec = { id?: string; attributes?: Record<string, any> };

/** Best genuinely matching GLEIF record for a name, or null. */
export function pickGleif(asked: string, recs: GleifRec[] | undefined) {
  let best: { lei: string; name: string; country: string; status: string } | null = null;
  let bestScore = 0;
  for (const rec of recs ?? []) {
    const ent = rec.attributes?.entity;
    const legal = ent?.legalName?.name || "";
    const score = nameMatchScore(asked, legal);
    if (score > bestScore) {
      bestScore = score;
      best = {
        lei: rec.attributes?.lei || rec.id || "",
        name: legal,
        country: ent?.legalAddress?.country || "",
        status: ent?.status || rec.attributes?.registration?.status || "",
      };
    }
  }
  return bestScore >= NAME_MATCH_MIN ? best : null;
}

