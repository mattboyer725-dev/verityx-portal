export type MinespiderEvent = {
  seq: number;
  event: string;
  from: string;
  to: string;
  country: string;
  evidence: string;
  at: string;
  prev: string;
  hash: string;
};

export type MinespiderBatch = {
  batchId: string;
  lot: string;
  dppId: string;
  gs1: string;
  commodity: string;
  origin: string;
  massKg: number;
  events: MinespiderEvent[];
  certificate: {
    issuer: "Minespider analog · VerityX host";
    algorithm: "SHA-256";
    hash: string;
    issuedAt: string;
  };
  ts: string;
};

const BATCHES = new Map<string, MinespiderBatch>();
const enc = new TextEncoder();

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function listMinespiderBatches() {
  return [...BATCHES.values()].sort((a, b) => b.ts.localeCompare(a.ts));
}

export function getMinespiderBatch(batchId: string) {
  return BATCHES.get(batchId) || null;
}

export function getMinespiderByLot(lot: string) {
  for (const row of BATCHES.values()) if (row.lot === lot) return row;
  return null;
}

export function dumpMinespiderBatches() {
  return listMinespiderBatches();
}

export function loadMinespiderBatches(rows: MinespiderBatch[]) {
  BATCHES.clear();
  for (const row of rows) BATCHES.set(row.batchId, row);
}

export function __resetMinespiderForTests() {
  BATCHES.clear();
}

export async function recordMinespiderBatch(input: {
  id: string;
  po: string;
  lot: string;
  dppId: string;
  gs1: string;
  commodity: string;
  origin: string;
  massKg: number;
  events: { event: string; from: string; to: string; country: string; evidence: string; at: string }[];
}): Promise<MinespiderBatch> {
  const batchId = `MS-${input.id}-${input.po.slice(-8)}`;
  const existing = BATCHES.get(batchId);
  let prev = existing?.events.at(-1)?.hash || "GENESIS";
  const events: MinespiderEvent[] = [];
  for (let i = 0; i < input.events.length; i++) {
    const e = input.events[i];
    const body = `${batchId}|${i}|${e.from}|${e.to}|${e.at}|${prev}`;
    const hash = await sha256Hex(body);
    events.push({
      seq: i + 1,
      event: e.event,
      from: e.from,
      to: e.to,
      country: e.country,
      evidence: e.evidence,
      at: e.at,
      prev,
      hash,
    });
    prev = hash;
  }
  const issuedAt = new Date().toISOString();
  const certHash = await sha256Hex(`${batchId}|${prev}|${input.dppId}|${issuedAt}`);
  const rec: MinespiderBatch = {
    batchId,
    lot: input.lot,
    dppId: input.dppId,
    gs1: input.gs1,
    commodity: input.commodity,
    origin: input.origin,
    massKg: input.massKg,
    events,
    certificate: {
      issuer: "Minespider analog · VerityX host",
      algorithm: "SHA-256",
      hash: certHash,
      issuedAt,
    },
    ts: issuedAt,
  };
  BATCHES.set(batchId, rec);
  return rec;
}
