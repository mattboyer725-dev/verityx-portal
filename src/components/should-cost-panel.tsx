import { useMemo, useState } from "react";
import {
  checkQuote,
  DEFAULT_ASSUMPTIONS,
  modelFor,
  shouldCost,
  type Assumption,
  type LivePrices,
} from "@/lib/should-cost";
import { shouldCostPrices } from "@/lib/engine";
import type { LiveBundle } from "@/lib/feeds";

type Tape = Partial<LiveBundle> | null;

/** Licensed reference prices with their basis; a source that is down contributes nothing, so the model says "standby". */
export function livePricesFromTape(t: Tape): LivePrices {
  return shouldCostPrices((t ?? undefined) as LiveBundle | undefined);
}

const fmt = (n: number, cur: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);

export function ShouldCostPanel({
  commodity,
  quoteTotal,
  quoteCurrency,
  tape,
  initialQuantityKg,
}: {
  commodity: string;
  quoteTotal: number;
  quoteCurrency: string;
  tape: Tape;
  initialQuantityKg?: number;
}) {
  const model = modelFor(commodity);
  const [edits, setEdits] = useState<Assumption[] | null>(null);
  const [qty, setQty] = useState(initialQuantityKg ? String(initialQuantityKg) : "");
  const assumptions = edits ?? (model ? DEFAULT_ASSUMPTIONS[model] : []);
  const prices = livePricesFromTape(tape);
  const sc = useMemo(() => shouldCost(commodity, prices, edits ?? undefined), [commodity, prices.ndprOxideUsdKg, prices.dyOxideUsdKg, prices.copperUsdT, prices.usdEur, edits]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sc.ok) {
    return (
      <div className="sc-panel">
        <div className="vx-label">Should-cost</div>
        <p className="sc-note">{sc.reason}</p>
      </div>
    );
  }

  const kg = Number(qty.replace(/[^0-9.]/g, ""));
  const sameCurrency = sc.currency === quoteCurrency;
  const check = sameCurrency ? checkQuote(sc, kg, quoteTotal) : null;

  const setBand = (key: string, at: "low" | "mid" | "high", raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setEdits(assumptions.map((a) => (a.key === key ? { ...a, band: { ...a.band, [at]: n } } : a)));
  };

  return (
    <div className="sc-panel">
      <div className="vx-label">Should-cost · {sc.title}</div>
      <div className="sc-range">
        <div>
          <div className="k">Fair price per kg</div>
          <div className="v">
            {fmt(sc.perKg.low, sc.currency)} – {fmt(sc.perKg.high, sc.currency)}
          </div>
          <div className="s">mid {fmt(sc.perKg.mid, sc.currency)}{sc.indicative ? " · indicative" : ""}</div>
        </div>
      </div>

      <label className="sc-qty">
        <span>Quantity on this PO (kg)</span>
        <input className="vx-input" inputMode="decimal" placeholder="e.g. 60000" value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>

      {!sameCurrency ? (
        <p className="sc-note">The quote is in {quoteCurrency}; the should-cost is in {sc.currency} because the FX feed is on standby. No comparison is made.</p>
      ) : check ? (
        <div className={`sc-verdict sc-${check.verdict.toLowerCase()}`} role="status">
          <strong>
            {check.verdict === "ABOVE_RANGE"
              ? `Quote is ${check.vsMidPct}% above the mid should-cost`
              : check.verdict === "BELOW_RANGE"
                ? `Quote is ${Math.abs(check.vsMidPct)}% below the mid should-cost`
                : `Quote is inside the fair range (${check.vsMidPct > 0 ? "+" : ""}${check.vsMidPct}% vs mid)`}
          </strong>
          <span>
            Fair total {fmt(check.fairTotal.low, sc.currency)} – {fmt(check.fairTotal.high, sc.currency)} · quote {fmt(quoteTotal, quoteCurrency)}
            {check.overHigh > 0 ? ` · ${fmt(check.overHigh, sc.currency)} above the top of the range` : ""}
            {check.verdict === "BELOW_RANGE" ? " · check quality, spec and delivery terms" : ""}
          </span>
        </div>
      ) : (
        <p className="sc-note">Enter the quantity to compare the {fmt(quoteTotal, quoteCurrency)} quote against the fair range.</p>
      )}

      <div className="sc-table" role="table" aria-label="Cost build-up at the mid assumptions">
        {sc.breakdownMid.map((l) => (
          <div className="screen-row" role="row" key={l.label}>
            <span role="cell">{l.label}</span>
            <span role="cell" className="mono">
              {fmt(l.usdPerKg, sc.currency)}/kg
            </span>
          </div>
        ))}
      </div>

      <details className="sc-assume">
        <summary>Assumptions — edit to match your contracts</summary>
        <div className="sc-assume-head" aria-hidden="true">
          <span />
          <span>low</span>
          <span>mid</span>
          <span>high</span>
        </div>
        <div key={edits ? "edited" : "defaults"}>
        {assumptions.map((a) => (
          <div className="sc-assume-row" key={a.key}>
            <span title={a.note}>
              {a.label}
              <small>{a.unit}</small>
            </span>
            {(["low", "mid", "high"] as const).map((at) => (
              <input
                key={at}
                className="vx-input"
                inputMode="decimal"
                aria-label={`${a.label} ${at}`}
                defaultValue={a.band[at]}
                onBlur={(e) => setBand(a.key, at, e.target.value)}
              />
            ))}
          </div>
        ))}
        </div>
        {edits ? (
          <button type="button" className="vx-btn vx-btn-ghost" onClick={() => setEdits(null)}>
            Reset to defaults
          </button>
        ) : null}
      </details>

      <p className="sc-note">
        Prices used: {sc.basis.map((b) => b.label).join(" · ")}. {sc.caveat}
      </p>
    </div>
  );
}
