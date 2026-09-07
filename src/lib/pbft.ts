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

export type PbftEnvelope = {
  from: string;
  to: string;
  type: PbftVote["type"];
  view: number;
  seq: number;
  digest: string;
  mac: string;
  rttMs: number;
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
  network: {
    messages: number;
    maxRttMs: number;
    hops: ["pre-prepare", "prepare", "commit"];
  };
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
const ROUNDS: PbftRound[] = [];
let networkDelay = true;

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
  const jitter = networkDelay ? Math.floor(Math.random() * 11) : 0;
  const ms = base + jitter;
  lastRtt.set(node, ms);
  return ms;
}

function sleep(ms: number) {
  if (!networkDelay || ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, Math.min(ms, 40)));
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

async function deliver(from: string, to: string, v: PbftVote): Promise<PbftEnvelope> {
  const hop = rtt(to);
  await sleep(hop);
  return {
    from,
    to,
    type: v.type,
    view: v.view,
    seq: v.seq,
    digest: v.digest,
    mac: v.mac,
    rttMs: hop,
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
  const ppMail = await Promise.all(
    PBFT_NODES.filter((n) => n !== primary).map((n) => deliver(primary, n, prePrepare)),
  );
  const heardPrePrepare = new Set(ppMail.filter((m) => m.digest === digest).map((m) => m.to));
  heardPrePrepare.add(primary);

  const prepares = await Promise.all(
    PBFT_NODES.map((n) =>
      vote(n, "PREPARE", view, roundSeq, digest, honestOf(n) && heardPrePrepare.has(n)),
    ),
  );
  const prepareMail = await Promise.all(
    prepares
      .filter((v) => v.accepted)
      .flatMap((v) => PBFT_NODES.filter((n) => n !== v.node).map((n) => deliver(v.node, n, v))),
  );
  const prepareInbox = new Map<string, number>();
  for (const n of PBFT_NODES) prepareInbox.set(n, prepares.find((v) => v.node === n && v.digest === digest) ? 1 : 0);
  for (const m of prepareMail) {
    if (m.digest === digest) prepareInbox.set(m.to, (prepareInbox.get(m.to) || 0) + 1);
  }
  const prepareOk = prepares.filter((v) => v.digest === digest && v.accepted).length;
  const canCommit = (n: string) => honestOf(n) && (prepareInbox.get(n) || 0) >= PBFT_QUORUM;

  const commits = await Promise.all(
    PBFT_NODES.map((n) => vote(n, "COMMIT", view, roundSeq, digest, canCommit(n))),
  );
  const commitMail = await Promise.all(
    commits
      .filter((v) => v.accepted)
      .flatMap((v) => PBFT_NODES.filter((n) => n !== v.node).map((n) => deliver(v.node, n, v))),
  );
  const commitOk = commits.filter((v) => v.digest === digest && v.accepted).length;
  for (const n of PBFT_NODES) lastSeq.set(n, roundSeq);

  const messages = ppMail.length + prepareMail.length + commitMail.length;
  const maxRttMs = Math.max(
    prePrepare.rttMs,
    ...prepares.map((v) => v.rttMs),
    ...commits.map((v) => v.rttMs),
    0,
  );

  const round: PbftRound = {
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
    network: {
      messages,
      maxRttMs,
      hops: ["pre-prepare", "prepare", "commit"],
    },
  };
  ROUNDS.unshift(round);
  if (ROUNDS.length > 24) ROUNDS.length = 24;
  return round;
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
  const byz = new Set(round?.byzantine || ROUNDS[0]?.byzantine || []);
  const committed = round?.committed ?? ROUNDS[0]?.committed ?? false;
  return PBFT_NODES.map((node) => ({
    node,
    iata: IATA[node] || node.slice(0, 3).toUpperCase(),
    lastSeq: lastSeq.get(node) || 0,
    rttMs: lastRtt.get(node) || 12,
    status: byz.has(node) ? "BYZANTINE" : committed ? "COMMITTED" : "PREPARE",
  }));
}

export function lastPbftRound() {
  return ROUNDS[0] || null;
}

export function dumpPbftRounds() {
  return ROUNDS.slice(0, 16);
}

export function loadPbftRounds(rows: PbftRound[]) {
  ROUNDS.length = 0;
  ROUNDS.push(...rows);
  seq = Math.max(seq, ...rows.map((r) => r.seq), 0);
  for (const r of rows) {
    for (const n of PBFT_NODES) lastSeq.set(n, Math.max(lastSeq.get(n) || 0, r.seq));
  }
}

export function pbftSeq() {
  return seq;
}

export function __setPbftNetworkDelay(on: boolean) {
  networkDelay = on;
}

export function __resetPbftForTests() {
  seq = 0;
  lastRtt.clear();
  lastSeq.clear();
  ROUNDS.length = 0;
  networkDelay = false;
}
