import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { checkCustomQuote } from "@/lib/live-api";
import { sealQuoteCheck } from "@/lib/verityx/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { QuoteAssessment } from "@/lib/quote-check";
import { modelFor } from "@/lib/should-cost";

export const Route = createFileRoute("/check")({
  head: () => ({ meta: [{ title: "Check a quote · VerityX" }] }),
  component: CheckPage,
});

const COMMODITIES = ["NdFeB magnet", "NdPr alloy", "Dy metal", "Cu CTC", "Other"] as const;

const money = (n: number, cur: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

const tone: Record<QuoteAssessment["verdict"], string> = {
  PROCEED: "border-ok/50 bg-ok/10 text-ok",
  REVIEW: "border-warn/50 bg-warn/10 text-warn",
  HOLD: "border-bad/50 bg-bad/10 text-bad",
};

const verdictWord: Record<QuoteAssessment["verdict"], string> = {
  PROCEED: "Proceed — no flags",
  REVIEW: "Review before ordering",
  HOLD: "Hold — a person should look first",
};

type Sealed = Awaited<ReturnType<typeof sealQuoteCheck>>;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-paper">{label}</span>
      {children}
      {hint ? <span className="text-xs text-mute">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "h-11 w-full rounded-[8px] border border-line bg-ink/60 px-3 text-paper placeholder:text-mute/70 focus:border-gold focus:outline-none";

function CheckPage() {
  const { user } = useCurrentUserState();
  const [form, setForm] = useState({
    supplier: "",
    commodity: "NdFeB magnet" as string,
    other: "",
    quantityKg: "",
    quoteTotal: "",
    currency: "EUR",
    poNumber: "",
    otherPrices: "",
    benchSource: "",
    benchNdpr: "",
    benchDy: "",
    benchCu: "",
  });
  const model = modelFor(form.commodity === "Other" ? form.other : form.commodity);
  const needs = {
    ndpr: model === "ndfeb" || model === "ndpr-alloy",
    dy: model === "ndfeb" || model === "dy-metal",
    cu: model === "copper-ctc",
  };
  const num = (v: string) => (v.trim() ? Number(v.replace(/[, ]/g, "")) : undefined);
  const [busy, setBusy] = useState<"" | "check" | "seal">("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState<QuoteAssessment | null>(null);
  const [sealed, setSealed] = useState<Sealed | null>(null);

  const payload = () => ({
    supplier: form.supplier,
    commodity: form.commodity === "Other" ? form.other : form.commodity,
    quantityKg: Number(form.quantityKg.replace(/[, ]/g, "")),
    quoteTotal: Number(form.quoteTotal.replace(/[, ]/g, "")),
    currency: form.currency,
    poNumber: form.poNumber,
    otherPrices: form.otherPrices
      .split(/[\n;]+|,(?=\s)/)
      .map((x) => x.replace(/[^0-9.]/g, ""))
      .filter(Boolean)
      .map(Number),
    ...(form.benchSource.trim() || form.benchNdpr || form.benchDy || form.benchCu
      ? {
          benchmark: {
            source: form.benchSource,
            ...(needs.ndpr ? { ndprOxideUsdKg: num(form.benchNdpr) } : {}),
            ...(needs.dy ? { dyOxideUsdKg: num(form.benchDy) } : {}),
            ...(needs.cu ? { copperUsdT: num(form.benchCu) } : {}),
          },
        }
      : {}),
  });

  async function run() {
    setBusy("check");
    setErr("");
    setSealed(null);
    try {
      setResult(await checkCustomQuote({ data: payload() }));
    } catch (e) {
      setResult(null);
      setErr(e instanceof Error ? e.message : "The check could not run. Try again.");
    }
    setBusy("");
  }

  async function seal() {
    setBusy("seal");
    setErr("");
    try {
      const s = await sealQuoteCheck({ data: payload() });
      setSealed(s);
      setResult(s.assessment);
    } catch (e) {
      setErr(e instanceof Error ? `Not sealed: ${e.message}` : "Not sealed. Try again.");
    }
    setBusy("");
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const sc = result?.shouldCost;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-6 pt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">Check a quote</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.02] tracking-tight sm:text-6xl">
          Is this price fair, and is this supplier who they say they are?
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute">
          Enter one purchase order. VerityX prices it from what the material is made of, compares it with any other prices
          you have, and screens the supplier against the GLEIF registry and the UN sanctions list. Nothing is stored unless
          you choose to seal it.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          className="panel grid content-start gap-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Field label="Supplier legal name" hint="As on the quote, e.g. “Baotou Rare Earth Co., Ltd.”">
            <input className={inputCls} required minLength={2} maxLength={120} value={form.supplier} onChange={set("supplier")} />
          </Field>
          <Field label="What is being bought">
            <select className={inputCls} value={form.commodity} onChange={set("commodity")}>
              {COMMODITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {form.commodity === "Other" ? (
            <Field label="Describe it" hint="No material model yet: VerityX will use your other prices and the supplier screen.">
              <input className={inputCls} required minLength={2} maxLength={80} value={form.other} onChange={set("other")} />
            </Field>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Quantity (kg)">
              <input className={inputCls} required inputMode="decimal" value={form.quantityKg} onChange={set("quantityKg")} />
            </Field>
            <Field label="Quoted total">
              <div className="flex gap-2">
                <input className={inputCls} required inputMode="decimal" value={form.quoteTotal} onChange={set("quoteTotal")} />
                <select className={`${inputCls} w-24`} value={form.currency} onChange={set("currency")} aria-label="Currency">
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </div>
            </Field>
          </div>
          <Field label="Other prices for the same order (optional)" hint="Competing quotes or market prints, same currency, one per line.">
            <textarea className={`${inputCls} h-24 py-2`} value={form.otherPrices} onChange={set("otherPrices")} />
          </Field>
          {model ? (
            <fieldset className="grid gap-4 rounded-[10px] border border-line p-4">
              <legend className="px-1 text-sm text-paper">Your licensed benchmark (optional, recommended)</legend>
              <p className="text-xs leading-relaxed text-mute">
                Without it, {needs.cu ? "copper uses the World Bank monthly average" : "rare earths use the USGS annual average, which is context only"}.
                Enter today’s price from your own Argus, Fastmarkets or SMM subscription, or your contract price — you hold
                that licence; VerityX only does the arithmetic and records the source you name.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {needs.ndpr ? (
                  <Field label="NdPr oxide (USD/kg)">
                    <input className={inputCls} inputMode="decimal" value={form.benchNdpr} onChange={set("benchNdpr")} />
                  </Field>
                ) : null}
                {needs.dy ? (
                  <Field label="Dy oxide (USD/kg)">
                    <input className={inputCls} inputMode="decimal" value={form.benchDy} onChange={set("benchDy")} />
                  </Field>
                ) : null}
                {needs.cu ? (
                  <Field label="Copper (USD/t)">
                    <input className={inputCls} inputMode="decimal" value={form.benchCu} onChange={set("benchCu")} />
                  </Field>
                ) : null}
              </div>
              <Field label="Benchmark source" hint="e.g. “Fastmarkets NdPr oxide CIF, 7 Nov 2026” or “Contract price, Q4”">
                <input className={inputCls} maxLength={120} value={form.benchSource} onChange={set("benchSource")} />
              </Field>
            </fieldset>
          ) : null}
          <Field label="PO number (optional)">
            <input className={inputCls} maxLength={40} value={form.poNumber} onChange={set("poNumber")} />
          </Field>
          <button
            type="submit"
            disabled={busy !== ""}
            className="inline-flex h-11 items-center justify-center rounded-[8px] bg-gold px-5 text-sm font-medium text-plum disabled:opacity-60"
          >
            {busy === "check" ? "Checking…" : "Check this quote"}
          </button>
          {err ? (
            <p role="alert" className="text-sm text-bad">
              {err}
            </p>
          ) : null}
        </form>

        <div className="grid content-start gap-4" aria-live="polite">
          {!result ? (
            <div className="panel p-6 text-sm leading-relaxed text-mute">
              The verdict appears here: a fair price range, how far the quote sits from it, and what the supplier screen
              found — each with its reason. VerityX advises; it never blocks an order on its own.
            </div>
          ) : (
            <>
              <div className={`rounded-[12px] border p-5 ${tone[result.verdict]}`}>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em]">Advisory verdict</p>
                <p className="mt-2 font-display text-3xl tracking-tight">{verdictWord[result.verdict]}</p>
              </div>
              <div className="panel p-6">
                <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-mute">Why</h2>
                <ul className="mt-3 grid gap-2 text-sm leading-relaxed">
                  {result.reasons.map((r) => (
                    <li key={r} className="border-t border-line pt-2 first:border-0 first:pt-0">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              {sc && sc.ok ? (
                <div className="panel grid gap-2 p-6 text-sm">
                  <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-mute">Should-cost · {sc.title}</h2>
                  <p className="font-display text-2xl">
                    {money(sc.perKg.low * result.input.quantityKg, sc.currency)} – {money(sc.perKg.high * result.input.quantityKg, sc.currency)}
                  </p>
                  <p className="text-mute">
                    {sc.perKg.low}–{sc.perKg.high} {sc.currency}/kg × {result.input.quantityKg.toLocaleString("en-GB")} kg · your quote{" "}
                    {money(result.input.quoteTotal, result.input.currency)}
                  </p>
                  <p className="text-xs text-mute">
                    Prices used: {sc.basis.map((b) => b.label).join(" · ")}. {sc.caveat}{" "}
                    <a className="underline underline-offset-2" href="/sources">
                      Sources
                    </a>
                  </p>
                </div>
              ) : null}
              <div className="panel grid gap-2 p-6 text-sm">
                <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-mute">Supplier screen</h2>
                <p>
                  GLEIF:{" "}
                  {result.screen.gleif
                    ? `${result.screen.gleif.name} · LEI ${result.screen.gleif.lei} · ${result.screen.gleif.country} · ${result.screen.gleif.status}`
                    : result.screen.gleifAvailable
                      ? "no LEI record found for this name"
                      : "registry unreachable"}
                </p>
                <p>
                  UN list:{" "}
                  {result.screen.un === "possible-match"
                    ? "possible name match — review"
                    : result.screen.un === "no-match"
                      ? "no name match"
                      : "list unreachable — not screened"}
                </p>
              </div>
              <div className="panel grid gap-3 p-6 text-sm">
                {sealed ? (
                  <>
                    <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-ok">Sealed into the ledger</h2>
                    <p className="break-all font-mono text-xs">entry {sealed.entry.hash}</p>
                    <p className="break-all font-mono text-xs">
                      Merkle root {sealed.proof.root} · proof {sealed.proof.valid ? "VALID" : "INVALID"}
                    </p>
                    {sealed.receiptJson ? (
                      <button
                        type="button"
                        className="inline-flex h-11 w-fit items-center rounded-[8px] border border-gold/60 px-4 text-sm text-gold"
                        onClick={() => {
                          const blob = new Blob([sealed.receiptJson!], { type: "application/json" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `verityx-receipt-${sealed.entry.hash.slice(0, 12)}.json`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                      >
                        Download receipt — anyone can verify it
                      </button>
                    ) : (
                      <p className="text-xs text-warn">No public receipt: this server has no seal key configured.</p>
                    )}
                    <div className="flex flex-wrap gap-4">
                      <Link to="/verify" className="text-gold hover:text-paper">
                        Verify a receipt →
                      </Link>
                      <Link to="/core" className="text-gold hover:text-paper">
                        See it on the ledger →
                      </Link>
                    </div>
                  </>
                ) : user ? (
                  <>
                    <p className="text-mute">
                      Seal this check: VerityX re-runs it on the server and writes the verdict, prices and screen into the
                      tamper-evident ledger under your name.
                    </p>
                    <button
                      type="button"
                      onClick={() => void seal()}
                      disabled={busy !== ""}
                      className="inline-flex h-11 w-fit items-center rounded-[8px] border border-gold/60 px-4 text-sm text-gold disabled:opacity-60"
                    >
                      {busy === "seal" ? "Sealing…" : "Seal to the ledger"}
                    </button>
                  </>
                ) : (
                  <p className="text-mute">
                    To keep a tamper-evident record of this check,{" "}
                    <Link to="/login" className="text-gold hover:text-paper">
                      sign in to the workspace
                    </Link>{" "}
                    and seal it.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
