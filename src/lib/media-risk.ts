/** VerityX media-risk heat: recent GDELT headlines on a supplier, classified by topic and banded. */

export type MediaLevel = "LOW" | "MED" | "HIGH" | "CRITICAL";

export type MediaCategory = "DISRUPTION" | "ESG" | "LABOR" | "COMPLIANCE" | "QUALITY";

export type MediaNews = { title: string; source: string; url: string; query?: string };

export type MediaIncident = {
  title: string;
  source: string;
  url: string;
  category: MediaCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  at: string;
};

export type MediaRisk = {
  id: string;
  supplier: string;
  po?: string;
  risk: number;
  heat: number;
  level: MediaLevel;
  headlines: string[];
  incidents: MediaIncident[];
  source: string;
  issuer: "VerityX media-risk heat";
  /** False when the headline source could not be reached: the heat is then a baseline, not a finding. */
  checked: boolean;
};

export const MEDIA_BANDS: { level: MediaLevel; min: number }[] = [
  { level: "CRITICAL", min: 70 },
  { level: "HIGH", min: 50 },
  { level: "MED", min: 28 },
  { level: "LOW", min: 0 },
];

const CAT_RULES: { category: MediaCategory; re: RegExp; severity: 1 | 2 | 3 | 4 | 5 }[] = [
  { category: "COMPLIANCE", re: /sanction|ofac|un list|embargo|investigation|indict/i, severity: 5 },
  { category: "LABOR", re: /forced labor|forced labour|traffick|slave/i, severity: 5 },
  { category: "DISRUPTION", re: /export ban|export control|blockade|outage|halt/i, severity: 4 },
  { category: "DISRUPTION", re: /export|ban|delay|strike|disruption|shortage/i, severity: 3 },
  { category: "ESG", re: /pollut|emission|spill|climat|waste|tailing/i, severity: 3 },
  { category: "LABOR", re: /labor|labour|worker|union|wage|protest/i, severity: 3 },
  { category: "QUALITY", re: /defect|recall|quality|fail|counterfeit/i, severity: 3 },
  { category: "ESG", re: /rare earth|magnet|mining|china/i, severity: 2 },
];

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function mediaLevel(heat: number): MediaLevel {
  if (heat >= 70) return "CRITICAL";
  if (heat >= 50) return "HIGH";
  if (heat >= 28) return "MED";
  return "LOW";
}

function isCnMagnetics(supplier: string) {
  return /China|Nanjing|Baotou|Northern Rare/i.test(supplier);
}

function classify(title: string): { category: MediaCategory; severity: 1 | 2 | 3 | 4 | 5 } | null {
  for (const rule of CAT_RULES) {
    if (rule.re.test(title)) return { category: rule.category, severity: rule.severity };
  }
  return null;
}

function slug(supplier: string) {
  return supplier
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function scoreMediaRisk(input: {
  supplier: string;
  po?: string;
  news: MediaNews[];
  sanctionsHit: boolean;
  now?: string;
  /** Whether headlines were actually fetched this pass (default: any headline present). */
  newsAvailable?: boolean;
}): MediaRisk {
  const checked = input.newsAvailable ?? input.news.length > 0;
  const now = input.now || new Date().toISOString();
  const key = input.supplier.split(/\s+/)[0].toLowerCase();
  const related = input.news.filter(
    (n) =>
      n.title.toLowerCase().includes(key) ||
      (isCnMagnetics(input.supplier) && /rare|magnet|export|china|ndpr|neodym/i.test(n.title)),
  );
  const incidents: MediaIncident[] = [];
  for (const n of related) {
    const hit = classify(n.title);
    if (!hit) {
      incidents.push({
        title: n.title,
        source: n.source,
        url: n.url,
        category: "ESG",
        severity: 1,
        at: now,
      });
      continue;
    }
    incidents.push({
      title: n.title,
      source: n.source,
      url: n.url,
      category: hit.category,
      severity: hit.severity,
      at: now,
    });
  }
  incidents.sort((a, b) => b.severity - a.severity);
  const top = incidents.slice(0, 6);
  let heat = top.reduce((s, i) => s + i.severity * 8, 0);
  if (input.sanctionsHit) heat += 36;
  if (isCnMagnetics(input.supplier)) heat += 12;
  if (!top.length && !input.sanctionsHit) heat = isCnMagnetics(input.supplier) ? 16 : 6;
  heat = clamp(heat);
  return {
    id: `PW-${slug(input.supplier)}`,
    supplier: input.supplier,
    po: input.po,
    risk: heat,
    heat,
    level: mediaLevel(heat),
    headlines: top.slice(0, 3).map((i) => i.title),
    incidents: top,
    source: checked
      ? "VerityX media-risk heat · GDELT headlines on the PO"
      : "VerityX media-risk heat · NOT CHECKED: headline source unavailable; baseline only",
    issuer: "VerityX media-risk heat",
    checked,
  };
}

export function flattenAlerts(risks: MediaRisk[]) {
  return risks.flatMap((r) =>
    r.incidents.map((i) => ({
      supplier: r.supplier,
      po: r.po,
      heat: r.heat,
      level: r.level,
      ...i,
    })),
  );
}
