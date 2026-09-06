import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { formatWhen } from "@/lib/verityx/format";
import { useDecisionsLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/decisions/")({ component: DecisionsPage });

function DecisionsPage() {
  const { data, error, loading } = useDecisionsLive();
  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Advisory"
        title="Decisions"
        description="Live provenance: rule version, evidence, source timestamps, actor, and rationale. BLOCK stays pending until a founder or admin approves."
      />
      {loading && !data ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={error} />
      {data && data.length === 0 ? (
        <EmptyState
          title="No decisions yet"
          body="Open a paid pilot and attach named-source evidence. The engine will not invent a BLOCK from keywords."
        />
      ) : null}
      {data && data.length > 0 ? (
        <div className="overflow-x-auto panel">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Pilot</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Rules</th>
                <th className="px-5 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <Link to="/work/decisions/$id" params={{ id: d.id }} className="hover:underline">
                      {d.pilotTitle}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={d.proposedAction}>{d.proposedAction}</Pill>
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={d.status}>{d.status.replace("_", " ")}</Pill>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-mute">{d.ruleVersion}</td>
                  <td className="px-5 py-4 tabular-nums text-mute">{formatWhen(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
