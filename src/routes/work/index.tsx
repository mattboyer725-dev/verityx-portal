import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Layers, PackageCheck, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { getOverview } from "@/lib/provenance/api";
import { MATERIALS, type Material } from "@/lib/provenance/passport";
import { STATE_LABEL, type ItemState } from "@/lib/provenance/portfolio";
import { errorMessage } from "@/lib/verityx/use-loader";

export const Route = createFileRoute("/work/")({ component: Overview });

const PLAN_LABEL: Record<string, string> = { free: "Free", supplier: "Supplier", team: "Team", program: "Program", enterprise: "Enterprise" };
const TONE: Record<ItemState, string> = {
  "declared-clear": "declared-clear",
  "covered-country-declared": "covered-country-declared",
  revoked: "revoked",
  "not-found": "incomplete",
  "no-passport": "incomplete",
  incomplete: "incomplete",
};

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "bad" | "ok" | "warn" }) {
  return (
    <div className="rounded-[16px] border border-line bg-ink/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className={`mt-1 font-display text-3xl tabular-nums ${tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Card({ title, icon, to, cta, children }: { title: string; icon: ReactNode; to: string; cta: string; children: ReactNode }) {
  return (
    <section className="panel flex flex-col p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-xl">
          {icon}
          {title}
        </h2>
        <Link to={to as "/"} className="inline-flex items-center gap-1 text-sm text-mute hover:text-paper">
          {cta}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Overview() {
  const q = useQuery({ queryKey: ["vx", "overview"], queryFn: () => getOverview(), staleTime: 10_000, refetchInterval: 60_000 });

  if (q.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  if (q.error || !q.data) return <ErrorNote message={q.error ? errorMessage(q.error) : "Overview unavailable"} />;

  const d = q.data;
  const s = d.portfolio.summary;
  const newWorkspace = s.total === 0 && d.passports.draft + d.passports.sealed + d.passports.revoked === 0;

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Overview"
        title={d.organization}
        description={
          newWorkspace
            ? "Two ways to start. Buyers: import the magnet-bearing parts you ship and see which have a sealed chain. Suppliers: publish a passport for a lot you sell."
            : "What needs your attention first."
        }
      />

      {d.portfolio.changed.length ? (
        <section className="rounded-[20px] border border-bad/30 bg-bad/10 p-5">
          <p className="inline-flex items-center gap-2 font-medium text-bad">
            <AlertTriangle className="size-4" />
            {d.portfolio.changed.length} part{d.portfolio.changed.length === 1 ? "" : "s"} changed since your last review
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {d.portfolio.changed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.partNumber}</span>
                <span className="text-mute">
                  {r.ackState ? STATE_LABEL[r.ackState] : ""} → {STATE_LABEL[r.state]}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/work/portfolio" className="mt-3 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline">
            Review in Portfolio <ArrowRight className="size-3.5" />
          </Link>
        </section>
      ) : null}

      {newWorkspace ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Link to="/work/portfolio" className="panel group p-6 transition-colors hover:border-gold/40">
            <Upload className="size-5 text-gold" strokeWidth={1.6} />
            <p className="mt-4 font-display text-2xl">I buy magnet-bearing parts</p>
            <p className="mt-2 text-sm text-mute">
              Import your parts list with the passport codes your suppliers gave you. See every chain from mine to magnet, get alerts
              when a lot is revoked, and export a sealed evidence pack.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-gold">
              Import parts <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link to="/work/passports" className="panel group p-6 transition-colors hover:border-gold/40">
            <Layers className="size-5 text-gold" strokeWidth={1.6} />
            <p className="mt-4 font-display text-2xl">I make or process the material</p>
            <p className="mt-2 text-sm text-mute">
              Publish a lot passport: where each stage happened, with fingerprints of your evidence. Seal it and send the code to your
              buyer. Five a year are free.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-gold">
              Create a passport <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Portfolio" icon={<PackageCheck className="size-5 text-gold" strokeWidth={1.6} />} to="/work/portfolio" cta="Open">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Parts" value={s.total} />
              <Stat label="Clear" value={s["declared-clear"]} tone={s["declared-clear"] ? "ok" : undefined} />
              <Stat label="Gaps" value={s["no-passport"] + s["not-found"] + s.incomplete} tone={s["no-passport"] + s["not-found"] + s.incomplete ? "warn" : undefined} />
              <Stat label="Flagged" value={s["covered-country-declared"] + s.revoked} tone={s["covered-country-declared"] + s.revoked ? "bad" : undefined} />
            </div>
            {d.portfolio.attention.length ? (
              <ul className="mt-5 divide-y divide-line text-sm">
                {d.portfolio.attention.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">
                      {r.partNumber}
                      {r.program ? <span className="text-mute"> · {r.program}</span> : null}
                    </span>
                    <span className="shrink-0 whitespace-nowrap">
                      <Pill tone={TONE[r.state]}>{STATE_LABEL[r.state]}</Pill>
                    </span>
                  </li>
                ))}
              </ul>
            ) : s.total ? (
              <p className="mt-5 text-sm text-ok">Every part has a complete, declared-clear chain.</p>
            ) : (
              <p className="mt-5 text-sm text-mute">No parts yet. Import a CSV to start monitoring.</p>
            )}
          </Card>

          <Card title="Your passports" icon={<Layers className="size-5 text-gold" strokeWidth={1.6} />} to="/work/passports" cta="Open">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Sealed" value={d.passports.sealed} tone={d.passports.sealed ? "ok" : undefined} />
              <Stat label="Drafts" value={d.passports.draft} />
              <Stat label="Revoked" value={d.passports.revoked} />
            </div>
            {d.passports.recent.length ? (
              <ul className="mt-5 divide-y divide-line text-sm">
                {d.passports.recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link to="/work/passports/$id" params={{ id: p.id }} className="min-w-0 truncate hover:text-gold">
                      <span className="font-mono">{p.code}</span>
                      <span className="text-mute">
                        {" "}
                        · {MATERIALS[p.material as Material]?.label ?? p.material}
                        {p.lotRef ? ` · ${p.lotRef}` : ""}
                      </span>
                    </Link>
                    <Pill tone={p.status}>{p.status}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-mute">You have not published a lot yet. Suppliers publish; buyers can skip this.</p>
            )}
          </Card>
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="text-mute">Supplier plan </span>
            {d.limits.sealsPerYear === null ? "Unlimited" : PLAN_LABEL[d.billing.supplierPlan]}
            <span className="text-mute">
              {" "}
              · {d.usage.sealsLastYear}
              {d.limits.sealsPerYear === null ? "" : ` / ${d.limits.sealsPerYear}`} sealed this year
            </span>
          </span>
          <span>
            <span className="text-mute">Buyer plan </span>
            {PLAN_LABEL[d.billing.buyerPlan]}
            <span className="text-mute">
              {" "}
              · {d.usage.parts}
              {d.limits.maxParts === null ? "" : ` / ${d.limits.maxParts.toLocaleString("en-US")}`} parts
            </span>
          </span>
        </div>
        <Link to="/work/billing" className="inline-flex items-center gap-1 text-sm text-gold hover:text-paper">
          Billing <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </div>
  );
}
