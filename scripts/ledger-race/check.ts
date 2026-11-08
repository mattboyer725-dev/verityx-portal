// Ledger race test: after the writers, the durable chain must have one genesis and verify.
import { refreshLedger } from "../../src/lib/core-store.server";
import { verifyChain, dumpLog } from "../../src/lib/core-ledger";
await refreshLedger();
const v = await verifyChain();
const log = dumpLog();
const geneses = log.filter((e) => /^0+$/.test(e.prev_hash)).length;
const expected = Number(process.argv[2] || 0);
console.log({ events: log.length, expected, geneses, chainOk: v.ok });
process.exit(v.ok && geneses === 1 && (!expected || log.length === expected) ? 0 : 1);
