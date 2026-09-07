import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { VxMark } from "@/components/vx-mark";
import { SurfaceLoop } from "@/components/surface-loop";
import { AdapterStrip } from "@/components/adapter-strip";
import { useLiveAdapters } from "@/lib/desk-live";
import { CAPABILITIES, CELL_LABEL, FIELD, HONEST_GAPS, VERITYX_WEDGE, provePath, proveSearch, type FieldCell } from "@/lib/competition";
import { BUYER } from "@/lib/engine";
import { cn } from "@/lib/cn";
import { ProveAnalogButton } from "@/components/analog-proof";

export const Route = createFileRoute("/field")({ component: FieldPage });

function cellClass(v: FieldCell) {
  if (v === "native" || v === "live") return "text-gold";
  if (v === "analog") return "text-paper";
  if (v === "module") return "text-mute";
  return "text-mute/70";
}

function FieldPage() {
  const { adapters } = useLiveAdapters();

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-6 sm:pt-12">
        <VxMark className="vx-mark-hero" title="VerityX" />
        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.22em] text-mute">Field · competitor map</p>
        <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.06] tracking-tight sm:text-6xl">
          On the purchase order, not beside it.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-mute">{VERITYX_WEDGE}</p>
        <SurfaceLoop className="mt-8" />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/desk"
            className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-gold px-4 text-sm text-plum hover:opacity-90"
          >
            Enter as {BUYER.name.split(" ")[0]}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/core"
            className="inline-flex h-11 items-center rounded-[8px] border border-line px-4 text-sm text-paper hover:border-gold/30"
          >
            Verify the core
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Capability matrix</p>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          S2P suites own the PO. ESG vendors own the scorecard. Traceability vendors own the lot. VerityX is the
          verify pass that sits on the line item.
        </p>
        <div className="mt-5 overflow-x-auto field-matrix-desktop">
          <table className="field-matrix">
            <thead>
              <tr>
                <th>Capability</th>
                <th>S2P suites</th>
                <th>ESG / risk</th>
                <th>Traceability</th>
                <th>VerityX</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td className={cellClass(row.s2p)}>{CELL_LABEL[row.s2p]}</td>
                  <td className={cellClass(row.esg)}>{CELL_LABEL[row.esg]}</td>
                  <td className={cellClass(row.trace)}>{CELL_LABEL[row.trace]}</td>
                  <td className={cn(cellClass(row.vx), "font-medium")}>{CELL_LABEL[row.vx]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="field-matrix-mobile mt-5 grid gap-2">
          {CAPABILITIES.map((row) => (
            <div key={row.id} className="panel p-4">
              <p className="text-sm text-paper">{row.label}</p>
              <p className="mt-2 text-xs text-mute">
                VerityX <span className={cellClass(row.vx)}>{CELL_LABEL[row.vx]}</span>
                {" · "}S2P {CELL_LABEL[row.s2p]}
                {" · "}ESG {CELL_LABEL[row.esg]}
                {" · "}Trace {CELL_LABEL[row.trace]}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-mute">
          Native = product core. Module = add-on. Analog = protocol-complete on this host, vendor tenant not
          subscribed. Live = public feed or hosted cluster. Dash = not in that class.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Compare and contrast</p>
        <div className="mt-4 grid gap-3">
          {FIELD.map((row) => {
            const analog = row.adapterId ? adapters.find((a) => a.id === row.adapterId) : undefined;
            const next = provePath(row);
            return (
              <article id={row.id} key={row.id} className="panel scroll-mt-24 overflow-hidden p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{row.category}</p>
                    <h2 className="mt-2 font-display text-2xl tracking-tight">{row.names}</h2>
                  </div>
                  {analog ? (
                    <span
                      className={`shrink-0 text-[10px] uppercase tracking-[0.16em] ${
                        analog.status === "LIVE" ? "text-ok" : analog.status === "DOWN" ? "text-bad" : "text-warn"
                      }`}
                    >
                      {analog.status} · {analog.name}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-mute">They</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-mist">{row.they}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-gold">We</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-paper">{row.we}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-mute">Contrast</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-mute">{row.contrast}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {analog ? (
                    <ProveAnalogButton
                      card={analog}
                      label={`${row.analog} · ${row.analogPath}`}
                      className="min-w-0 break-all text-left font-mono text-[11px] text-mist hover:text-gold"
                    />
                  ) : row.analogPath === "/core" ? (
                    <Link to="/core" className="min-w-0 break-all font-mono text-[11px] text-mist hover:text-gold">
                      {row.analog} · {row.analogPath}
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next === "/core" ? (
                    <Link to="/core" className="shrink-0 text-sm text-gold hover:text-paper">
                      Prove on the core →
                    </Link>
                  ) : (
                    <Link to="/desk" search={proveSearch(row)} className="shrink-0 text-sm text-gold hover:text-paper">
                      Prove on the desk →
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Honest remaining gaps</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {HONEST_GAPS.map((g) => (
            <li key={g.slice(0, 32)} className="panel p-5 text-sm leading-relaxed text-mute">
              {g}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Live adapters on this host</p>
        <div className="mt-4">
          <AdapterStrip adapters={adapters} compact />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}