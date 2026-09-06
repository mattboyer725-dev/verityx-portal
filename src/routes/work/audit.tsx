import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { formatWhenPrecise } from "@/lib/verityx/format";
import { useAuditLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/audit")({ component: AuditPage });

function metaPreview(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(parsed).filter((k) => parsed[k] != null && parsed[k] !== "");
    if (keys.length === 0) return "—";
    return keys
      .slice(0, 3)
      .map((k) => `${k}`)
      .join(" · ");
  } catch {
    return "—";
  }
}

function AuditPage() {
  const { data, error, loading } = useAuditLive();
  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Integrity"
        title="Audit log"
        description="Live create, update, delete, payment, and report events for this tenant. Passwords, tokens, and secrets are never stored here."
      />
      {loading && !data ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={error} />
      {data && data.length === 0 ? (
        <EmptyState title="No events yet" body="Actions in this organization will land here, scoped to your tenant." />
      ) : null}
      {data && data.length > 0 ? (
        <div className="overflow-x-auto panel">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Entity</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Fields</th>
                <th className="px-5 py-3 font-medium">Request</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 tabular-nums text-mute">{formatWhenPrecise(row.createdAt)}</td>
                  <td className="px-5 py-3">{row.action}</td>
                  <td className="px-5 py-3 text-mute">
                    {row.entityType}
                    {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-mute">{row.actorUserId.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-xs text-mute">{metaPreview(row.metadata)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-mute">{row.requestId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
