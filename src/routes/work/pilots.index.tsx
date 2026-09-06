import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill, SampleTag } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatWhen, money, slaState } from "@/lib/verityx/format";
import { usePilotsLive } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/pilots/")({ component: PilotsPage });

function PilotsPage() {
  const { data, error, loading } = usePilotsLive();

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Delivery"
        title="Pilots"
        description="Live payment and delivery state. Paid status changes only from a verified Stripe event or an authorized founder/admin action."
        actions={
          <Link to="/work/prospects">
            <Button variant="ghost">From a prospect</Button>
          </Link>
        }
      />
      {loading && !data ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={error} />
      {data && data.length === 0 ? (
        <EmptyState
          title="No pilots yet"
          body="Convert a prospect when discovery notes and scope are enough to start the 72-hour clock."
          action={
            <Link to="/work/prospects">
              <Button>Open prospects</Button>
            </Link>
          }
        />
      ) : null}
      {data && data.length > 0 ? (
        <div className="overflow-x-auto panel">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Pilot</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">SLA</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const sla = slaState(p.inputsReceivedAt, p.slaHours);
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4">
                      <Link to="/work/pilots/$id" params={{ id: p.id }} className="hover:underline">
                        {p.title}
                      </Link>
                      <p className="mt-1 flex items-center gap-2 text-xs text-mute">
                        {p.companyName} <SampleTag on={p.isSample} />
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Pill tone={p.paymentStatus}>{p.paymentStatus}</Pill>
                    </td>
                    <td className="px-5 py-4">
                      <Pill tone={p.status}>{p.status.replace("_", " ")}</Pill>
                    </td>
                    <td className={`px-5 py-4 text-xs ${sla.overdue ? "text-warn" : "text-mute"}`}>
                      {sla.label}
                    </td>
                    <td className="px-5 py-4 tabular-nums">{money(p.priceUsd)}</td>
                    <td className="px-5 py-4 tabular-nums text-mute">{formatWhen(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
