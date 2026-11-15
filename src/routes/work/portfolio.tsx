import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  acknowledgePortfolioItems,
  addPortfolioItem,
  downloadEvidencePack,
  generateEvidencePack,
  getPortfolio,
  importPortfolio,
  removePortfolioItems,
} from "@/lib/provenance/api";
import { passportKeys } from "@/lib/provenance/keys";
import { COVERED_COUNTRIES } from "@/lib/provenance/passport";
import { STATE_LABEL, STATE_ORDER, type ItemState } from "@/lib/provenance/portfolio";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/portfolio")({ component: PortfolioPage });

const TEMPLATE =
  "part number,description,program,supplier,passport code\nPN-48210,Rotor magnet N52,FA8650-27-C-0001,Example Magnetics,LP-XXXX-XXXX\nPN-48211,Actuator magnet,FA8650-27-C-0001,Example Magnetics,\n";

const TONE: Record<ItemState, string> = {
  "declared-clear": "declared-clear",
  "covered-country-declared": "covered-country-declared",
  revoked: "revoked",
  "not-found": "incomplete",
  "no-passport": "incomplete",
  incomplete: "incomplete",
};

function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function PortfolioPage() {
  const qc = useQueryClient();
  const [program, setProgram] = useState("");
  const q = useQuery({
    queryKey: passportKeys.portfolio(program),
    queryFn: () => getPortfolio({ data: { program } }),
    staleTime: 10_000,
    refetchInterval: 60_000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [item, setItem] = useState({ partNumber: "", description: "", program: "", supplier: "", passportCode: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ItemState | "changed" | "">("");

  const data = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["vx", "portfolio"] });

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(label);
    try {
      return await fn();
    } catch (err) {
      toast.error(errorMessage(err));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function doImport(text: string) {
    const out = await run("import", () => importPortfolio({ data: { csv: text } }));
    if (!out) return;
    setImportErrors(out.errors);
    setCsv("");
    toast.success(`${out.imported} line${out.imported === 1 ? "" : "s"} imported${out.errors.length ? `, ${out.errors.length} skipped` : ""}`);
    void refresh();
  }

  async function doAdd() {
    const out = await run("add", () => addPortfolioItem({ data: { item } }));
    if (!out) return;
    setItem({ partNumber: "", description: "", program: item.program, supplier: item.supplier, passportCode: "" });
    toast.success("Part added");
    void refresh();
  }

  async function acknowledge(ids: string[]) {
    const out = await run("ack", () => acknowledgePortfolioItems({ data: { ids } }));
    if (out) {
      toast.success(`${out.acknowledged} reviewed`);
      void refresh();
    }
  }

  async function remove(ids: string[]) {
    const out = await run("remove", () => removePortfolioItems({ data: { ids } }));
    if (out) {
      setSelected(new Set());
      toast.success(`${out.removed} removed`);
      void refresh();
    }
  }

  async function pack() {
    const out = await run("pack", () => generateEvidencePack({ data: { program } }));
    if (!out) return;
    download(`${out.fileStem}.pdf`, base64ToBytes(out.pdfBase64), "application/pdf");
    download(`${out.fileStem}.json`, out.json, "application/json");
    toast.success("Evidence pack sealed: PDF and JSON downloaded");
    void refresh();
  }

  async function redownload(id: string) {
    const out = await run(`dl-${id}`, () => downloadEvidencePack({ data: { id } }));
    if (!out) return;
    download(`${out.fileStem}.pdf`, base64ToBytes(out.pdfBase64), "application/pdf");
    download(`${out.fileStem}.json`, out.json, "application/json");
  }

  const rows = (data?.rows ?? []).filter((r) => (filter === "changed" ? r.changed : filter ? r.state === filter : true));
  const changedIds = (data?.rows ?? []).filter((r) => r.changed).map((r) => r.id);

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker="Provenance"
        title="Portfolio"
        description="The magnet-bearing parts on your contracts and the lot passport each ships with. Every part is checked against the published passports each time you open this page; anything that changed since you last reviewed it is flagged."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Program">
              <option value="">All programs</option>
              {(data?.programs ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Button onClick={pack} disabled={busy !== null || !data?.rows.length || !data?.canWrite}>
              {busy === "pack" ? "Sealing pack…" : "Evidence pack"}
            </Button>
          </div>
        }
      />

      {q.isPending ? <Skeleton className="h-40" /> : null}
      <ErrorNote message={q.error ? errorMessage(q.error) : null} />

      {data ? (
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <button
            type="button"
            onClick={() => setFilter(filter === "changed" ? "" : "changed")}
            className={`panel p-4 text-left ${filter === "changed" ? "ring-1 ring-gold" : ""}`}
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Changed</p>
            <p className={`mt-1 font-display text-3xl ${data.summary.changed ? "text-bad" : ""}`}>{data.summary.changed}</p>
          </button>
          {STATE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? "" : s)}
              className={`panel p-4 text-left ${filter === s ? "ring-1 ring-gold" : ""}`}
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{STATE_LABEL[s]}</p>
              <p className="mt-1 font-display text-3xl">{data.summary[s]}</p>
            </button>
          ))}
        </section>
      ) : null}

      {data && changedIds.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-bad/30 bg-bad/10 p-4 text-sm">
          <p>
            {changedIds.length} part{changedIds.length === 1 ? "" : "s"} changed since your last review — usually a supplier revoked a
            lot or an upstream lot was revoked.
          </p>
          {data.canWrite ? (
            <Button variant="ghost" onClick={() => acknowledge(changedIds)} disabled={busy !== null}>
              Mark all reviewed
            </Button>
          ) : null}
        </div>
      ) : null}

      {data && !data.rows.length && !program ? (
        <EmptyState
          title="No parts yet"
          body="Import a CSV with a part number column and, where you have one, the passport code your supplier gave you. Parts without a code show as gaps."
        />
      ) : null}

      {data && rows.length ? (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
              <tr className="border-b border-line">
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Part</th>
                <th className="px-4 py-3 font-medium">Program · supplier</th>
                <th className="px-4 py-3 font-medium">Passport</th>
                <th className="min-w-[190px] px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Declared chain</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-line align-top last:border-0 ${r.changed ? "bg-bad/5" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.partNumber}`}
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.partNumber}</p>
                    {r.description ? <p className="text-xs text-mute">{r.description}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-mute">
                    <p>{r.program || "—"}</p>
                    <p className="text-xs">{r.supplier}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.passportCode ? (
                      <Link to="/passport/$code" params={{ code: r.passportCode }} className="font-mono hover:text-gold">
                        {r.passportCode}
                      </Link>
                    ) : (
                      <span className="text-mute">—</span>
                    )}
                    {r.lot ? <p className="text-xs text-mute">{r.lot.publisher} · lot {r.lot.lotRef}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block whitespace-nowrap">
                      <Pill tone={TONE[r.state]}>{STATE_LABEL[r.state]}</Pill>
                    </span>
                    {r.changed && r.ackState ? (
                      <p className="mt-1 text-xs text-bad">
                        was {STATE_LABEL[r.ackState]}
                        {data.canWrite ? (
                          <button type="button" className="ml-2 underline" onClick={() => acknowledge([r.id])}>
                            reviewed
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                    {r.lot?.status === "revoked" && r.lot.revokedReason ? <p className="mt-1 text-xs text-mute">{r.lot.revokedReason}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.analysis
                      ? r.analysis.stages.map((s) => (
                          <span
                            key={s.stage}
                            className={`mr-2 inline-block ${
                              !s.covered ? "text-warn" : s.sources.some((x) => COVERED_COUNTRIES[x.country]) ? "text-bad" : "text-mute"
                            }`}
                          >
                            {s.stage.slice(0, 3)} {s.covered ? [...new Set(s.sources.map((x) => x.country))].join("+") : "?"}
                          </span>
                        ))
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data?.canWrite && selected.size ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => acknowledge([...selected])} disabled={busy !== null}>
            Mark {selected.size} reviewed
          </Button>
          <Button variant="ghost" onClick={() => remove([...selected])} disabled={busy !== null}>
            Remove {selected.size}
          </Button>
        </div>
      ) : null}

      {data?.canWrite ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel space-y-3 p-5 sm:p-6">
            <h2 className="font-display text-2xl">Import parts</h2>
            <p className="text-sm text-mute">
              CSV with a header row. Columns: part number (required), description, program, supplier, passport code. Re-importing a
              part with the same code updates it.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-[8px] border border-line px-4 py-2 text-sm hover:bg-raised">
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (f.size > 2_000_000) return toast.error("The file is over 2 MB");
                    await doImport(await f.text());
                  }}
                />
                {busy === "import" ? "Importing…" : "Choose CSV file"}
              </label>
              <Button variant="ghost" type="button" onClick={() => download("verityx-portfolio-template.csv", TEMPLATE, "text/csv")}>
                Download template
              </Button>
            </div>
            <Field label="…or paste CSV">
              <Textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={TEMPLATE} />
            </Field>
            <Button onClick={() => doImport(csv)} disabled={busy !== null || !csv.trim()}>
              Import pasted rows
            </Button>
            {importErrors.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-warn">
                {importErrors.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="panel space-y-3 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Add one part</h2>
              <button type="button" className="text-sm text-mute hover:text-paper" onClick={() => setShowAdd(!showAdd)}>
                {showAdd ? "Hide" : "Show"}
              </button>
            </div>
            {showAdd ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Part number">
                  <Input value={item.partNumber} maxLength={80} onChange={(e) => setItem({ ...item, partNumber: e.target.value })} />
                </Field>
                <Field label="Passport code">
                  <Input
                    value={item.passportCode}
                    maxLength={12}
                    placeholder="LP-XXXX-XXXX"
                    onChange={(e) => setItem({ ...item, passportCode: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label="Program or contract">
                  <Input value={item.program} maxLength={80} onChange={(e) => setItem({ ...item, program: e.target.value })} />
                </Field>
                <Field label="Supplier">
                  <Input value={item.supplier} maxLength={120} onChange={(e) => setItem({ ...item, supplier: e.target.value })} />
                </Field>
                <Field label="Description">
                  <Input value={item.description} maxLength={200} onChange={(e) => setItem({ ...item, description: e.target.value })} />
                </Field>
                <div className="flex items-end">
                  <Button onClick={doAdd} disabled={busy !== null || !item.partNumber.trim()}>
                    {busy === "add" ? "Adding…" : "Add part"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-mute">For a single part or a quick test.</p>
            )}
          </div>
        </section>
      ) : null}

      {data?.packs.length ? (
        <section className="panel space-y-3 p-5 sm:p-6">
          <h2 className="font-display text-2xl">Evidence packs</h2>
          <p className="text-sm text-mute">
            Each pack is sealed on the ledger when generated. The JSON carries its receipt (check it at{" "}
            <Link to="/verify" className="underline">
              /verify
            </Link>
            ); the PDF prints the same digest.
          </p>
          <ul className="space-y-2">
            {data.packs.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2 text-sm">
                <span className="min-w-0">
                  {formatWhen(p.createdAt)} · {p.program || "All programs"} · {p.itemCount} parts
                  <span className="block break-all font-mono text-[11px] text-mute">sha256 {p.digest}</span>
                </span>
                <Button variant="ghost" onClick={() => redownload(p.id)} disabled={busy !== null}>
                  {busy === `dl-${p.id}` ? "Preparing…" : "Download"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
