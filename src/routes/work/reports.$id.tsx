import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MissingRecord, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage, useLiveMutations, useReportLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/reports/$id")({ component: ReportDetail });

function ReportDetail() {
  const { id } = Route.useParams();
  const { data, error, loading } = useReportLive(id);
  const mutate = useLiveMutations();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const file = await mutate.getReportPdf({ id });
      const binary = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([binary], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-64" />;
  if (error) return <MissingRecord message={error} to="/work/reports" label="Back to reports" />;
  if (!data) return <MissingRecord message="Report not found" to="/work/reports" label="Back to reports" />;
  const { report, prospect, decision, pilot } = data;

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Report"
        title={report.title}
        description={formatWhen(report.createdAt)}
        actions={
          <>
            <SampleTag on={prospect.isSample} />
            <Button onClick={download} disabled={busy}>
              {busy ? "Preparing…" : "Download PDF"}
            </Button>
          </>
        }
      />
      <section className="panel p-5 sm:p-8">
        <p className="text-sm leading-relaxed text-mist">{report.summary}</p>
        <pre className="mt-6 whitespace-pre-wrap font-sans text-sm leading-relaxed text-paper">{report.body}</pre>
        <p className="mt-8 border-t border-line pt-4 text-xs italic leading-relaxed text-mute">{report.disclaimer}</p>
      </section>
      {decision ? (
        <p className="text-sm text-mute">
          Decision{" "}
          <Link to="/work/decisions/$id" params={{ id: decision.id }} className="underline">
            {decision.proposedAction}
          </Link>{" "}
          <Pill tone={decision.status}>{decision.status.replace("_", " ")}</Pill>
          {" · "}
          <Link to="/work/pilots/$id" params={{ id: pilot.id }} className="underline">
            Return to pilot
          </Link>
        </p>
      ) : null}
    </div>
  );
}
