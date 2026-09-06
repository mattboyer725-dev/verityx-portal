import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage, useLiveMutations, useWorkspaceLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data, error, loading } = useWorkspaceLive();
  const mutate = useLiveMutations();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setName(data.organization.name);
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate.updateOrg({ name });
      toast.success("Organization updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-40" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Workspace"
        title="Settings"
        description="Single-organization ready, with tenant isolation already in the data model. Records never leak to another workspace."
      />
      <form className="panel max-w-xl space-y-4 p-5 sm:p-6" onSubmit={save}>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={data.role}>{data.role}</Pill>
          <span className="text-xs text-mute">{data.organization.slug}</span>
        </div>
        <Field label="Organization name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      </form>
      <section className="panel max-w-xl space-y-3 p-5 text-sm sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Live configuration</p>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-mute">Opened</dt>
          <dd>{formatWhen(data.organization.createdAt)}</dd>
          <dt className="text-mute">Rules</dt>
          <dd className="font-mono text-xs">{data.ruleVersion}</dd>
          <dt className="text-mute">Stripe</dt>
          <dd>{data.stripeConfigured ? "Configured" : "Not configured in this environment"}</dd>
        </dl>
        <p className="pt-2 leading-relaxed text-mute">
          Roles: founder and admin can record payment and approve BLOCK. Analysts file evidence and reports. Viewers
          read. Payment never flips to paid from the client — only a verified Stripe event or this authorized path.
        </p>
      </section>
      <section className="panel max-w-xl p-5 sm:p-6">
        <h2 className="font-display text-2xl">Seats</h2>
        <p className="mt-1 text-sm text-mute">Live membership for this tenant. Isolation is per organization_id.</p>
        <ul className="mt-4 divide-y divide-line">
          {(data.members ?? []).length === 0 ? (
            <li className="py-3 text-sm text-mute">No seats on this tenant yet.</li>
          ) : (
            (data.members ?? []).map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{m.name}</p>
                  <p className="truncate text-xs text-mute">{m.email || m.userId.slice(0, 8)}</p>
                </div>
                <Pill tone={m.role}>{m.role}</Pill>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
