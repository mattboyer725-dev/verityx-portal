import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PROSPECT_STAGES } from "@/lib/verityx/constants";
import { formatWhen } from "@/lib/verityx/format";
import type { ProspectStage } from "@/lib/verityx/types";
import { errorMessage, useLiveMutations, useProspectsLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/prospects/")({ component: ProspectsPage });

function ProspectsPage() {
  const { data, error, loading } = useProspectsLive();
  const mutate = useLiveMutations();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    sector: "",
    region: "",
    stage: "lead" as ProspectStage,
    notes: "",
  });

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await mutate.createProspect(form);
      toast.success("Prospect filed");
      await navigate({ to: "/work/prospects/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="CRM"
        title="Prospects"
        description="Live pipeline from the tenant database. Qualify, discover, then convert to a $2,500 pilot."
        actions={
          <Button variant={open ? "ghost" : "primary"} onClick={() => setOpen((v) => !v)}>
            {open ? "Close form" : "New prospect"}
          </Button>
        }
      />

      {open ? (
        <form className="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6" onSubmit={onCreate}>
          <Field label="Company">
            <Input
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as ProspectStage })}
            >
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
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "File prospect"}
            </Button>
          </div>
        </form>
      ) : null}

      {loading && !data ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={error} />

      {data && data.length === 0 && !open ? (
        <EmptyState
          title="Pipeline is empty"
          body="File the first company. Conversion to a pilot happens from the prospect record."
          action={<Button onClick={() => setOpen(true)}>New prospect</Button>}
        />
      ) : null}

      {data && data.length > 0 ? (
        <div className="overflow-x-auto panel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Region</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <Link to="/work/prospects/$id" params={{ id: p.id }} className="hover:underline">
                      {p.companyName}
                    </Link>
                    <p className="mt-1 flex items-center gap-2 text-xs text-mute">
                      {p.sector || "No sector"} <SampleTag on={p.isSample} />
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <p>{p.contactName || "—"}</p>
                    <p className="text-xs text-mute">{p.contactEmail || "No email"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={p.stage}>{p.stage}</Pill>
                  </td>
                  <td className="px-5 py-4 text-mute">{p.region || "—"}</td>
                  <td className="px-5 py-4 tabular-nums text-mute">{formatWhen(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
