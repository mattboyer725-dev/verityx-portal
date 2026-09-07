import { getSql } from "@/lib/db";
import { dumpCirculorLots, loadCirculorLots, type CirculorLot } from "@/lib/circulor";
import { dumpMinespiderBatches, loadMinespiderBatches, type MinespiderBatch } from "@/lib/minespider";
import { dumpPbftRounds, loadPbftRounds, type PbftRound } from "@/lib/pbft";
import { dumpSapState, loadSapState } from "@/lib/sap";

let ready = false;

export async function hydrateAdapters() {
  if (ready) return;
  try {
    const sql = await Promise.race([
      getSql(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200)),
    ]);
    if (!sql) {
      ready = true;
      return;
    }
    const [pos, wbs, rounds, lots, rfqs, batches] = await Promise.all([
      sql<Record<string, unknown>>`select payload from sap_pos`,
      sql<Record<string, unknown>>`select payload from sap_writebacks order by ts desc limit 80`,
      sql<Record<string, unknown>>`select payload from pbft_rounds order by seq desc limit 16`,
      sql<Record<string, unknown>>`select payload from circulor_lots`,
      sql<Record<string, unknown>>`select payload from sap_rfqs`,
      sql<Record<string, unknown>>`select payload from minespider_batches`,
    ]);
    loadSapState({
      pos: pos.map((r) => JSON.parse(String(r.payload))),
      writebacks: wbs.map((r) => JSON.parse(String(r.payload))),
      rfqs: rfqs.map((r) => JSON.parse(String(r.payload))),
    });
    loadPbftRounds(rounds.map((r) => JSON.parse(String(r.payload)) as PbftRound));
    loadCirculorLots(lots.map((r) => JSON.parse(String(r.payload)) as CirculorLot));
    loadMinespiderBatches(batches.map((r) => JSON.parse(String(r.payload)) as MinespiderBatch));
  } catch {
    /* tables may not exist yet */
  }
  ready = true;
}

export async function persistAdapters() {
  try {
    const sql = await getSql();
    const sap = dumpSapState();
    for (const po of sap.pos) {
      const payload = JSON.stringify(po);
      await sql`
        insert into sap_pos (purchase_order, payload, updated_at)
        values (${po.PurchaseOrder}, ${payload}, now())
        on conflict (purchase_order) do update set payload = ${payload}, updated_at = now()
      `;
    }
    for (const rfq of sap.rfqs) {
      const payload = JSON.stringify(rfq);
      await sql`
        insert into sap_rfqs (event_id, po, payload, updated_at)
        values (${rfq.eventId}, ${rfq.po}, ${payload}, now())
        on conflict (event_id) do update set payload = ${payload}, po = ${rfq.po}, updated_at = now()
      `;
    }
    for (const wb of sap.writebacks) {
      const payload = JSON.stringify(wb);
      await sql`
        insert into sap_writebacks (id, po, payload, ts)
        values (${wb.doc}, ${wb.po}, ${payload}, ${wb.ts})
        on conflict (id) do nothing
      `;
    }
    for (const round of dumpPbftRounds()) {
      const payload = JSON.stringify(round);
      await sql`
        insert into pbft_rounds (seq, digest, committed, payload, ts)
        values (${round.seq}, ${round.digest}, ${round.committed}, ${payload}, ${round.ts})
        on conflict (seq) do nothing
      `;
    }
    for (const lot of dumpCirculorLots()) {
      const payload = JSON.stringify(lot);
      await sql`
        insert into circulor_lots (lot, payload, updated_at)
        values (${lot.lot}, ${payload}, now())
        on conflict (lot) do update set payload = ${payload}, updated_at = now()
      `;
    }
    for (const batch of dumpMinespiderBatches()) {
      const payload = JSON.stringify(batch);
      await sql`
        insert into minespider_batches (batch_id, lot, payload, updated_at)
        values (${batch.batchId}, ${batch.lot}, ${payload}, now())
        on conflict (batch_id) do update set payload = ${payload}, lot = ${batch.lot}, updated_at = now()
      `;
    }
  } catch {
    /* best-effort */
  }
}
