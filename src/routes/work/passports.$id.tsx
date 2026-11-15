import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorNote, PageHeader, Skeleton } from "@/components/page-header";
import { Pill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createPassport,
  deletePassportDraft,
  getPassport,
  lookupPassport,
  revokePassport,
  savePassportDraft,
  sealPassport,
} from "@/lib/provenance/api";
import { passportKeys } from "@/lib/provenance/keys";
import {
  COVERED_COUNTRIES,
  MATERIALS,
  requiredStages,
  sha256Hex,
  STAGE_LABEL,
  STATUS_TEXT,
  type EvidenceFile,
  type Material,
  type Stage,
  type StageDeclaration,
} from "@/lib/provenance/passport";
import { formatWhen } from "@/lib/verityx/format";
import { errorMessage } from "@/lib/verityx/live";

export const Route = createFileRoute("/work/passports/$id")({ component: PassportDetail });

type Draft = {
  lotRef: string;
  material: Material;
  massKg: string;
  description: string;
  stages: StageDeclaration[];
  inputs: string[];
};

const MAX_FILE_BYTES = 200 * 1024 * 1024;

function blankStage(stage: Stage): StageDeclaration {
  return { stage, country: "", facility: "", operator: "", recycled: false, evidence: [] };
}

function PassportDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: passportKeys.one(id), queryFn: () => getPassport({ data: { id } }), staleTime: 4_000 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [reason, setReason] = useState("");

  const data = q.data;
  const p = data?.passport;

  useEffect(() => {
    if (!p || dirty) return;
    setDraft({
      lotRef: p.lotRef,
      material: p.material,
      massKg: p.massKg ? String(p.massKg) : "",
      description: p.description,
      stages: p.stages,
      inputs: p.inputs,
    });
  }, [p, dirty]);

  const editable = p?.status === "draft";
  const required = useMemo(() => (draft ? requiredStages(draft.material) : []), [draft]);

  function patch(next: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...next } : d));
    setDirty(true);
  }

  function setStage(stage: Stage, next: Partial<StageDeclaration> | null) {
    if (!draft) return;
    const others = draft.stages.filter((s) => s.stage !== stage);
    if (next === null) return patch({ stages: others });
    const current = draft.stages.find((s) => s.stage === stage) ?? blankStage(stage);
    patch({ stages: [...others, { ...current, ...next }] });
  }

  async function addFiles(stage: Stage, files: FileList | null) {
    if (!files?.length || !draft) return;
    setBusy(`hash-${stage}`);
    try {
      const added: EvidenceFile[] = [];
      for (const f of Array.from(files)) {
        if (f.size > MAX_FILE_BYTES) {
          toast.error(`${f.name} is over 200 MB`);
          continue;
        }
        // Fingerprinted here in the browser; the file never leaves this device.
        const sha256 = await sha256Hex(new Uint8Array(await f.arrayBuffer()));
        added.push({ name: f.name.slice(0, 160), sha256, bytes: f.size });
      }
      const current = draft.stages.find((s) => s.stage === stage) ?? blankStage(stage);
      const seen = new Set(current.evidence.map((e) => e.sha256));
      setStage(stage, { evidence: [...current.evidence, ...added.filter((e) => !seen.has(e.sha256))].slice(0, 20) });
    } finally {
      setBusy(null);
    }
  }

  async function run<T>(label: string, fn: () => Promise<T>, ok?: string) {
    setBusy(label);
    try {
      const out = await fn();
      if (ok) toast.success(ok);
      return out;
    } catch (err) {
      toast.error(errorMessage(err));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    const out = await run(
      "save",
      () =>
        savePassportDraft({
          data: { id, draft: { ...draft, massKg: Number(draft.massKg || 0) } },
        }),
      "Draft saved",
    );
    if (out) {
      qc.setQueryData(passportKeys.one(id), out);
      setDirty(false);
      void qc.invalidateQueries({ queryKey: passportKeys.all });
    }
  }

  async function addInput() {
    const code = inputCode.trim().toUpperCase();
    if (!draft || !code) return;
    const hit = await run("lookup", () => lookupPassport({ data: { code } }));
    if (hit === undefined) return;
    if (!hit) {
      toast.error(`${code} is not a sealed passport. Ask your supplier for the code on their sealed passport.`);
      return;
    }
    if (hit.entry.status !== "sealed") {
      toast.error(`${code} has been revoked; ask your supplier for the passport that replaced it.`);
      return;
    }
    patch({ inputs: [...new Set([...draft.inputs, code])].sort() });
    setInputCode("");
    toast.success(`${code} · ${MATERIALS[hit.entry.material].label} from ${hit.entry.publisher}. Save to keep it.`);
  }

  async function seal() {
    if (dirty) {
      toast.error("Save the draft first.");
      return;
    }
    const out = await run("seal", () => sealPassport({ data: { id } }), "Sealed and written to the ledger");
    if (out) {
      qc.setQueryData(passportKeys.one(id), out);
      void qc.invalidateQueries({ queryKey: passportKeys.all });
    }
  }

  async function revoke() {
    const out = await run("revoke", () => revokePassport({ data: { id, reason } }), "Revoked");
    if (out) {
      qc.setQueryData(passportKeys.one(id), out);
      setReason("");
      void qc.invalidateQueries({ queryKey: passportKeys.all });
    }
  }

  async function supersede() {
    const out = await run("supersede", () => createPassport({ data: { material: p!.material, supersedesId: id } }));
    if (out) {
      void qc.invalidateQueries({ queryKey: passportKeys.all });
      await navigate({ to: "/work/passports/$id", params: { id: out.id } });
    }
  }

  async function remove() {
    const out = await run("delete", () => deletePassportDraft({ data: { id } }), "Draft deleted");
    if (out) {
      void qc.invalidateQueries({ queryKey: passportKeys.all });
      await navigate({ to: "/work/passports" });
    }
  }

  function downloadReceipt() {
    if (!p?.receiptJson) return;
    const blob = new Blob([p.receiptJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.code}-receipt.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.error || !data || !p || !draft) return <ErrorNote message={q.error ? errorMessage(q.error) : "Passport not found"} />;

  const analysis = data.analysis;
  const chainByCode = new Map(data.chain.map((c) => [c.code, c]));

  return (
    <div className="space-y-8 vx-enter">
      <PageHeader
        kicker={`Lot passport · ${p.publisher}`}
        title={p.code}
        description={
          p.status === "draft"
            ? "Draft. Only your organization can see it. Sealing writes it to the ledger and makes it readable by anyone who has its code."
            : p.status === "sealed"
              ? `Sealed ${p.sealedAt ? formatWhen(p.sealedAt) : ""}. It can no longer be edited; supersede it to correct it.`
              : `Revoked ${p.revokedAt ? formatWhen(p.revokedAt) : ""}: ${p.revokedReason ?? ""}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={p.status}>{p.status}</Pill>
            <Link to="/work/passports">
              <Button variant="ghost">All passports</Button>
            </Link>
          </div>
        }
      />

      <section className="panel space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={analysis.status}>{analysis.status.replace(/-/g, " ")}</Pill>
          <p className="text-sm text-mute">{STATUS_TEXT[analysis.status]}</p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {analysis.stages.map((s) => (
            <li key={s.stage} className="rounded-[12px] border border-line p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{s.stage}</p>
              {s.covered ? (
                s.sources.map((src, i) => (
                  <p key={i} className={`mt-1 text-sm ${COVERED_COUNTRIES[src.country] ? "text-bad" : ""}`}>
                    {src.country} · {src.facility}
                    {src.recycled ? " · recycled" : ""}
                    <span className="block font-mono text-[11px] text-mute">{src.code}</span>
                  </p>
                ))
              ) : (
                <p className="mt-1 text-sm text-warn">Not declared</p>
              )}
            </li>
          ))}
        </ol>
        {analysis.revokedInputs.length ? (
          <p className="text-sm text-bad">Revoked input: {analysis.revokedInputs.join(", ")}. Replace it with the passport that superseded it.</p>
        ) : null}
        <p className="text-xs text-mute">
          These are the publishers' own declarations. VerityX checks that the chain is complete and signed; it does not audit
          facilities and does not certify compliance with DFARS 252.225-7052.
        </p>
      </section>

      <section className="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Lot or batch number">
          <Input value={draft.lotRef} disabled={!editable} maxLength={80} onChange={(e) => patch({ lotRef: e.target.value })} />
        </Field>
        <Field label="Material">
          <Select
            value={draft.material}
            disabled={!editable}
            onChange={(e) => {
              const material = e.target.value as Material;
              const allowed = requiredStages(material);
              patch({ material, stages: draft.stages.filter((s) => allowed.includes(s.stage)) });
            }}
          >
            {Object.entries(MATERIALS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lot mass (kg)">
          <Input
            inputMode="decimal"
            value={draft.massKg}
            disabled={!editable}
            onChange={(e) => patch({ massKg: e.target.value.replace(/[^0-9.]/g, "") })}
          />
        </Field>
        <Field label="Description" hint="Grade, part number or anything a buyer needs to match this lot.">
          <Textarea value={draft.description} disabled={!editable} maxLength={500} rows={2} onChange={(e) => patch({ description: e.target.value })} />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Stages your organization declares</h2>
        <p className="max-w-3xl text-sm text-mute">
          Declare only the stages you performed or can evidence directly. Leave the rest to your input lots: each upstream stage must
          be covered either here or by every input passport.
        </p>
        <div className="grid gap-3">
          {required.map((stage) => {
            const decl = draft.stages.find((s) => s.stage === stage);
            const fromInputs = analysis.stages.find((s) => s.stage === stage)?.sources.filter((src) => src.code !== p.code) ?? [];
            return (
              <article key={stage} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-medium">{STAGE_LABEL[stage]}</h3>
                  {editable ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!decl}
                        onChange={(e) => setStage(stage, e.target.checked ? {} : null)}
                      />
                      We declare this stage
                    </label>
                  ) : null}
                </div>
                {!decl ? (
                  <p className="mt-2 text-sm text-mute">
                    {fromInputs.length
                      ? `From inputs: ${fromInputs.map((s) => `${s.country} (${s.code})`).join(", ")}`
                      : "Not declared here or by an input yet."}
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Country (2-letter)">
                      <Input
                        value={decl.country}
                        maxLength={2}
                        disabled={!editable}
                        onChange={(e) => setStage(stage, { country: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
                      />
                    </Field>
                    <Field label="Facility">
                      <Input value={decl.facility} maxLength={160} disabled={!editable} onChange={(e) => setStage(stage, { facility: e.target.value })} />
                    </Field>
                    <Field label="Operator (optional)">
                      <Input value={decl.operator} maxLength={160} disabled={!editable} onChange={(e) => setStage(stage, { operator: e.target.value })} />
                    </Field>
                    {COVERED_COUNTRIES[decl.country] ? (
                      <p className="text-sm text-bad sm:col-span-3">
                        {COVERED_COUNTRIES[decl.country]} is a covered country for this stage under DFARS 252.225-7052.
                      </p>
                    ) : null}
                    {stage === "mined" ? (
                      <label className="flex items-center gap-2 text-sm sm:col-span-3">
                        <input
                          type="checkbox"
                          checked={decl.recycled}
                          disabled={!editable}
                          onChange={(e) => setStage(stage, { recycled: e.target.checked })}
                        />
                        Recycled feedstock (recovered at this facility, not mined)
                      </label>
                    ) : null}
                    <div className="sm:col-span-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Evidence fingerprints</p>
                      <ul className="mt-2 space-y-1">
                        {decl.evidence.map((e) => (
                          <li key={e.sha256} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 break-all">
                              {e.name} <span className="font-mono text-[11px] text-mute">{e.sha256.slice(0, 16)}…</span>
                            </span>
                            {editable ? (
                              <button
                                type="button"
                                className="text-xs text-mute hover:text-bad"
                                onClick={() => setStage(stage, { evidence: decl.evidence.filter((x) => x.sha256 !== e.sha256) })}
                              >
                                Remove
                              </button>
                            ) : null}
                          </li>
                        ))}
                        {!decl.evidence.length ? <li className="text-sm text-warn">No evidence attached yet.</li> : null}
                      </ul>
                      {editable ? (
                        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-gold">
                          <input
                            type="file"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              void addFiles(stage, e.target.files);
                              e.target.value = "";
                            }}
                          />
                          {busy === `hash-${stage}` ? "Fingerprinting…" : "Add evidence files"}
                        </label>
                      ) : null}
                      <p className="mt-1 text-xs text-mute">
                        Certificates of origin, assays, invoices, mill certs. Files are fingerprinted in your browser and never uploaded;
                        keep the originals so a buyer or auditor can match them later.
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-2xl">Input lots</h2>
        <p className="text-sm text-mute">The sealed passports of the lots this lot was made from. Your supplier gives you the code.</p>
        <ul className="space-y-2">
          {draft.inputs.map((code) => {
            const c = chainByCode.get(code);
            return (
              <li key={code} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2 text-sm">
                <span>
                  <span className="font-mono">{code}</span>
                  {c ? ` · ${MATERIALS[c.material].label} · ${c.publisher} · lot ${c.lotRef}` : " · save to resolve"}
                </span>
                <span className="flex items-center gap-3">
                  {c ? <Pill tone={c.status}>{c.status}</Pill> : null}
                  {editable ? (
                    <button type="button" className="text-xs text-mute hover:text-bad" onClick={() => patch({ inputs: draft.inputs.filter((x) => x !== code) })}>
                      Remove
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
          {!draft.inputs.length ? <li className="text-sm text-mute">No input lots linked.</li> : null}
        </ul>
        {editable ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Add input by code">
              <Input value={inputCode} placeholder="LP-XXXX-XXXX" maxLength={12} onChange={(e) => setInputCode(e.target.value.toUpperCase())} />
            </Field>
            <Button type="button" variant="ghost" disabled={busy !== null || !inputCode} onClick={addInput}>
              {busy === "lookup" ? "Checking…" : "Check and add"}
            </Button>
          </div>
        ) : null}
      </section>

      {editable ? (
        <section className="panel space-y-4 p-5 sm:p-6">
          {data.problems.length && !dirty ? (
            <div>
              <p className="text-sm font-medium">Before it can be sealed</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warn">
                {data.problems.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy !== null || !dirty}>
              {busy === "save" ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </Button>
            {data.canSeal ? (
              <Button variant="ghost" onClick={seal} disabled={busy !== null || dirty || data.problems.length > 0}>
                {busy === "seal" ? "Sealing…" : "Seal passport"}
              </Button>
            ) : (
              <p className="self-center text-sm text-mute">A founder or admin seals passports.</p>
            )}
            <Button variant="ghost" onClick={remove} disabled={busy !== null}>
              Delete draft
            </Button>
          </div>
        </section>
      ) : (
        <section className="panel space-y-4 p-5 sm:p-6">
          <h2 className="font-display text-2xl">Seal</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-mute">Content digest (SHA-256)</dt>
              <dd className="mt-1 break-all font-mono text-xs">{p.digest}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-mute">Ledger entry</dt>
              <dd className="mt-1 break-all font-mono text-xs">{p.ledgerHash ?? "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadReceipt} disabled={!p.receiptJson}>
              Download receipt
            </Button>
            <Link to="/verify">
              <Button variant="ghost">Verify a receipt</Button>
            </Link>
            {p.status === "sealed" && data.canSeal ? (
              <Button variant="ghost" onClick={supersede} disabled={busy !== null}>
                Correct it (supersede)
              </Button>
            ) : null}
          </div>
          {p.status === "sealed" && data.canSeal ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
              <Field label="Revoke with a reason" hint="Buyers whose chain uses this lot will see it as revoked.">
                <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button variant="ghost" onClick={revoke} disabled={busy !== null || reason.trim().length < 8}>
                {busy === "revoke" ? "Revoking…" : "Revoke"}
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
