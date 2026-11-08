/**
 * Durable Local Core ledger.
 *
 * With DATABASE_URL set, Postgres is the source of truth and every server
 * instance is a client of it. Every write goes through withLedger():
 *
 *   BEGIN
 *   pg_advisory_xact_lock(LEDGER_LOCK)      one writer across all instances
 *   load the whole chain (order by seq)     never trust an instance's memory
 *   genesis if empty, then fn() appends      in memory, chained to the true tip
 *   insert only the new events              unique(prev_hash) rejects any fork
 *   COMMIT
 *
 * If the database cannot be reached the write FAILS — it never starts a
 * private chain in memory (that is how a fork was made once). Reads use
 * refreshLedger(), which loads the chain without the write lock.
 *
 * Without DATABASE_URL (local preview on PGLite) the ledger is in-process and
 * a local mutex is enough.
 */
import { getSql, withDbClient } from "@/lib/db";
import { dumpLog, ensureGenesis, replaceLog, type CoreEvent } from "@/lib/core-ledger";

const LEDGER_LOCK = 74188202;
const durable = () => typeof process !== "undefined" && !!process.env.DATABASE_URL?.trim();

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

const SELECT_CHAIN =
  "select event_id, event_type, payload, actor, timestamp, prev_hash, signature, hash from core_events order by seq asc";

// The in-memory log is shared by every request in this process: serialize.
let local: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = local.then(fn, fn);
  local = next.catch(() => undefined);
  return next;
}

/** Lock, load the true chain, run fn, insert only new events, commit. Caller holds `local`. */
async function lockedWrite<T>(fn: () => Promise<T>): Promise<T> {
  const out = await withDbClient(async (q) => {
    await q("begin");
    try {
      await q("select pg_advisory_xact_lock($1)", [LEDGER_LOCK]);
      const rows = await q(SELECT_CHAIN);
      replaceLog(rows.map(rowToEvent));
      const known = new Set(rows.map((r) => String(r.event_id)));
      await ensureGenesis();
      const result = await fn();
      for (const e of dumpLog()) {
        if (known.has(e.event_id)) continue;
        await q(
          `insert into core_events (event_id, event_type, payload, actor, timestamp, prev_hash, signature, hash)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [e.event_id, e.event_type, JSON.stringify(e.payload), e.actor, e.timestamp, e.prev_hash, e.signature, e.hash],
        );
      }
      await q("commit");
      return { result };
    } catch (err) {
      await q("rollback").catch(() => undefined);
      // Memory may now hold events that were not committed: drop them.
      replaceLog([]);
      throw err;
    }
  });
  if (!out) throw new Error("durable ledger unavailable");
  return out.result;
}

/** Run ledger writes against the one true chain. Throws if the durable store is unreachable. */
export function withLedger<T>(fn: () => Promise<T>): Promise<T> {
  return serial(async () => {
    if (!durable()) {
      await ensureGenesis();
      return fn();
    }
    return lockedWrite(fn);
  });
}

/** Load the current chain for reading (status pages, snapshots). Writes only a genesis, and only under the lock. */
export function refreshLedger(): Promise<void> {
  return serial(async () => {
    if (!durable()) {
      await ensureGenesis();
      return;
    }
    const sql = await getSql();
    const rows = await sql.query<Record<string, unknown>>(SELECT_CHAIN);
    if (rows.length) replaceLog(rows.map(rowToEvent));
    else await lockedWrite(async () => undefined);
  });
}

/** @deprecated kept for older call sites: reads go through refreshLedger(). */
export const hydrateCoreLedger = refreshLedger;
