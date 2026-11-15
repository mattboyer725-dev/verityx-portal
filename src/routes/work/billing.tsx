import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { getBilling, listOrgPlans, openBillingPortal, setOrgPlan, startPlanCheckout } from "@/lib/provenance/api";
import { ENTERPRISE, FREE, PAID_PLANS, type PaidPlanId } from "@/lib/provenance/plans";
import { LEGAL } from "@/lib/legal";
import { formatWhen, money } from "@/lib/verityx/format";
import { errorMessage } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/billing")({ component: BillingPage });

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  supplier: "Supplier",
  team: "Team",
  program: "Program",
  enterprise: "Enterprise",
};

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-mute">{label}</span>
        <span className="tabular-nums">
          {used.toLocaleString("en-US")} / {max === null ? "unlimited" : max.toLocaleString("en-US")}
        </span>
      </div>
      {max !== null ? (
        <div className="mt-1 h-1.5 rounded-full bg-line">
          <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-bad" : pct >= 80 ? "bg-warn" : "bg-gold"}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function BillingPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["vx", "billing"], queryFn: () => getBilling(), staleTime: 5_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const data = q.data;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("checkout");
    if (p === "success") toast.success("Subscribed. Your plan switches on as soon as Stripe confirms payment (bank transfers can take a few days).");
    if (p === "canceled") toast.message("Checkout canceled. Nothing was charged.");
    if (p) window.history.replaceState(null, "", "/work/billing");
    // Webhooks can land a moment after the redirect.
    if (p === "success") setTimeout(() => qc.invalidateQueries({ queryKey: ["vx", "billing"] }), 4000);
  }, [qc]);

  async function go(label: string, fn: () => Promise<{ url: string | null }>) {
    setBusy(label);
    try {
      const { url } = await fn();
      if (url) window.location.assign(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.error || !data) return <ErrorNote message={q.error ? errorMessage(q.error) : "Billing unavailable"} />;

  const { billing, limits, usage } = data;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const offer = (id: PaidPlanId) => {
    const p = PAID_PLANS[id];
    const active =
      id === "supplier" ? billing.supplierPlan === "supplier" || billing.buyerPlan === "program" || billing.buyerPlan === "enterprise" : billing.buyerPlan === id;
    const otherBuyerPaid = p.side === "buyer" && billing.buyerPlan !== "free" && !active;
    return (
      <div key={id} className="panel flex flex-col p-6">
        <p className="text-xs text-mute">{p.side === "supplier" ? "Publish" : "Monitor"}</p>
        <p className="mt-2 font-display text-2xl">{p.name}</p>
        <p className="mt-1 font-display text-3xl tracking-tight">
          {money(p.annualUsd)}
          <span className="ml-1 text-base text-mute">/ year</span>
        </p>
        <p className="mt-3 text-sm text-mute">{p.summary}</p>
        <ul className="mt-3 flex-1 list-disc space-y-1 pl-5 text-sm">
          {p.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="mt-5">
          {active ? (
            <Pill tone="sealed">active</Pill>
          ) : !data.canManage ? (
            <p className="text-sm text-mute">A founder or admin can subscribe.</p>
          ) : otherBuyerPaid ? (
            <Button variant="ghost" disabled={busy !== null || !billing.hasCustomer} onClick={() => go("portal", () => openBillingPortal({ data: { origin } }))}>
              Change in Manage billing
            </Button>
          ) : (
            <Button disabled={busy !== null || !data.stripeReady} onClick={() => go(id, () => startPlanCheckout({ data: { plan: id, origin } }))}>
              {busy === id ? "Opening checkout…" : `Subscribe to ${p.name}`}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Billing"
        title={data.organization}
        description="Your plans, what you have used this year, and upgrades. Plans are billed yearly by card or US bank transfer; verifying passports is always free."
        actions={
          billing.hasCustomer && data.canManage ? (
            <Button variant="ghost" disabled={busy !== null} onClick={() => go("portal", () => openBillingPortal({ data: { origin } }))}>
              {busy === "portal" ? "Opening…" : "Manage billing and invoices"}
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-2xl">Supplier side</p>
            <Pill tone={billing.supplierPlan === "free" && limits.sealsPerYear !== null ? "draft" : "sealed"}>
              {limits.sealsPerYear === null ? (billing.supplierPlan === "supplier" ? "Supplier" : `via ${PLAN_LABEL[billing.buyerPlan]}`) : "Free"}
            </Pill>
          </div>
          <Meter label="Passports sealed (last 365 days)" used={usage.sealsLastYear} max={limits.sealsPerYear} />
          {billing.supplierPeriodEnd && billing.supplierPlan !== "free" ? (
            <p className="text-xs text-mute">
              {billing.supplierStatus === "manual" ? "Invoiced plan" : `Status ${billing.supplierStatus}`} · renews or ends {formatWhen(billing.supplierPeriodEnd)}
            </p>
          ) : null}
        </div>
        <div className="panel space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-2xl">Buyer side</p>
            <Pill tone={billing.buyerPlan === "free" ? "draft" : "sealed"}>{PLAN_LABEL[billing.buyerPlan]}</Pill>
          </div>
          <Meter label="Part lines" used={usage.parts} max={limits.maxParts} />
          <Meter label="Programs" used={usage.programs} max={limits.maxPrograms} />
          <Meter label="Evidence packs" used={usage.packs} max={limits.maxPacks} />
          {billing.buyerPeriodEnd && billing.buyerPlan !== "free" ? (
            <p className="text-xs text-mute">
              {billing.buyerStatus === "manual" ? "Invoiced plan" : `Status ${billing.buyerStatus}`} · renews or ends {formatWhen(billing.buyerPeriodEnd)}
            </p>
          ) : null}
        </div>
      </section>

      {!data.stripeReady ? (
        <p className="rounded-[4px] border border-warn/30 bg-warn/10 p-4 text-sm">
          Online payment is not switched on yet. To start a plan now, email{" "}
          {LEGAL.supportEmail ? <a className="underline" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> : "us"} and we will invoice you.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {offer("supplier")}
        {offer("team")}
        {offer("program")}
      </section>
      <p className="text-sm text-mute">
        Free: {FREE.seals} sealed passports a year, {FREE.parts} part lines in {FREE.programs} program, {FREE.packs} evidence pack. {ENTERPRISE.name} from{" "}
        {money(ENTERPRISE.fromUsd)} a year by order form and invoice. See <Link to="/pricing" className="underline">pricing</Link> and{" "}
        <Link to="/terms" className="underline">terms</Link>.
      </p>

      {data.isOwner ? <OwnerPlans /> : null}
    </div>
  );
}

function OwnerPlans() {
  const q = useQuery({ queryKey: ["vx", "org-plans"], queryFn: () => listOrgPlans(), staleTime: 5_000 });
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ organizationId: string; side: "supplier" | "buyer"; plan: string; periodEnd: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const rows = await setOrgPlan({ data: { ...edit, periodEnd: edit.periodEnd ? new Date(`${edit.periodEnd}T23:59:59Z`).toISOString() : null } });
      qc.setQueryData(["vx", "org-plans"], rows);
      void qc.invalidateQueries({ queryKey: ["vx", "billing"] });
      setEdit(null);
      toast.success("Plan set");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-4 p-6">
      <div>
        <p className="text-xs text-gold">Owner only</p>
        <h2 className="mt-1 font-display text-2xl">Organizations and invoiced plans</h2>
        <p className="mt-1 text-sm text-mute">
          For customers who pay by invoice or wire: set their plan and end date here. Stripe subscriptions update themselves.
        </p>
      </div>
      <ErrorNote message={q.error ? errorMessage(q.error) : null} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-mute">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium">Organization</th>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Buyer</th>
              <th className="px-3 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <p>{o.name}</p>
                  <p className="text-xs text-mute">
                    {o.members} member{o.members === 1 ? "" : "s"} · since {formatWhen(o.createdAt)}
                  </p>
                </td>
                {(["supplier", "buyer"] as const).map((side) => (
                  <td key={side} className="px-3 py-2">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() =>
                        setEdit({
                          organizationId: o.id,
                          side,
                          plan: side === "supplier" ? o.supplierPlan : o.buyerPlan,
                          periodEnd: ((side === "supplier" ? o.supplierPeriodEnd : o.buyerPeriodEnd) ?? "").slice(0, 10),
                          note: o.note,
                        })
                      }
                    >
                      {PLAN_LABEL[side === "supplier" ? o.supplierPlan : o.buyerPlan]}
                    </button>
                    <p className="text-xs text-mute">{(side === "supplier" ? o.supplierStatus : o.buyerStatus) ?? ""}</p>
                  </td>
                ))}
                <td className="px-3 py-2 text-xs text-mute">{o.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <Select aria-label="Plan" value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })}>
            {(edit.side === "supplier" ? ["free", "supplier"] : ["free", "team", "program", "enterprise"]).map((p) => (
              <option key={p} value={p}>
                {PLAN_LABEL[p]}
              </option>
            ))}
          </Select>
          <Input aria-label="End date" type="date" value={edit.periodEnd} onChange={(e) => setEdit({ ...edit, periodEnd: e.target.value })} />
          <Input aria-label="Note" placeholder="Invoice number, PO…" value={edit.note} maxLength={300} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : `Set ${edit.side} plan`}
          </Button>
          <Button variant="ghost" onClick={() => setEdit(null)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </section>
  );
}
