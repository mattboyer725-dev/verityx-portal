import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MissingRecord, PageHeader, Skeleton } from "@/components/page-header";
import { SlaClock } from "@/components/sla-clock";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { emptyEvidence } from "@/lib/verityx/decision-engine";
import { sampleHarborlineEvidence, sampleSanctionsEvidence } from "@/lib/verityx/samples";
import { formatWhen, money } from "@/lib/verityx/format";
import type { EvidenceItem, Outcome } from "@/lib/verityx/types";
import { errorMessage, useLiveMutations, usePilotLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/pilots/$id")({ component: PilotDetail });

const KINDS: EvidenceItem["kind"][] = [
  "documentation_gap",
  "sanctions_screening",
  "media_report",
  "operational_event",
  "financial_signal",
  "corroboration",
  "other",
];

function PilotDetail() {
  const { id } = Route.useParams();
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const waitingOnStripe = search.includes("paid=1");
  const { data, error, loading } = usePilotLive(id, { pollPayment: waitingOnStripe });
  const mutate = useLiveMutations();
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([emptyEvidence()]);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [fb, setFb] = useState({ kind: "delivery", rating: 5, comment: "" });
  const [outcome, setOutcome] = useState({
    outcomeAccuracy: "unknown" as Outcome["outcomeAccuracy"],
    outcomeValue: "",
    timeToResolutionDays: "",
    caseStudyPermission: "undecided" as Outcome["caseStudyPermission"],
    followUpAt: "",
    notes: "",
  });

  useEffect(() => {
    if (!data) return;
    setTitle(data.pilot.title);
    setScope(data.pilot.scope);
    if (data.outcome) {
      setOutcome({
        outcomeAccuracy: data.outcome.outcomeAccuracy,
        outcomeValue: data.outcome.outcomeValue,
        timeToResolutionDays:
          data.outcome.timeToResolutionDays == null ? "" : String(data.outcome.timeToResolutionDays),
        caseStudyPermission: data.outcome.caseStudyPermission,
        followUpAt: data.outcome.followUpAt ? data.outcome.followUpAt.slice(0, 10) : "",
        notes: data.outcome.notes,
      });
    }
  }, [data]);

  const paid = data?.pilot.paymentStatus === "paid";

  const evidenceEditor = useMemo(
    () =>
      evidence.map((item, index) => (
        <div key={item.id} className="rounded-[16px] border border-line bg-ink/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={item.title}
                onChange={(e) => {
                  const next = [...evidence];
                  next[index] = { ...item, title: e.target.value };
                  setEvidence(next);
                }}
              />
            </Field>
            <Field label="Kind">
              <Select
                value={item.kind}
                onChange={(e) => {
                  const next = [...evidence];
                  next[index] = { ...item, kind: e.target.value as EvidenceItem["kind"] };
                  setEvidence(next);
                }}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Named source">
              <Input
                value={item.sourceName}
                onChange={(e) => {
                  const next = [...evidence];
                  next[index] = { ...item, sourceName: e.target.value };
                  setEvidence(next);
                }}
              />
            </Field>
            <Field label="Observed">
              <Input
                type="date"
                value={item.observedAt.slice(0, 10)}
                onChange={(e) => {
                  const next = [...evidence];
                  next[index] = { ...item, observedAt: e.target.value };
                  setEvidence(next);
                }}
              />
            </Field>
            <Field label="Confidence">
              <Select
                value={item.confidence}
                onChange={(e) => {
                  const next = [...evidence];
                  next[index] = { ...item, confidence: e.target.value as EvidenceItem["confidence"] };
                  setEvidence(next);
                }}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </Select>
            </Field>
            <Field label="Source URL (optional)">
              <Input
                value={item.sourceUrl}
                onChange={(e) => {
                  const next = [...evidence];
                  next[index] = { ...item, sourceUrl: e.target.value };
                  setEvidence(next);
                }}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Excerpt">
                <Textarea
                  value={item.excerpt}
                  onChange={(e) => {
                    const next = [...evidence];
                    next[index] = { ...item, excerpt: e.target.value };
                    setEvidence(next);
                  }}
                />
              </Field>
            </div>
          </div>
          {evidence.length > 1 ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              className="mt-2"
              onClick={() => setEvidence(evidence.filter((_, i) => i !== index))}
            >
              Remove item
            </Button>
          ) : null}
        </div>
      )),
    [evidence],
  );

  async function checkout() {
    setBusy("checkout");
    try {
      const result = await mutate.createCheckout({
        pilotId: id,
        origin: window.location.origin,
      });
      if (result.alreadyPaid) {
        toast.success("Already paid");
        return;
      }
      if (!result.configured || !result.url) {
        toast.message("Stripe is not configured in this environment. Record an authorized payment below.");
        return;
      }
      window.location.href = result.url;
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function markPaid() {
    setBusy("paid");
    try {
      await mutate.recordManualPayment({ pilotId: id, note, confirm });
      toast.success("Payment recorded via authorized admin action");
      setConfirm("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function savePilot() {
    setBusy("pilot");
    try {
      await mutate.patchPilot({ id, title, scope });
      toast.success("Pilot updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function markInputs() {
    setBusy("inputs");
    try {
      await mutate.patchPilot({ id, markInputsReceived: true, scope });
      toast.success("Required inputs marked received — SLA clock started");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function closePilot() {
    setBusy("close");
    try {
      await mutate.patchPilot({ id, status: "closed" });
      toast.success("Pilot closed");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function runPreview() {
    setBusy("preview");
    try {
      const result = await mutate.previewDecision({ evidence });
      if ("error" in result) {
        setPreview(result.error);
      } else {
        setPreview(
          `${result.proposedAction} · ${result.recommendedBand}${result.requiresHumanApproval ? " · needs human approval" : ""}\n${result.confidenceRationale}`,
        );
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveDecision() {
    setBusy("decision");
    try {
      const d = await mutate.createDecision({ pilotId: id, evidence });
      toast.success(
        d.proposedAction === "BLOCK"
          ? "BLOCK proposed — waiting for founder/admin approval"
          : `Advisory ${d.proposedAction} recorded`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function approve(decisionId: string) {
    setBusy("approve");
    try {
      await mutate.approveDecision({ id: decisionId, note: "Approved in workspace" });
      toast.success("Human approval recorded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function issueReport() {
    setBusy("report");
    try {
      await mutate.generateReport({ pilotId: id });
      toast.success("Report issued");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function download(reportId: string) {
    setBusy("pdf");
    try {
      const file = await mutate.getReportPdf({ id: reportId });
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
      setBusy(null);
    }
  }

  async function sendFeedback() {
    setBusy("fb");
    try {
      await mutate.createFeedback({
        pilotId: id,
        kind: fb.kind,
        rating: fb.rating,
        comment: fb.comment,
      });
      toast.success("Feedback captured");
      setFb({ ...fb, comment: "" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveOutcome() {
    setBusy("outcome");
    try {
      await mutate.upsertOutcome({
        pilotId: id,
        outcomeAccuracy: outcome.outcomeAccuracy,
        outcomeValue: outcome.outcomeValue,
        timeToResolutionDays: outcome.timeToResolutionDays
          ? Number(outcome.timeToResolutionDays)
          : null,
        caseStudyPermission: outcome.caseStudyPermission,
        followUpAt: outcome.followUpAt || null,
        notes: outcome.notes,
      });
      toast.success("Outcome recorded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <Skeleton className="h-64" />;
  if (error) return <MissingRecord message={error} to="/work/pilots" label="Back to pilots" />;
  if (!data) return <MissingRecord message="Pilot not found" to="/work/pilots" label="Back to pilots" />;
  const { pilot, prospect, stripeConfigured } = data;
  const decisions = data.decisions ?? [];
  const reports = data.reports ?? [];
  const feedback = data.feedback ?? [];

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Pilot"
        title={pilot.title}
        description={`${prospect.companyName} · ${pilot.slaHours}-hour target · ${money(pilot.priceUsd)}`}
        actions={
          <>
            <SampleTag on={pilot.isSample} />
            <Pill tone={pilot.paymentStatus}>{pilot.paymentStatus}</Pill>
            <Pill tone={pilot.status}>{pilot.status.replaceAll("_", " ")}</Pill>
          </>
        }
      />

      {prospect.isSample ? (
        <p className="rounded-[16px] border border-line bg-raised/60 px-4 py-3 text-sm text-mute">
          Labeled sample walkthrough. Contents are not live intelligence and must not be presented as a real-world finding.
        </p>
      ) : null}

      {waitingOnStripe && !paid ? (
        <p className="rounded-[16px] border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Confirming Stripe payment against the live ledger. This view refreshes until the verified webhook lands.
        </p>
      ) : null}

      <SlaClock inputsReceivedAt={pilot.inputsReceivedAt} slaHours={pilot.slaHours} />

      <section className="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="flex items-end gap-2">
          <Button disabled={busy !== null} onClick={savePilot}>
            {busy === "pilot" ? "Saving…" : "Save file"}
          </Button>
          {!pilot.inputsReceivedAt ? (
            <Button variant="ghost" disabled={busy !== null} onClick={markInputs}>
              Mark inputs received
            </Button>
          ) : null}
          {pilot.status !== "closed" ? (
            <Button variant="quiet" disabled={busy !== null} onClick={closePilot}>
              Close
            </Button>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Field label="Scope" hint="Required input for the 72-hour clock.">
            <Textarea value={scope} onChange={(e) => setScope(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-display text-2xl">Payment</h2>
        <p className="mt-1 max-w-2xl text-sm text-mute">
          Paid status changes only from a verified Stripe webhook or an authorized founder/admin action. Forged
          webhooks are rejected.
        </p>
        {paid ? (
          <p className="mt-4 text-sm">
            Paid {formatWhen(pilot.paidAt)} via {pilot.paidVia ?? "unknown"}
            {pilot.paidNote ? ` — ${pilot.paidNote}` : ""}.
          </p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-mute">Stripe Checkout</p>
              <p className="mt-2 text-sm text-mute">
                {stripeConfigured
                  ? "Opens Stripe in test or live mode according to the server key."
                  : "No Stripe secret is configured here. Use authorized manual recording to complete the loop in this environment."}
              </p>
              <Button className="mt-4" variant="ghost" disabled={busy !== null} onClick={checkout}>
                {busy === "checkout" ? "Opening…" : "Create Stripe checkout"}
              </Button>
            </div>
            <div className="space-y-3">
              <Field label="Authorized payment note">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Field label='Type CONFIRM'>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              <Button disabled={busy !== null} onClick={markPaid}>
                {busy === "paid" ? "Recording…" : "Record authorized payment"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Evidence-backed decision</h2>
            <p className="mt-1 max-w-xl text-sm text-mute">
              Rules are explicit and versioned. The words “fraud” or “breach” in an excerpt never auto-select BLOCK.
            </p>
          </div>
          {prospect.isSample ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEvidence(sampleHarborlineEvidence())}
              >
                Insert sample evidence
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEvidence([...sampleHarborlineEvidence(), sampleSanctionsEvidence()])}
              >
                Add sample sanctions hit
              </Button>
            </div>
          ) : null}
        </div>

        {!paid ? (
          <p className="text-sm text-warn">Analysis unlocks after payment.</p>
        ) : (
          <>
            <div className="space-y-3">{evidenceEditor}</div>
            <Button type="button" variant="quiet" size="sm" onClick={() => setEvidence([...evidence, emptyEvidence()])}>
              Add evidence
            </Button>
            {preview ? <pre className="whitespace-pre-wrap rounded-[12px] bg-ink p-3 text-xs text-mist">{preview}</pre> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" disabled={busy !== null} onClick={runPreview}>
                Preview rules
              </Button>
              <Button disabled={busy !== null} onClick={saveDecision}>
                {busy === "decision" ? "Recording…" : "Record decision"}
              </Button>
            </div>
          </>
        )}

        {decisions.length > 0 ? (
          <ul className="divide-y divide-line border-t border-line">
            {decisions.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link to="/work/decisions/$id" params={{ id: d.id }} className="font-medium hover:underline">
                    {d.proposedAction} · {d.recommendedBand}
                  </Link>
                  <p className="text-xs text-mute">
                    {d.ruleVersion} · {d.status.replace("_", " ")} · {formatWhen(d.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={d.proposedAction}>{d.proposedAction}</Pill>
                  <Pill tone={d.status}>{d.status.replace("_", " ")}</Pill>
                  {d.status === "pending_approval" ? (
                    <Button size="sm" disabled={busy !== null} onClick={() => approve(d.id)}>
                      Approve
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-display text-2xl">Report</h2>
        <p className="mt-1 text-sm text-mute">
          Generated from the stored decision and evidence. BLOCK reports require prior human approval.
        </p>
        <Button className="mt-4" disabled={busy !== null || !paid} onClick={issueReport}>
          {busy === "report" ? "Generating…" : "Generate report"}
        </Button>
        <ul className="mt-4 divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <Link to="/work/reports/$id" params={{ id: r.id }} className="hover:underline">
                {r.title}
              </Link>
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => download(r.id)}>
                PDF
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5 sm:p-6">
          <h2 className="font-display text-2xl">Feedback</h2>
          <div className="mt-4 space-y-3">
            <Field label="Kind">
              <Select value={fb.kind} onChange={(e) => setFb({ ...fb, kind: e.target.value })}>
                <option value="delivery">delivery</option>
                <option value="accuracy">accuracy</option>
                <option value="usefulness">usefulness</option>
              </Select>
            </Field>
            <Field label="Rating 1–5">
              <Input
                type="number"
                min={1}
                max={5}
                value={fb.rating}
                onChange={(e) => setFb({ ...fb, rating: Number(e.target.value) })}
              />
            </Field>
            <Field label="Comment">
              <Textarea value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} />
            </Field>
            <Button disabled={busy !== null} onClick={sendFeedback}>
              Save feedback
            </Button>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-mute">
            {feedback.map((item) => (
              <li key={item.id}>
                {item.kind} {item.rating ?? "—"}/5 — {item.comment || "No comment"}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5 sm:p-6">
          <h2 className="font-display text-2xl">Outcome</h2>
          <div className="mt-4 space-y-3">
            <Field label="Accuracy versus later reality">
              <Select
                value={outcome.outcomeAccuracy}
                onChange={(e) =>
                  setOutcome({ ...outcome, outcomeAccuracy: e.target.value as Outcome["outcomeAccuracy"] })
                }
              >
                <option value="unknown">unknown</option>
                <option value="correct">correct</option>
                <option value="partial">partial</option>
                <option value="incorrect">incorrect</option>
              </Select>
            </Field>
            <Field label="Value to the customer">
              <Input
                value={outcome.outcomeValue}
                onChange={(e) => setOutcome({ ...outcome, outcomeValue: e.target.value })}
              />
            </Field>
            <Field label="Days to resolution">
              <Input
                inputMode="numeric"
                value={outcome.timeToResolutionDays}
                onChange={(e) => setOutcome({ ...outcome, timeToResolutionDays: e.target.value })}
              />
            </Field>
            <Field label="Case-study permission">
              <Select
                value={outcome.caseStudyPermission}
                onChange={(e) =>
                  setOutcome({
                    ...outcome,
                    caseStudyPermission: e.target.value as Outcome["caseStudyPermission"],
                  })
                }
              >
                <option value="undecided">undecided</option>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </Select>
            </Field>
            <Field label="Follow-up date" hint="When you will check later reality against this file.">
              <Input
                type="date"
                value={outcome.followUpAt}
                onChange={(e) => setOutcome({ ...outcome, followUpAt: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <Textarea value={outcome.notes} onChange={(e) => setOutcome({ ...outcome, notes: e.target.value })} />
            </Field>
            <Button disabled={busy !== null} onClick={saveOutcome}>
              Save outcome
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
