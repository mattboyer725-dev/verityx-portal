import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { formatWhen } from "@/lib/verityx/format";
import { useDashboardLive, useFeedbackLive, useOutcomesLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/learning")({ component: LearningPage });

function LearningPage() {
  const dash = useDashboardLive();
  const fb = useFeedbackLive();
  const outcomes = useOutcomesLive();
  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Customer learning"
        title="Outcomes & feedback"
        description="Live decision-outcome records. Case-study permission is opt-in, never assumed."
      />
      {dash.loading && !dash.data ? <Skeleton /> : null}
      <ErrorNote message={dash.error ?? fb.error ?? outcomes.error} />
      <section className="grid gap-3 sm:grid-cols-4">
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Outcomes</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{dash.data?.counts.outcomes ?? "—"}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Feedback notes</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{dash.data?.counts.feedback ?? "—"}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Reports</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{dash.data?.counts.reports ?? "—"}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Paid pilots</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{dash.data?.counts.paidPilots ?? "—"}</p>
        </div>
      </section>
      {outcomes.data && outcomes.data.length === 0 && fb.data && fb.data.length === 0 ? (
        <EmptyState
          title="Nothing to learn from yet"
          body="Close the loop on a paid pilot — feedback and later accuracy live on the pilot file."
        />
      ) : null}
      {outcomes.data && outcomes.data.length > 0 ? (
        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Outcomes</h2>
          </div>
          <ul className="divide-y divide-line">
            {outcomes.data.map((item) => (
              <li key={item.id} className="px-5 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link to="/work/pilots/$id" params={{ id: item.pilotId }} className="hover:underline">
                    {item.companyName}
                  </Link>
                  <Pill tone={item.outcomeAccuracy}>{item.outcomeAccuracy}</Pill>
                </div>
                <p className="mt-1 text-mute">
                  {item.pilotTitle} · permission {item.caseStudyPermission}
                  {item.outcomeValue ? ` · ${item.outcomeValue}` : ""}
                  {item.followUpAt ? ` · follow-up ${formatWhen(item.followUpAt)}` : ""}
                </p>
                {item.notes ? <p className="mt-1 text-mist">{item.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {fb.data && fb.data.length > 0 ? (
        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Feedback</h2>
          </div>
          <ul className="divide-y divide-line">
            {fb.data.map((item) => (
              <li key={item.id} className="px-5 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link to="/work/pilots/$id" params={{ id: item.pilotId }} className="hover:underline">
                    {item.companyName}
                  </Link>
                  <span className="tabular-nums text-mute">{formatWhen(item.createdAt)}</span>
                </div>
                <p className="mt-1 text-mute">
                  {item.kind} · {item.rating ?? "—"}/5 — {item.comment || "No comment"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
