import { recordMinespiderBatch, __resetMinespiderForTests } from "./minespider.ts";

export type CirculorEvent = {
  seq: number;
  event: "WEIGHBRIDGE" | "ASSAY" | "TRANSFORM" | "HANDOFF" | "RECEIPT";
  from: string;
  to: string;
  country: string;
  lat: number;
  lng: number;
  massKg: number;
  evidence: string;
  at: string;
  hash: string;
};

export type CirculorLot = {
  lot: string;
  dppId: string;
  gs1: string;
  minespiderBatch: string;
  commodity: string;
  origin: string;
  massKg: number;
  balanceKg: number;
  events: CirculorEvent[];
  ts: string;
};

const LOTS = new Map<string, CirculorLot>();
const enc = new TextEncoder();

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function eventKind(role: string): CirculorEvent["event"] {
  if (/mine|pit|weigh/i.test(role)) return "WEIGHBRIDGE";
  if (/separat|assay|mill/i.test(role)) return "ASSAY";
  if (/alloy|metal|oem|magnet/i.test(role)) return "TRANSFORM";
  if (/plant|receipt|oem plant/i.test(role)) return "RECEIPT";
  return "HANDOFF";
}

export function listCirculorLots() {
  return [...LOTS.values()].sort((a, b) => b.ts.localeCompare(a.ts));
}

export function getCirculorLot(lot: string) {
  return LOTS.get(lot) || null;
}

export function dumpCirculorLots() {
  return listCirculorLots();
}

export function loadCirculorLots(rows: CirculorLot[]) {
  LOTS.clear();
  for (const row of rows) LOTS.set(row.lot, row);
}

export function __resetCirculorForTests() {
  LOTS.clear();
  __resetMinespiderForTests();
}

export async function recordCirculorLot(input: {
  id: string;
  po: string;
  commodity: string;
  plant?: string;
  tiers: { role: string; name: string; country: string; evidence: string; lat: number; lng: number }[];
}): Promise<CirculorLot> {
  const lot = `CIR-SGRE-${input.po.slice(-8)}`;
  const existing = LOTS.get(lot);
  const massKg = 1000 + (Number(input.po.slice(-4)) % 800);
  const now = Date.now();
  const events: CirculorEvent[] = [];
  let prev = existing?.events.at(-1)?.hash || "GENESIS";
  for (let i = 0; i < input.tiers.length; i++) {
    const t = input.tiers[i];
    const next = input.tiers[i + 1];
    const at = new Date(now - (input.tiers.length - i) * 86400000 * 11).toISOString();
    const body = `${lot}|${i}|${t.name}|${at}|${prev}`;
    const hash = await sha256Hex(body);
    events.push({
      seq: i + 1,
      event: eventKind(t.role),
      from: t.name,
      to: next?.name || input.plant || "Siemens Gamesa",
      country: t.country,
      lat: t.lat,
      lng: t.lng,
      massKg,
      evidence: t.evidence,
      at,
      hash,
    });
    prev = hash;
  }
  const rec: CirculorLot = {
    lot,
    dppId: `dpp:eu:sgre:${input.id.toLowerCase()}:${input.po.slice(-8)}`,
    gs1: `https://id.gs1.org/01/04012345678901/21/${input.po.slice(-8)}`,
    minespiderBatch: `MS-${input.id}-${input.po.slice(-8)}`,
    commodity: input.commodity,
    origin: input.tiers[0]?.country || "UNDECLARED",
    massKg,
    balanceKg: massKg,
    events,
    ts: new Date().toISOString(),
  };
  const batch = await recordMinespiderBatch({
    id: input.id,
    po: input.po,
    lot,
    dppId: rec.dppId,
    gs1: rec.gs1,
    commodity: rec.commodity,
    origin: rec.origin,
    massKg,
    events: rec.events.map((e) => ({
      event: e.event,
      from: e.from,
      to: e.to,
      country: e.country,
      evidence: e.evidence,
      at: e.at,
    })),
  });
  rec.minespiderBatch = batch.batchId;
  LOTS.set(lot, rec);
  return rec;
}
