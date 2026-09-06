import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage, useDecisionLive, useLiveMutations } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/decisions/$id")({ component: DecisionDetail });

function DecisionDetail() {
  const { id } = Route.useParams();
  const { data, error, loading } = useDecisionLive(id);
  const mutate = useLiveMutations();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      await mutate.approveDecision({ id, note });
      toast.success("Approved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    setBusy(true);
    try {
      await mutate.patchDecision({ id, approvalNote: note });
      toast.success("Note saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-64" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;
  const { decision, pilot } = data;

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Decision provenance"
        title={`${decision.proposedAction} · ${decision.recommendedBand}`}
        description={decision.confidenceRationale}
        actions={
          <>
            <Pill tone={decision.status}>{decision.status.replace("_", " ")}</Pill>
            <Link to="/work/pilots/$id" params={{ id: pilot.id }} className="text-sm text-mute hover:text-paper">
              Back to pilot
            </Link>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Rule version", decision.ruleVersion],
          ["Actor", decision.userId.slice(0, 8)],
          ["Approved", decision.approvedAt ? formatWhen(decision.approvedAt) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="panel p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{k}</p>
            <p className="mt-2 font-mono text-sm">{v}</p>
          </div>
        ))}
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-display text-2xl">Evidence</h2>
        <ul className="mt-4 space-y-4">
          {decision.evidence.map((e) => (
            <li key={e.id} className="rounded-[16px] border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{e.title}</p>
                <Pill>{e.kind.replaceAll("_", " ")}</Pill>
                <Pill>{e.confidence}</Pill>
              </div>
              <p className="mt-2 text-sm text-mute">
                {e.sourceName} · observed {e.observedAt}
                {e.sourceUrl ? ` · ${e.sourceUrl}` : ""}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{e.excerpt}</p>
            </li>
          ))}
        </ul>
      </section>

      {decision.sourceTimestamps.length > 0 ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="font-display text-2xl">Source timestamps</h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {decision.sourceTimestamps.map((s) => (
              <li key={`${s.sourceName}-${s.observedAt}`} className="flex justify-between gap-4 py-2">
                <span>{s.sourceName}</span>
                <span className="tabular-nums text-mute">{s.observedAt}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel p-5 sm:p-6">
        <h2 className="font-display text-2xl">Rules fired</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-mist">
          {decision.rulesFired.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>

      {decision.status === "pending_approval" ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="font-display text-2xl">Human approval required</h2>
          <p className="mt-1 text-sm text-mute">
            Soft-prod will not apply BLOCK without a founder or admin.
          </p>
          <Field label="Approval note">
            <Textarea className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" disabled={busy} onClick={saveNote}>
              Save note
            </Button>
            <Button disabled={busy} onClick={approve}>
              Approve position
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
