import { getSql } from "@/lib/db";
import {
  dumpLog,
  ensureGenesis,
  loadLog,
  type CoreEvent,
} from "@/lib/core-ledger";

let ready = false;

function rowToEvent(r: Record<string, unknown>): CoreEvent {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(r.payload ?? "{}")) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return {
    event_id: String(r.event_id),
    event_type: r.event_type as CoreEvent["event_type"],
    payload,
    actor: String(r.actor),
    timestamp: Number(r.timestamp),
    prev_hash: String(r.prev_hash),
    signature: String(r.signature),
    hash: String(r.hash),
  };
}

export async function hydrateCoreLedger() {
  if (ready && dumpLog().length) return;
  try {
    const sql = await Promise.race([
      getSql(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    if (sql) {
      const rows = await sql<Record<string, unknown>>`select * from core_events order by timestamp asc`;
      if (rows.length) {
        loadLog(rows.map(rowToEvent));
        ready = true;
        return;
      }
    }
  } catch {
    /* table may not exist yet in a fresh preview */
  }
  await ensureGenesis();
  void persistCoreLedger();
  ready = true;
}

export async function persistCoreLedger() {
  try {
    const sql = await getSql();
    for (const e of dumpLog()) {
      const payload = JSON.stringify(e.payload);
      await sql`
        insert into core_events (event_id, event_type, payload, actor, timestamp, prev_hash, signature, hash)
        values (
          ${e.event_id}, ${e.event_type}, ${payload}, ${e.actor}, ${e.timestamp},
          ${e.prev_hash}, ${e.signature}, ${e.hash}
        )
        on conflict (event_id) do nothing
      `;
    }
  } catch {
    /* best-effort on PGLite/Neon */
  }
}
