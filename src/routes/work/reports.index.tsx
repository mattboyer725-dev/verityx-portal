import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { formatWhen } from "@/lib/verityx/format";
import { useReportsLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/reports/")({ component: ReportsPage });

function ReportsPage() {
  const { data, error, loading } = useReportsLive();
  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Work product"
        title="Reports"
        description="Issued from stored evidence on the live file. Download the PDF from the report record."
      />
      {loading && !data ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={error} />
      {data && data.length === 0 ? (
        <EmptyState title="No reports issued" body="Generate one from a paid pilot after an evidence-backed decision." />
      ) : null}
      {data && data.length > 0 ? (
        <ul className="panel divide-y divide-line">
          {data.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <Link to="/work/reports/$id" params={{ id: r.id }} className="block truncate hover:underline">
                  {r.title}
                </Link>
                <p className="text-xs text-mute">
                  {r.companyName} · {formatWhen(r.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
