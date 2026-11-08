import { useQuery } from "@tanstack/react-query";
import { Spark } from "@/components/spark";
import { DRIVER_LABEL, type DriftReport, type Driver, type Snapshot } from "@/lib/price-history";

type Payload = { series: Snapshot[]; report: DriftReport };

export function usePriceHistory() {
  return useQuery({
    queryKey: ["price-history"],
    queryFn: async (): Promise<Payload> => {
      const r = await fetch("/api/prices?days=30");
      if (!r.ok) throw new Error("history unavailable");
      return r.json();
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

/** Banner over the PO list when an open order's should-cost drivers moved past the threshold. */
export function DriftBanner() {
  const q = usePriceHistory();
  const r = q.data?.report;
  if (!r || !r.alerts.length) return null;
  return (
    <div className="drift-banner" role="status">
      <strong>
        {r.alerts.length} open PO{r.alerts.length > 1 ? "s" : ""}: the market moved {r.thresholdPct}%+ since the history baseline — re-check.
      </strong>
      <span>
        {r.alerts
          .map((a) => `${a.order.po} ${a.moves.map((m) => `${DRIVER_LABEL[m.driver].split(" (")[0]} ${signed(m.changePct)}`).join(", ")}`)
          .join(" · ")}
      </span>
    </div>
  );
}

export function PriceHistoryPanel() {
  const q = usePriceHistory();
  if (q.isLoading) return <p className="sc-note">Loading price history…</p>;
  if (q.isError || !q.data) return <p className="sc-note">Price history is unavailable right now.</p>;
  const { series, report } = q.data;
  const drivers: Driver[] = ["ndpr", "dy", "cu", "usdEur"];
  return (
    <div className="ph-panel">
      <div className="vx-label">Price history · 30 days</div>
      <p className="sc-note">
        {report.snapshots} live snapshot{report.snapshots === 1 ? "" : "s"} from {day(report.historyFrom)} to {day(report.historyTo)}. Feeds on
        standby leave gaps; nothing is filled in.
      </p>
      <div className="ph-grid">
        {drivers.map((d) => {
          const vals = series.map((s) => s[d]).filter((v): v is number => typeof v === "number");
          const move = report.moves.find((m) => m.driver === d);
          return (
            <div className="score-card" key={d}>
              <div className="k">{DRIVER_LABEL[d]}</div>
              <div className="v">{vals.length ? vals[vals.length - 1].toLocaleString("en-GB", { maximumFractionDigits: d === "usdEur" ? 4 : 1 }) : "—"}</div>
              <div className="s">{move ? `${signed(move.changePct)} since ${day(move.fromAt)}` : "not enough history yet"}</div>
              <Spark values={vals.slice(-60)} />
            </div>
          );
        })}
      </div>
      {!report.enoughHistory ? (
        <p className="sc-note">Drift alerts start once the history is at least a day deep.</p>
      ) : report.alerts.length ? (
        <div className="ph-alerts">
          {report.alerts.map((a) => (
            <div className="screen-row" key={a.order.id}>
              <span>
                {a.order.po} · {a.order.title}
              </span>
              <span className="mono">{a.moves.map((m) => `${DRIVER_LABEL[m.driver].split(" (")[0]} ${signed(m.changePct)}`).join(" · ")}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="sc-note">No open PO’s price drivers moved {report.thresholdPct}% or more.</p>
      )}
    </div>
  );
}
