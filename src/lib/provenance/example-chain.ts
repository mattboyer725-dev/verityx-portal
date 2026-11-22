/**
 * The example chain on the home page: five lot passports, mine to magnet,
 * each sealed over its own content plus the digest of the lot it was made
 * from. Clearly an example — no real company published these.
 *
 * The digests below are what `passportDigest` produces for these bodies.
 * example-chain.test.ts recomputes them, and the home page recomputes them
 * in the visitor's browser when they press "Check the seals".
 */
import { analyzeChain, passportDigest, sha256Hex, type ChainNode, type PassportBody } from "./passport.ts";

const PUBLISHER = "Example publisher (not a real company)";

export type ExampleLot = PassportBody & {
  /** Plain-language place, as the hero shows it. */
  where: string;
  stageTitle: string;
};

/** Evidence fingerprints: SHA-256 of a stand-in file name, since there is no real file behind an example. */
async function evidence(name: string) {
  return [{ name, sha256: await sha256Hex(`verityx-example:${name}`), bytes: 0 }];
}

async function lots(): Promise<ExampleLot[]> {
  const base = { publisher: PUBLISHER, description: "" };
  return [
    {
      ...base,
      code: "LP-3HWD-A81F",
      lotRef: "CON-WA-2291",
      material: "concentrate",
      massKg: 1800,
      stageTitle: "Mined",
      where: "Rare-earth mine, Western Australia",
      stages: [{ stage: "mined", country: "AU", facility: "Rare-earth mine, Western Australia", operator: "", recycled: false, evidence: await evidence("mine-production-record.pdf") }],
      inputs: [],
    },
    {
      ...base,
      code: "LP-5NBX-QT2C",
      lotRef: "OX-NDPR-0917",
      material: "oxide",
      massKg: 640,
      stageTitle: "Separated",
      where: "Oxide separation plant, Pahang",
      stages: [{ stage: "separated", country: "MY", facility: "Oxide separation plant, Pahang", operator: "", recycled: false, evidence: await evidence("separation-batch-certificate.pdf") }],
      inputs: ["LP-3HWD-A81F"],
    },
    {
      ...base,
      code: "LP-8VRM-06KE",
      lotRef: "MET-NDPR-3340",
      material: "metal",
      massKg: 480,
      stageTitle: "Refined",
      where: "Metal refinery, Hai Phong",
      stages: [{ stage: "refined", country: "VN", facility: "Metal refinery, Hai Phong", operator: "", recycled: false, evidence: await evidence("refinery-assay.pdf") }],
      inputs: ["LP-5NBX-QT2C"],
    },
    {
      ...base,
      code: "LP-2GJP-YD7S",
      lotRef: "ALY-SC-5520",
      material: "alloy",
      massKg: 330,
      stageTitle: "Melted",
      where: "Alloy strip casting, Texas",
      stages: [{ stage: "melted", country: "US", facility: "Alloy strip casting, Texas", operator: "", recycled: false, evidence: await evidence("strip-cast-melt-log.pdf") }],
      inputs: ["LP-8VRM-06KE"],
    },
    {
      ...base,
      code: "LP-7K2M-9Q4R",
      lotRef: "MAG-N52-4471",
      material: "ndfeb_magnet",
      massKg: 300,
      description: "NdFeB magnet, N52",
      stageTitle: "Produced",
      where: "Sintered magnet plant, Indiana",
      stages: [{ stage: "produced", country: "US", facility: "Sintered magnet plant, Indiana", operator: "", recycled: false, evidence: await evidence("sintering-traveler.pdf") }],
      inputs: ["LP-2GJP-YD7S"],
    },
  ];
}

/** Sealed digests, upstream first. Recomputed by the test and in the browser. */
export const SEALED_DIGESTS: Record<string, string> = {
  "LP-3HWD-A81F": "dda82f589e4ef0d25e65482f0192117ce69f5b56665cc5e328ac1e4673e951b2",
  "LP-5NBX-QT2C": "f6cb8a132a995057f6fda0dcdcecd53d8d2761ffc1af65ce982df262ab73891f",
  "LP-8VRM-06KE": "f03d5324f1dd7b0fe15c87a5c4913a7faf6aea982e2edabef4da9fbbe4df87d2",
  "LP-2GJP-YD7S": "5e9928a7cbcb1675187250794dbc2e56b50a7777655feb5ed9920613598453fe",
  "LP-7K2M-9Q4R": "c0b32fb98ece342c92d4b765d582e359f6357d072f95487ee685a08ee8abc567",
};

/** Display data for first render (no hashing needed). Order: mine first. */
export const EXAMPLE_STAGES = [
  { code: "LP-3HWD-A81F", stage: "Mined", country: "AU", where: "Rare-earth mine, Western Australia", file: "mine-production-record.pdf" },
  { code: "LP-5NBX-QT2C", stage: "Separated", country: "MY", where: "Oxide separation plant, Pahang", file: "separation-batch-certificate.pdf" },
  { code: "LP-8VRM-06KE", stage: "Refined", country: "VN", where: "Metal refinery, Hai Phong", file: "refinery-assay.pdf" },
  { code: "LP-2GJP-YD7S", stage: "Melted", country: "US", where: "Alloy strip casting, Texas", file: "strip-cast-melt-log.pdf" },
  { code: "LP-7K2M-9Q4R", stage: "Produced", country: "US", where: "Sintered magnet plant, Indiana", file: "sintering-traveler.pdf" },
] as const;

export const EXAMPLE_ROOT = "LP-7K2M-9Q4R";

export type SealCheck = { code: string; ok: boolean; digest: string; evidence: string };

/** Recompute every digest in order, each sealed over its input's recomputed digest. */
export async function recomputeChain(): Promise<SealCheck[]> {
  const all = await lots();
  const digests: Record<string, string> = {};
  const out: SealCheck[] = [];
  for (const lot of all) {
    const digest = await passportDigest(lot, digests);
    digests[lot.code] = digest;
    out.push({ code: lot.code, ok: digest === SEALED_DIGESTS[lot.code], digest, evidence: lot.stages[0].evidence[0].sha256 });
  }
  return out;
}

/** What a buyer watching the magnet sees, with or without a revoked lot upstream. */
export async function exampleAnalysis(revoked: string | null) {
  const all = await lots();
  const nodes = new Map<string, ChainNode>(
    all.map((l) => [l.code, { ...l, status: l.code === revoked ? "revoked" : "sealed", digest: SEALED_DIGESTS[l.code] }]),
  );
  return analyzeChain(nodes.get(EXAMPLE_ROOT)!, (c) => nodes.get(c));
}
