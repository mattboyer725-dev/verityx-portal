import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MissingRecord, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { outreachCopy, prospectReady } from "@/lib/verityx/book";
import { PROSPECT_STAGES, PILOT_PRICE_USD } from "@/lib/verityx/constants";
import { formatWhen, formatWhenPrecise, money } from "@/lib/verityx/format";
import type { ProspectStage } from "@/lib/verityx/types";
import { errorMessage, useLiveMutations, useProspectLive, useWorkspaceLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/prospects/$id")({ component: ProspectDetail });

function ProspectDetail() {
  const { id } = Route.useParams();
  const { data, error, loading } = useProspectLive(id);
  const { data: workspace } = useWorkspaceLive();
  const mutate = useLiveMutations();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactRole: "",
    sector: "",
    region: "",
    stage: "lead" as ProspectStage,
    notes: "",
  });
  const [scope, setScope] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const sender =
    workspace?.members.find((m) => m.userId === workspace.userId)?.name ||
    workspace?.members[0]?.name ||
    "Matt Boyer";

  useEffect(() => {
    if (!data) return;
    setForm({
      companyName: data.prospect.companyName,
      contactName: data.prospect.contactName,
      contactEmail: data.prospect.contactEmail,
      contactRole: data.prospect.contactRole,
      sector: data.prospect.sector,
      region: data.prospect.region,
      stage: data.prospect.stage,
      notes: data.prospect.notes,
    });
    const copy = outreachCopy({
      companyName: data.prospect.companyName,
      contactName: data.prospect.contactName,
      senderName: sender,
    });
    setSubject(copy.subject);
    setBody(copy.body);
  }, [data, sender]);

  const ready = useMemo(
    () =>
      prospectReady({
        companyName: form.companyName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        notes: form.notes,
        outreachCount: data?.prospect.outreachCount ?? 0,
      }),
    [form, data],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate.patchProspect({ id, ...form });
      toast.success("Prospect updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const mailto = form.contactEmail.trim()
    ? `mailto:${encodeURIComponent(form.contactEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "";

  async function contactThem() {
    if (!form.contactEmail.trim()) {
      toast.error("Add a contact email, save, then contact.");
      return;
    }
    setBusy(true);
    try {
      await mutate.patchProspect({ id, ...form });
      await mutate.logOutreach({ id, channel: "email", subject, body });
      toast.success("Outreach logged on the file");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyOutreach() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success("Outreach copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function convert() {
    setBusy(true);
    try {
      const pilot = await mutate.createPilot({ prospectId: id, scope });
      toast.success("Pilot opened — awaiting payment");
      await navigate({ to: "/work/pilots/$id", params: { id: pilot.id } });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this prospect? Pilots already attached will block this.")) return;
    setBusy(true);
    try {
      await mutate.deleteProspect({ id });
      toast.success("Prospect removed");
      await navigate({ to: "/work/prospects" });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-64" />;
  if (error) return <MissingRecord message={error} to="/work/prospects" label="Back to prospects" />;
  if (!data) return <MissingRecord message="Prospect not found" to="/work/prospects" label="Back to prospects" />;
  const { prospect, pilots, outreach } = data;

  const checks: [string, boolean][] = [
    ["Company", ready.company],
    ["Named contact", ready.contact],
    ["Email", ready.email],
    ["Discovery notes", ready.notes],
    ["Contacted", ready.contacted],
  ];

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Prospect"
        title={prospect.companyName}
        description={
          prospect.isSample
            ? "Labeled sample walkthrough — not live intelligence."
            : prospect.bookKey
              ? "VerityX own book. Finish the file, contact them, then open a paid pilot."
              : "Finish the file, contact them, then convert to a $2,500 pilot."
        }
        actions={
          <>
            <SampleTag on={prospect.isSample} />
            <Pill tone={prospect.stage}>{prospect.stage}</Pill>
          </>
        }
      />

      <section className="panel p-5 sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Finish this file</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {checks.map(([label, on]) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-[12px] border border-line bg-ink/50 px-3 py-2 text-sm"
            >
              <Check className={`size-4 ${on ? "text-ok" : "text-mute/40"}`} strokeWidth={1.8} />
              <span className={on ? "text-paper" : "text-mute"}>{label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-mute">
          {ready.readyToPilot
            ? "File is finished and contacted. Open the paid pilot below."
            : ready.finishable
              ? "File is complete. Contact them, then convert."
              : "Save a named contact and working email, then contact them."}
        </p>
      </section>

      <form className="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={save}>
        <Field label="Company">
          <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </Field>
        <Field label="Stage">
          <Select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as ProspectStage })}>
            {PROSPECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact">
          <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
        </Field>
        <Field label="Role">
          <Input value={form.contactRole} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} />
        </Field>
        <Field label="Email" hint="Required to contact. Public role inboxes are fine; do not invent a personal address.">
          <Input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </Field>
        <Field label="Sector">
          <Input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
        </Field>
        <Field label="Region">
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Discovery notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            Save changes
          </Button>
          <Button type="button" variant="danger" disabled={busy} onClick={remove}>
            Delete
          </Button>
        </div>
      </form>

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Contact them</h2>
            <p className="mt-1 text-sm text-mute">
              Logs the outreach on this file and opens mail with the $2,500 / 72-hour pilot note. Last contact:{" "}
              {formatWhenPrecise(prospect.lastContactedAt)}
              {prospect.outreachCount ? ` · ${prospect.outreachCount} logged` : ""}.
            </p>
          </div>
          <Mail className="size-5 text-mute" strokeWidth={1.6} />
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-48" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !ready.email} onClick={contactThem}>
            {busy ? "Logging…" : "Log contact"}
          </Button>
          {mailto ? (
            <a
              href={mailto}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-line px-4 text-sm text-paper hover:bg-raised"
            >
              Open mail
            </a>
          ) : null}
          <Button type="button" variant="ghost" onClick={copyOutreach}>
            <Copy className="size-4" strokeWidth={1.6} />
            Copy
          </Button>
        </div>
        {outreach.length > 0 ? (
          <ul className="mt-6 divide-y divide-line border-t border-line">
            {outreach.map((o) => (
              <li key={o.id} className="py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{o.subject}</span>
                  <span className="shrink-0 text-xs tabular-nums text-mute">{formatWhenPrecise(o.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-mute">{o.channel}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel p-5 sm:p-6">
        <h2 className="font-display text-2xl">Convert to pilot</h2>
        <p className="mt-1 text-sm text-mute">
          Opens a {money(PILOT_PRICE_USD)} engagement. The 72-hour clock starts when required inputs land.
          {ready.readyToPilot ? " This file is ready." : " Contact them first so the commercial trail is on the record."}
        </p>
        <Field label="Scope" hint="What will be examined. This is the required input for the SLA.">
          <Textarea value={scope} onChange={(e) => setScope(e.target.value)} className="mt-3" />
        </Field>
        <Button className="mt-4" disabled={busy} onClick={convert}>
          Open pilot
        </Button>

        {pilots.length > 0 ? (
          <ul className="mt-6 divide-y divide-line border-t border-line">
            {pilots.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <Link to="/work/pilots/$id" params={{ id: p.id }} className="hover:underline">
                  {p.title}
                </Link>
                <span className="flex gap-2">
                  <Pill tone={p.paymentStatus}>{p.paymentStatus}</Pill>
                  <span className="tabular-nums text-mute">{formatWhen(p.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
