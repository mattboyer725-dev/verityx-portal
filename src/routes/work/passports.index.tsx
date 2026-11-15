import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { createPassport, listPassports } from "@/lib/provenance/api";
import { passportKeys } from "@/lib/provenance/keys";
import { MATERIALS, type Material } from "@/lib/provenance/passport";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/passports/")({ component: PassportsPage });

function PassportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: passportKeys.all, queryFn: () => listPassports(), staleTime: 4_000 });
  const [material, setMaterial] = useState<Material>("ndfeb_magnet");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const { id } = await createPassport({ data: { material } });
      await qc.invalidateQueries({ queryKey: passportKeys.all });
      await navigate({ to: "/work/passports/$id", params: { id } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const data = q.data ?? null;
  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Provenance"
        title="Lot passports"
        description="Declare where each restricted stage of a lot happened — mined, separated, refined, melted, produced — with fingerprints of your evidence. Seal it, then share its code with your buyers or with the supplier who uses your lot as an input."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={material} onChange={(e) => setMaterial(e.target.value as Material)} aria-label="Material">
              {Object.entries(MATERIALS).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Button onClick={create} disabled={busy}>
              {busy ? "Creating…" : "New passport"}
            </Button>
          </div>
        }
      />
      {q.isPending ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={q.error ? errorMessage(q.error) : null} />
      {data && data.length === 0 ? (
        <EmptyState
          title="No passports yet"
          body="Start with the lot you ship most. You declare the stages your own facility performs; upstream stages come from your suppliers' passports, linked by code."
        />
      ) : null}
      {data && data.length > 0 ? (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-medium">Passport</th>
                <th className="px-5 py-3 font-medium">Material</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Stages · inputs</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-4">
                    <Link to="/work/passports/$id" params={{ id: p.id }} className="font-mono hover:underline">
                      {p.code}
                    </Link>
                    <p className="mt-1 text-xs text-mute">
                      {p.lotRef || "No lot number yet"}
                      {p.supersedes ? ` · replaces ${p.supersedes}` : ""}
                    </p>
                  </td>
                  <td className="px-5 py-4">{MATERIALS[p.material]?.label ?? p.material}</td>
                  <td className="px-5 py-4">
                    <Pill tone={p.status}>{p.status}</Pill>
                  </td>
                  <td className="px-5 py-4 tabular-nums text-mute">
                    {p.stageCount} · {p.inputCount}
                  </td>
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
