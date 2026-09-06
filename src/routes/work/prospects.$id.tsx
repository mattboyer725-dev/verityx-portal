import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PROSPECT_STAGES, PILOT_PRICE_USD } from "@/lib/verityx/constants";
import { formatWhen, money } from "@/lib/verityx/format";
import type { ProspectStage } from "@/lib/verityx/types";
import { errorMessage, useLiveMutations, useProspectLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/prospects/$id")({ component: ProspectDetail });

function ProspectDetail() {
  const { id } = Route.useParams();
  const { data, error, loading } = useProspectLive(id);
  const mutate = useLiveMutations();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    sector: "",
    region: "",
    stage: "lead" as ProspectStage,
    notes: "",
  });
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      companyName: data.prospect.companyName,
      contactName: data.prospect.contactName,
      contactEmail: data.prospect.contactEmail,
      sector: data.prospect.sector,
      region: data.prospect.region,
      stage: data.prospect.stage,
      notes: data.prospect.notes,
    });
  }, [data]);

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
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;
  const { prospect, pilots } = data;

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Prospect"
        title={prospect.companyName}
        description={prospect.isSample ? "Labeled sample walkthrough — not live intelligence." : "Partial updates write through to the live tenant record."}
        actions={
          <>
            <SampleTag on={prospect.isSample} />
            <Pill tone={prospect.stage}>{prospect.stage}</Pill>
          </>
        }
      />

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
        <Field label="Email">
          <Input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
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
        <h2 className="font-display text-2xl">Convert to pilot</h2>
        <p className="mt-1 text-sm text-mute">
          Opens a {money(PILOT_PRICE_USD)} engagement. The 72-hour clock starts when required inputs land.
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
