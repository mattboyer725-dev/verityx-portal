/** EcoVadis analog — 21-criteria / 4-theme shape from public sources. Not an EcoVadis tenant. */

export type EcoVadisMedal = "Platinum" | "Gold" | "Silver" | "Bronze" | "None";

export type EcoVadisThemeKey = "environment" | "labor" | "ethics" | "procurement";

export type EcoVadisNews = { title: string; source: string; url: string; query?: string };

export type EcoVadisGleif = {
  lei: string;
  name: string;
  country: string;
  status: string;
} | null;

export type EcoVadisScore = {
  id: string;
  supplier: string;
  po?: string;
  lei?: string;
  country?: string;
  score: number;
  medal: EcoVadisMedal;
  themes: { environment: number; labor: number; ethics: number; procurement: number };
  weights: { environment: number; labor: number; ethics: number; procurement: number };
  evidence: Record<EcoVadisThemeKey, string[]>;
  publishedAt: string;
  validUntil: string;
  industry: string;
  source: string;
  issuer: "EcoVadis analog · VerityX host";
};

/** NACE 27 — Manufacture of electrical equipment (magnetics / generators). Public EcoVadis weight table. */
export const ECOVADIS_WEIGHTS = {
  environment: 31,
  labor: 35,
  ethics: 17,
  procurement: 17,
} as const;

/** Published 2024 numeric cutoffs (percentile medals). Analog uses the numbers, not EcoVadis ranks. */
export const ECOVADIS_MEDALS: { medal: EcoVadisMedal; min: number; band: string }[] = [
  { medal: "Platinum", min: 73, band: "top 1%" },
  { medal: "Gold", min: 66, band: "top 5%" },
  { medal: "Silver", min: 56, band: "top 25%" },
  { medal: "Bronze", min: 45, band: "top 50%" },
  { medal: "None", min: 0, band: "unrated" },
];

export const ECOVADIS_CRITERIA: Record<EcoVadisThemeKey, string[]> = {
  environment: [
    "Energy consumption & GHGs",
    "Water",
    "Biodiversity",
    "Local pollution",
    "Materials, chemicals & waste",
    "Product use",
    "Product end-of-life",
    "Customer health & safety",
    "Environmental services & advocacy",
  ],
  labor: [
    "Employee health & safety",
    "Working conditions",
    "Social dialogue",
    "Career management & training",
    "Child labor, forced labor & human trafficking",
    "Diversity, equity & inclusion",
    "Human rights of external stakeholders",
  ],
  ethics: ["Corruption", "Anticompetitive practices", "Responsible information management"],
  procurement: ["Supplier environmental practices", "Supplier social practices"],
};

const EU = new Set(["DE", "AT", "FR", "SE", "DK", "NL", "BE", "FI", "ES", "IT", "GB", "IE", "PL", "PT"]);

const ENV_NEWS = /pollut|emission|waste|spill|climat|coal|tailing|discharge/i;
const LAB_NEWS = /labor|labour|forced|worker|strike|union|traffick|wage/i;
const ETH_NEWS = /brib|corrupt|fraud|cartel|sanction|ofac/i;

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function medalFor(score: number): EcoVadisMedal {
  if (score >= 73) return "Platinum";
  if (score >= 66) return "Gold";
  if (score >= 56) return "Silver";
  if (score >= 45) return "Bronze";
  return "None";
}

