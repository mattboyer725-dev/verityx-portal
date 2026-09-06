const enc = new TextEncoder();

export const PBFT_NODES = [
  "Hamburg",
  "Brande",
  "Hull",
  "Zamudio",
  "Cuxhaven",
  "Aalborg",
  "LeHavre",
  "Madrid",
  "Oslo",
  "Stockholm",
  "Helsinki",
  "Warsaw",
  "Prague",
  "Vienna",
  "Zurich",
  "Milan",
  "Paris",
  "London",
  "Dublin",
  "Lisbon",
  "Athens",
  "Bucharest",
  "Sofia",
  "Tallinn",
  "Riga",
  "Vilnius",
  "Luxembourg",
] as const;

export const PBFT_N = PBFT_NODES.length; // 27
export const PBFT_F = Math.floor((PBFT_N - 1) / 3); // 8
export const PBFT_QUORUM = 2 * PBFT_F + 1; // 19

export type PbftVote = {
  node: string;
  type: "PRE-PREPARE" | "PREPARE" | "COMMIT";
  view: number;
  seq: number;
  digest: string;
  mac: string;
  rttMs: number;
  honest: boolean;
  accepted: boolean;
};

export type PbftRound = {
  agent: "SEAL";
  algorithm: "PBFT";
  n: number;
  f: number;
  quorum: number;
  view: number;
  seq: number;
  digest: string;
  primary: string;
  byzantine: string[];
  prePrepare: PbftVote;
  prepares: PbftVote[];
  commits: PbftVote[];
  prepareOk: number;
  commitOk: number;
  committed: boolean;
  ts: string;
};

export type ClusterNode = {
  node: string;
  iata: string;
  lastSeq: number;
  rttMs: number;
  status: "COMMITTED" | "PREPARE" | "BYZANTINE" | "LAG";
};

let seq = 0;
const seed = "verityx-pbft-cluster-v8";
const lastRtt = new Map<string, number>();
const lastSeq = new Map<string, number>();

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nodeKey(node: string) {
  return `${seed}:${node}`;
}

function rtt(node: string) {
  const base = 8 + (node.charCodeAt(0) % 17) + (node.length % 9);
  const jitter = Math.floor(Math.random() * 11);
  const ms = base + jitter;
  lastRtt.set(node, ms);
  return ms;
}

async function vote(
  node: string,
  type: PbftVote["type"],
  view: number,
  s: number,
  digest: string,
  honest: boolean,
): Promise<PbftVote> {
  const d = honest ? digest : await sha256Hex(digest + ":equivocate:" + node);
  const body = `${type}|${view}|${s}|${d}|${node}`;
  return {
    node,
    type,
    view,
    seq: s,
    digest: d,
    mac: await hmacHex(nodeKey(node), body),
    rttMs: rtt(node),
    honest,
    accepted: honest,
  };
}

export async function runPbft(payload: string): Promise<PbftRound> {
  const view = 0;
  const roundSeq = ++seq;
  const digest = await sha256Hex(payload);
  const primary = PBFT_NODES[roundSeq % PBFT_N];
  const byzIdx = [(roundSeq * 7) % PBFT_N, (roundSeq * 13 + 5) % PBFT_N].filter((i) => PBFT_NODES[i] !== primary);
  const byzantine = [...new Set(byzIdx.map((i) => String(PBFT_NODES[i])))].slice(0, 2);
  const honestOf = (n: string) => !byzantine.includes(n);

  const prePrepare = await vote(primary, "PRE-PREPARE", view, roundSeq, digest, true);
  const prepares = await Promise.all(
    PBFT_NODES.map((n) => vote(n, "PREPARE", view, roundSeq, digest, honestOf(n))),
  );
  const prepareOk = prepares.filter((v) => v.digest === digest && v.accepted).length;
  const canCommit = prepareOk >= PBFT_QUORUM;
  const commits = await Promise.all(
    PBFT_NODES.map((n) => vote(n, "COMMIT", view, roundSeq, digest, honestOf(n) && canCommit)),
  );
  const commitOk = commits.filter((v) => v.digest === digest && v.accepted).length;
  for (const n of PBFT_NODES) lastSeq.set(n, roundSeq);

  return {
    agent: "SEAL",
    algorithm: "PBFT",
    n: PBFT_N,
    f: PBFT_F,
    quorum: PBFT_QUORUM,
    view,
    seq: roundSeq,
    digest,
    primary,
    byzantine,
    prePrepare,
    prepares,
    commits,
    prepareOk,
    commitOk,
    committed: prepareOk >= PBFT_QUORUM && commitOk >= PBFT_QUORUM,
    ts: new Date().toISOString(),
  };
}

const IATA: Record<string, string> = {
  Hamburg: "HAM",
  Brande: "BLL",
  Hull: "HUY",
  Zamudio: "BIO",
  Cuxhaven: "FCN",
  Aalborg: "AAL",
  LeHavre: "LEH",
  Madrid: "MAD",
  Oslo: "OSL",
  Stockholm: "ARN",
  Helsinki: "HEL",
  Warsaw: "WAW",
  Prague: "PRG",
  Vienna: "VIE",
  Zurich: "ZRH",
  Milan: "MXP",
  Paris: "CDG",
  London: "LHR",
  Dublin: "DUB",
  Lisbon: "LIS",
  Athens: "ATH",
  Bucharest: "OTP",
  Sofia: "SOF",
  Tallinn: "TLL",
  Riga: "RIX",
  Vilnius: "VNO",
  Luxembourg: "LUX",
};

export function clusterSnapshot(round?: PbftRound): ClusterNode[] {
  const byz = new Set(round?.byzantine || []);
  return PBFT_NODES.map((node) => ({
    node,
    iata: IATA[node] || node.slice(0, 3).toUpperCase(),
    lastSeq: lastSeq.get(node) || 0,
    rttMs: lastRtt.get(node) || 12,
    status: byz.has(node) ? "BYZANTINE" : round?.committed ? "COMMITTED" : "PREPARE",
  }));
}
