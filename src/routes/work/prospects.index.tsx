import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PROSPECT_STAGES } from "@/lib/verityx/constants";
import { formatWhen } from "@/lib/verityx/format";
import type { Prospect, ProspectStage } from "@/lib/verityx/types";
import { errorMessage, useLiveMutations, useProspectsLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/prospects/")({ component: ProspectsPage });

type Filter = "all" | "need_email" | "ready" | "contacted";

function matches(p: Prospect, filter: Filter) {
  const hasEmail = Boolean(p.contactEmail.trim());
  if (filter === "need_email") return !hasEmail && p.stage !== "lost";
  if (filter === "ready") return hasEmail && p.outreachCount === 0 && p.stage !== "lost";
  if (filter === "contacted") return p.outreachCount > 0;
  return true;
}

function ProspectsPage() {
  const { data, error, loading } = useProspectsLive();
  const mutate = useLiveMutations();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
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

  const rows = useMemo(() => (data ?? []).filter((p) => matches(p, filter)), [data, filter]);
  const needEmail = (data ?? []).filter((p) => matches(p, "need_email")).length;
  const ready = (data ?? []).filter((p) => matches(p, "ready")).length;

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

  async function openBook() {
    setBusy(true);
    try {
      const result = await mutate.loadOwnBook();
      toast.success(
        result.created
          ? `VerityX book opened — ${result.created} companies filed`
          : `VerityX book already on file — ${result.total} companies`,
      );
      setFilter("need_email");
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
        description="Your own book. Finish each file, contact them, then convert to a $2,500 pilot."
        actions={
          <>
            <Button onClick={openBook} disabled={busy}>
              {busy ? "Opening…" : "Open VerityX book"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen((v) => !v)}>
              {open ? "Close form" : "New prospect"}
            </Button>
          </>
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
          <Field label="Role">
            <Input value={form.contactRole} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} />
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
          title="No book of business yet"
          body="Open the VerityX magnetics / wind / rare-earth book — sixteen companies on the desk TAM — or file one by hand."
          action={
            <Button onClick={openBook} disabled={busy}>
              Open VerityX book
            </Button>
          }
        />
      ) : null}

      {data && data.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", `All (${data.length})`],
                ["need_email", `Need email (${needEmail})`],
                ["ready", `Ready to contact (${ready})`],
                ["contacted", "Contacted"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`h-11 rounded-[8px] border px-3 text-sm ${
                  filter === key ? "border-gold bg-gold text-plum" : "border-line text-mute hover:text-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto panel">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Stage</th>
                  <th className="px-5 py-3 font-medium">Outreach</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4">
                      <Link to="/work/prospects/$id" params={{ id: p.id }} className="hover:underline">
                        {p.companyName}
                      </Link>
                      <p className="mt-1 flex items-center gap-2 text-xs text-mute">
                        {p.sector || "No sector"} {p.bookKey ? "· own book" : null} <SampleTag on={p.isSample} />
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <p>{p.contactName || "—"}</p>
                      <p className="text-xs text-mute">{p.contactEmail || p.contactRole || "Add email to contact"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Pill tone={p.stage}>{p.stage}</Pill>
                    </td>
                    <td className="px-5 py-4">
                      <Link to="/work/prospects/$id" params={{ id: p.id }} className="text-sm hover:underline">
                        {p.outreachCount > 0
                          ? `${p.outreachCount} · ${formatWhen(p.lastContactedAt)}`
                          : p.contactEmail
                            ? "Contact →"
                            : "Finish file →"}
                      </Link>
                    </td>
                    <td className="px-5 py-4 tabular-nums text-mute">{formatWhen(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? <p className="text-sm text-mute">Nothing in this queue.</p> : null}
        </>
      ) : null}
    </div>
  );
}
