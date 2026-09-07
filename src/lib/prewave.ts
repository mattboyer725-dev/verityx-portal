/** Prewave analog — media-risk heat from RSS on the same PO. Not a Prewave tenant. */

export type PrewaveLevel = "LOW" | "MED" | "HIGH" | "CRITICAL";

export type PrewaveCategory = "DISRUPTION" | "ESG" | "LABOR" | "COMPLIANCE" | "QUALITY";

export type PrewaveNews = { title: string; source: string; url: string; query?: string };

export type PrewaveIncident = {
  title: string;
  source: string;
  url: string;
  category: PrewaveCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  at: string;
};

export type PrewaveRisk = {
  id: string;
  supplier: string;
  po?: string;
  risk: number;
  heat: number;
  level: PrewaveLevel;
  headlines: string[];
  incidents: PrewaveIncident[];
  source: string;
  issuer: "Prewave analog · VerityX host";
};

export const PREWAVE_BANDS: { level: PrewaveLevel; min: number }[] = [
  { level: "CRITICAL", min: 70 },
  { level: "HIGH", min: 50 },
  { level: "MED", min: 28 },
  { level: "LOW", min: 0 },
];

const CAT_RULES: { category: PrewaveCategory; re: RegExp; severity: 1 | 2 | 3 | 4 | 5 }[] = [
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

export function prewaveLevel(heat: number): PrewaveLevel {
  if (heat >= 70) return "CRITICAL";
  if (heat >= 50) return "HIGH";
  if (heat >= 28) return "MED";
  return "LOW";
}

function isCnMagnetics(supplier: string) {
  return /China|Nanjing|Baotou|Northern Rare/i.test(supplier);
}

function classify(title: string): { category: PrewaveCategory; severity: 1 | 2 | 3 | 4 | 5 } | null {
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

export function scorePrewave(input: {
  supplier: string;
  po?: string;
  news: PrewaveNews[];
  sanctionsHit: boolean;
  now?: string;
}): PrewaveRisk {
  const now = input.now || new Date().toISOString();
  const key = input.supplier.split(/\s+/)[0].toLowerCase();
  const related = input.news.filter(
    (n) =>
      n.title.toLowerCase().includes(key) ||
      (isCnMagnetics(input.supplier) && /rare|magnet|export|china|ndpr|neodym/i.test(n.title)),
  );
  const incidents: PrewaveIncident[] = [];
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
    level: prewaveLevel(heat),
    headlines: top.slice(0, 3).map((i) => i.title),
    incidents: top,
    source: "Prewave media-risk analog · live news RSS on the PO",
    issuer: "Prewave analog · VerityX host",
  };
}

export function prewaveTaxonomy() {
  return {
    protocol: "Prewave media-risk analog",
    issuer: "Prewave analog · VerityX host",
    vendor: {
      subscribed: false,
      note: "Prewave is not a tenant here. Heat is scored from live news RSS incidents on the same purchase order the EcoVadis analog scores.",
    },
    categories: ["DISRUPTION", "ESG", "LABOR", "COMPLIANCE", "QUALITY"],
    bands: PREWAVE_BANDS,
    heat: "sum(severity × 8) + sanctions 36 + CN magnetics 12, clamped 0–100",
  };
}

export function flattenAlerts(risks: PrewaveRisk[]) {
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
