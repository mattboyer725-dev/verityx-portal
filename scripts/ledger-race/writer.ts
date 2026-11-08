// Ledger race test: one of several concurrent processes appending through withLedger().
// Run by .github/workflows/ledger-race.yml against a real Postgres.
import { withLedger } from "../../src/lib/core-store.server";
import { appendCoreEvent, appendCoreEvents } from "../../src/lib/core-ledger";
const me = process.argv[2] ?? "?";
let ok = 0, fail = 0;
await Promise.all(Array.from({ length: 5 }, async (_, i) => {
  try {
    await withLedger(async () => {
      await appendCoreEvents([
        { type: "artifact.record", payload: { title: `w${me}-${i}`, location: "x", kind: "file" }, actor: `w${me}` },
        { type: "decision.record", payload: { title: `w${me}-${i}`, choice: "HOLD", context: "c" }, actor: `w${me}` },
      ]);
    });
    ok++;
  } catch (e) { fail++; console.error(me, (e as Error).message); }
}));
console.log(`writer ${me}: ok ${ok} fail ${fail}`);
process.exit(0);
