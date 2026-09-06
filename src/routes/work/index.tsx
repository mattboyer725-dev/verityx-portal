import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { useDashboardLive, useLiveMutations, errorMessage } from "@/lib/verityx/live";
import { money, formatWhen } from "@/lib/verityx/format";

export const Route = createFileRoute("/work/")({ component: Command });

function Command() {
  const { data, error, loading } = useDashboardLive();
  const mutate = useLiveMutations();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function loadSample() {
    setBusy(true);
    try {
      const result = await mutate.loadSample();
      toast.success("Sample walkthrough loaded — labeled, not live intelligence.");
      if (result.pilot) {
        await navigate({ to: "/work/pilots/$id", params: { id: result.pilot.id } });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openBook() {
    setBusy(true);
    try {
      const result = await mutate.loadOwnBook();
      toast.success(
        result.created
          ? `VerityX book opened — ${result.created} companies filed`
          : `VerityX book already on file — ${result.total} companies`,
      );
      await navigate({ to: "/work/prospects" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </div>
    );
  }

  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const empty = data.counts.prospects === 0;

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Command"
        title="The file of record"
        description="Live workspace metrics from your tenant database. Finish a prospect, contact them, then take a paid, evidence-backed pilot."
        actions={
          <>
            <Button onClick={openBook} disabled={busy}>
              {busy ? "Opening…" : "Open VerityX book"}
            </Button>
            <Link to="/work/prospects">
              <Button variant="ghost">New prospect</Button>
            </Link>
            <Button variant="ghost" onClick={loadSample} disabled={busy}>
              {busy ? "Loading…" : "Load sample walkthrough"}
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ["Prospects", String(data.counts.prospects)],
          ["Need contact", String(data.counts.needsContact)],
          ["Paid pilots", String(data.counts.paidPilots)],
          ["Unpaid", String(data.counts.unpaidPilots)],
          ["Pilot revenue", money(data.revenueUsd)],
          ["Reports", String(data.counts.reports)],
        ].map(([k, v]) => (
          <div key={k} className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{k}</p>
            <p className="mt-2 font-display text-3xl tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <section className="panel p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Core loop</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.loop.map((item, i) => (
            <li key={item.stage} className="rounded-[16px] border border-line bg-ink/50 p-3">
              <p className="text-[10px] tabular-nums text-mute">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-1 font-display text-lg capitalize">{item.stage.replace("_", " ")}</p>
              <p className="mt-1 text-xs text-mute">{item.detail}</p>
              <div className="mt-3 h-1 rounded-full bg-line">
                <div className={`h-1 rounded-full ${item.complete ? "w-full bg-paper" : "w-0"}`} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {empty ? (
        <EmptyState
          title="No customer file yet"
          body="Open the VerityX book of business — sixteen magnetics, wind, and rare-earth companies — then finish each file and contact them. Or load the labeled Harborline sample."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={openBook} disabled={busy}>
                Open VerityX book
              </Button>
              <Button variant="ghost" onClick={loadSample} disabled={busy}>
                Load sample walkthrough
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Recent prospects</h2>
              <Link to="/work/prospects" className="text-sm text-mute hover:text-paper">
                All
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {data.recentProspects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <Link to="/work/prospects/$id" params={{ id: p.id }} className="min-w-0">
                    <p className="truncate text-sm">{p.companyName}</p>
                    <p className="text-xs text-mute">{p.sector || "No sector"}</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <SampleTag on={p.isSample} />
                    <Pill tone={p.stage}>{p.stage}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Live pilots</h2>
              <Link to="/work/pilots" className="text-sm text-mute hover:text-paper">
                All
              </Link>
            </div>
            {data.recentPilots.length === 0 ? (
              <p className="text-sm text-mute">No pilots opened yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.recentPilots.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <Link to="/work/pilots/$id" params={{ id: p.id }} className="min-w-0">
                      <p className="truncate text-sm">{p.title}</p>
                      <p className="text-xs text-mute">{p.companyName}</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Pill tone={p.paymentStatus}>{p.paymentStatus}</Pill>
                      <span className="text-xs tabular-nums text-mute">{money(p.priceUsd)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Audit</h2>
              <Link to="/work/audit" className="text-sm text-mute hover:text-paper">
                All
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {data.recentAudit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="truncate">{a.action}</span>
                  <span className="shrink-0 text-xs tabular-nums text-mute">{formatWhen(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Outcomes</h2>
              <Link to="/work/learning" className="text-sm text-mute hover:text-paper">
                Learning
              </Link>
            </div>
            {data.recentOutcomes.length === 0 ? (
              <p className="text-sm text-mute">Close a paid pilot to capture what happened.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.recentOutcomes.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <Link to="/work/pilots/$id" params={{ id: o.pilotId }} className="truncate hover:underline">
                      {o.companyName}
                    </Link>
                    <Pill tone={o.outcomeAccuracy}>{o.outcomeAccuracy}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