function slug(supplier: string) {
  return supplier
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

function isCnMagnetics(supplier: string) {
  return /China|Nanjing|Baotou|Northern Rare/i.test(supplier);
}

export function scoreEcovadis(input: {
  supplier: string;
  po?: string;
  gleif: EcoVadisGleif;
  sanctionsHit: boolean;
  listed: boolean;
  news: EcoVadisNews[];
  now?: string;
}): EcoVadisScore {
  const now = input.now || new Date().toISOString();
  const valid = new Date(now);
  valid.setUTCFullYear(valid.getUTCFullYear() + 1);
  const key = input.supplier.split(/\s+/)[0].toLowerCase();
  const related = input.news.filter(
    (n) =>
      n.title.toLowerCase().includes(key) ||
      (isCnMagnetics(input.supplier) && /rare|magnet|export|china/i.test(n.title)),
  );
  const envNews = related.filter((n) => ENV_NEWS.test(n.title));
  const labNews = related.filter((n) => LAB_NEWS.test(n.title));
  const ethNews = related.filter((n) => ETH_NEWS.test(n.title));
  const eu = !!(input.gleif && EU.has(input.gleif.country));
  const active = !!(input.gleif && (input.gleif.status === "ACTIVE" || input.gleif.lei));
  const cn = isCnMagnetics(input.supplier) || input.gleif?.country === "CN";

  const envEv: string[] = [];
  const labEv: string[] = [];
  const ethEv: string[] = [];
  const buyEv: string[] = [];

  let environment = 50;
  let labor = 50;
  let ethics = 50;
  let procurement = 50;

  if (active) {
    environment += 6;
    ethics += 8;
    procurement += 8;
    envEv.push(`GLEIF ${input.gleif!.status || "ACTIVE"} · ${input.gleif!.lei.slice(0, 12)}`);
    ethEv.push("Legal identity on GLEIF");
    buyEv.push("LEI present — counterparties can be named");
  } else {
    envEv.push("No ACTIVE GLEIF record on this host");
    buyEv.push("Unidentified legal entity");
  }
  if (eu) {
    environment += 10;
    labor += 12;
    envEv.push(`Operations country ${input.gleif!.country} (EU/EEA analog)`);
    labEv.push("EU labor-law jurisdiction analog");
  }
  if (cn) {
    environment -= 14;
    labor -= 10;
    procurement -= 8;
    envEv.push("CN processing analog (coal grid / REE mill intensity)");
    labEv.push("CN labor-jurisdiction analog — not a questionnaire");
    buyEv.push("N-tier opacity on magnetics feed");
  }
  if (input.listed) {
    procurement += 10;
    buyEv.push("Listed tape — public disclosure analog");
  } else {
    buyEv.push("Unlisted — no public financials for procurement theme");
  }
  if (input.sanctionsHit) {
    ethics -= 35;
    ethEv.push("UN / OpenSanctions hit on this name");
  }
  environment -= Math.min(24, envNews.length * 8);
  labor -= Math.min(24, labNews.length * 10);
  ethics -= Math.min(24, ethNews.length * 12);
  for (const n of envNews.slice(0, 2)) envEv.push(`News · ${n.title.slice(0, 72)}`);
  for (const n of labNews.slice(0, 2)) labEv.push(`News · ${n.title.slice(0, 72)}`);
  for (const n of ethNews.slice(0, 2)) ethEv.push(`News · ${n.title.slice(0, 72)}`);
  if (!envNews.length) envEv.push("No environment headlines on the RSS pass");
  if (!labNews.length) labEv.push("No labor headlines on the RSS pass");
  if (!ethNews.length && !input.sanctionsHit) ethEv.push("No ethics headlines or list hits");

  environment = clamp(environment);
  labor = clamp(labor);
  ethics = clamp(ethics);
  procurement = clamp(procurement);

  const score = clamp(
    (environment * ECOVADIS_WEIGHTS.environment +
      labor * ECOVADIS_WEIGHTS.labor +
      ethics * ECOVADIS_WEIGHTS.ethics +
      procurement * ECOVADIS_WEIGHTS.procurement) /
      100,
  );

  return {
    id: `EV-${slug(input.supplier)}`,
    supplier: input.supplier,
    po: input.po,
    lei: input.gleif?.lei,
    country: input.gleif?.country,
    score,
    medal: medalFor(score),
    themes: { environment, labor, ethics, procurement },
    weights: { ...ECOVADIS_WEIGHTS },
    evidence: { environment: envEv, labor: labEv, ethics: ethEv, procurement: buyEv },
    publishedAt: now,
    validUntil: valid.toISOString(),
    industry: "NACE 27 · Manufacture of electrical equipment",
    source: "EcoVadis 21-criteria analog · GLEIF + UN/OpenSanctions + news RSS + listing tape",
    issuer: "EcoVadis analog · VerityX host",
  };
}

export function ecovadisMethodology() {
  return {
    protocol: "EcoVadis scorecard analog",
    issuer: "EcoVadis analog · VerityX host",
    vendor: {
      subscribed: false,
      note: "EcoVadis is not a tenant here. This is the public 21-criteria / 4-theme methodology scored from GLEIF, UN/OpenSanctions, news RSS, and listing tape.",
    },
    industry: "NACE 27 · Manufacture of electrical equipment",
    weights: ECOVADIS_WEIGHTS,
    medals: ECOVADIS_MEDALS,
    criteria: ECOVADIS_CRITERIA,
    cadence: "Annual scorecard shape · 12-month validity window",
  };
}
