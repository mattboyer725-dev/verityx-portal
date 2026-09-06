import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage, useLiveMutations, useReportsLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/reports/")({ component: ReportsPage });

function ReportsPage() {
  const { data, error, loading } = useReportsLive();
  const mutate = useLiveMutations();
  const [busy, setBusy] = useState<string | null>(null);

  async function download(id: string, title: string) {
    setBusy(id);
    try {
      const file = await mutate.getReportPdf({ id });
      const binary = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename || `${title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

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
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === r.id}
                onClick={() => download(r.id, r.title)}
              >
                {busy === r.id ? "Preparing…" : "PDF"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
