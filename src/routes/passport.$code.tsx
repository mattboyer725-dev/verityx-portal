import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Pill } from "@/components/status";
import { getPublicPassport } from "@/lib/provenance/api";
import {
  COVERED_COUNTRIES,
  MATERIALS,
  passportIntegrity,
  sha256Hex,
  STAGE_LABEL,
  STATUS_TEXT,
  type IntegrityCheck,
} from "@/lib/provenance/passport";
import { findReceipt, verifyReceipt, type ReceiptVerdict } from "@/lib/receipt";
import { KEYRING } from "@/lib/seal-keyring";
import { formatWhen } from "@/lib/verityx/format";

export const Route = createFileRoute("/passport/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.code} · Lot passport · VerityX` },
      // Codes are shared on purpose, not published: keep passports out of search engines.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicPassportPage,
});

type FileMatch = { name: string; sha256: string; hits: { code: string; stage: string; file: string }[] };

function PublicPassportPage() {
  const { code } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-passport", code],
    queryFn: () => getPublicPassport({ data: { code: code.toUpperCase() } }),
    staleTime: 30_000,
    retry: 0,
  });
  const data = q.data;
  const [checks, setChecks] = useState<IntegrityCheck[] | null>(null);
  const [receiptVerdict, setReceiptVerdict] = useState<ReceiptVerdict | null>(null);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [hashing, setHashing] = useState(false);

  const receipt = useMemo(() => {
    if (!data?.receiptJson) return null;
    try {
      return findReceipt(JSON.parse(data.receiptJson));
    } catch {
      return null;
    }
  }, [data?.receiptJson]);

  useEffect(() => {
    if (!data) return;
    let live = true;
    void (async () => {
      const chainDigests = Object.fromEntries(data.chain.map((c) => [c.code, c.digest]));
      const c = await passportIntegrity(data.entry, data.canonical, receipt?.entry.payload ?? null, chainDigests);
      const v = receipt ? await verifyReceipt(receipt, KEYRING) : null;
      if (live) {
        setChecks(c);
        setReceiptVerdict(v);
      }
    })();
    return () => {
      live = false;
    };
  }, [data, receipt]);

  const evidenceIndex = useMemo(() => {
    const idx = new Map<string, { code: string; stage: string; file: string }[]>();
    if (!data) return idx;
    for (const lot of [data.entry, ...data.chain]) {
      for (const s of lot.stages) {
        for (const e of s.evidence) {
          const list = idx.get(e.sha256) ?? [];
          list.push({ code: lot.code, stage: s.stage, file: e.name });
          idx.set(e.sha256, list);
        }
      }
    }
    return idx;
  }, [data]);

  async function checkFiles(files: FileList | null) {
    if (!files?.length) return;
    setHashing(true);
    try {
      const out: FileMatch[] = [];
      for (const f of Array.from(files).slice(0, 20)) {
        // Hashed here; the file is not sent anywhere.
        const sha256 = await sha256Hex(new Uint8Array(await f.arrayBuffer()));
        out.push({ name: f.name, sha256, hits: evidenceIndex.get(sha256) ?? [] });
      }
      setMatches(out);
    } finally {
      setHashing(false);
    }
  }

  function downloadReceipt() {
    if (!data?.receiptJson) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data.receiptJson], { type: "application/json" }));
    a.download = `${data.entry.code}-receipt.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const allChecks: { label: string; ok: boolean; detail: string }[] = [
    ...(checks ?? []).map((c) => ({ label: c.id, ok: c.ok, detail: c.detail })),
    ...(receiptVerdict
      ? [
          { label: "signature", ok: receiptVerdict.signature.ok && receiptVerdict.ledger.ok && receiptVerdict.content.ok, detail: receiptVerdict.signature.detail },
          { label: "signer", ok: receiptVerdict.key.ok, detail: receiptVerdict.key.detail },
        ]
      : []),
  ];
  const verified = checks !== null && receiptVerdict !== null && allChecks.every((c) => c.ok);

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-4">
        <p className="text-xs text-gold">Lot passport</p>
        <h1 className="mt-3 break-all font-display text-4xl tracking-tight sm:text-5xl">{code.toUpperCase()}</h1>
        {q.isPending ? <p className="mt-6 text-sm text-mute">Loading…</p> : null}
        {q.error ? <p className="mt-6 text-sm text-bad">{String((q.error as Error).message || q.error)}</p> : null}
        {!q.isPending && !q.error && !data ? (
          <div className="mt-6 max-w-2xl space-y-2 text-sm text-mute">
            <p>No sealed passport has this code.</p>
            <p>Check the code with the supplier. Drafts are never public, so a passport only appears here once it is sealed.</p>
          </div>
        ) : null}
        {data ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-mute">
            <Pill tone={data.entry.status}>{data.entry.status}</Pill>
            <span>{MATERIALS[data.entry.material]?.label}</span>
            <span>· lot {data.entry.lotRef}</span>
            <span>· {data.entry.massKg.toLocaleString("en-US")} kg</span>
            <span>· published by {data.entry.publisher}</span>
            {data.entry.sealedAt ? <span>· sealed {formatWhen(data.entry.sealedAt)}</span> : null}
          </div>
        ) : null}
      </section>

      {data ? (
        <>
          {data.entry.status === "revoked" ? (
            <section className="mx-auto max-w-6xl px-6 pb-6">
              <div className="rounded-[6px] border border-bad/30 bg-bad/10 p-5 text-sm">
                <p className="font-medium text-bad">Revoked {data.revokedAt ? formatWhen(data.revokedAt) : ""}</p>
                <p className="mt-1">{data.revokedReason}</p>
                {data.supersededBy ? (
                  <p className="mt-2">
                    Replaced by{" "}
                    <Link to="/passport/$code" params={{ code: data.supersededBy }} className="font-mono underline">
                      {data.supersededBy}
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="panel space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone={data.analysis.status}>{data.analysis.status.replace(/-/g, " ")}</Pill>
              </div>
              <p className="text-sm text-mute">{STATUS_TEXT[data.analysis.status]}</p>
              <ol className="vx-chain vx-chain-static -mx-1">
                {data.analysis.stages.map((s) => (
                  <li key={s.stage} className={s.covered ? "" : "is-missing"}>
                    <span className="vx-chain-node" aria-hidden />
                    <div className="vx-chain-body">
                      <p className="vx-chain-stage capitalize">{s.stage}</p>
                      {s.covered ? (
                        s.sources.map((src, i) => (
                          <p key={i} className="vx-chain-where !whitespace-normal">
                            {src.facility}
                            {src.recycled ? ", recycled feedstock" : ""}
                            {src.code !== data.entry.code ? (
                              <>
                                {" "}
                                <Link to="/passport/$code" params={{ code: src.code }} className="font-mono text-gold hover:underline">
                                  {src.code}
                                </Link>
                              </>
                            ) : null}
                          </p>
                        ))
                      ) : (
                        <p className="vx-chain-where text-warn">Not declared</p>
                      )}
                    </div>
                    <span className="flex flex-wrap justify-end gap-1" style={{ gridArea: "country" }}>
                      {s.sources.map((src, i) => (
                        <span key={i} className={`vx-chain-country ${COVERED_COUNTRIES[src.country] ? "is-covered" : ""}`}>
                          {src.country}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
              {data.analysis.revokedInputs.length ? (
                <p className="text-sm text-bad">Revoked input lot: {data.analysis.revokedInputs.join(", ")}.</p>
              ) : null}
            </div>

            <div className="panel space-y-3 p-6">
              <p className="text-xs text-mute">Checked in your browser</p>
              <p className={`font-display text-2xl ${checks === null ? "text-mute" : verified ? "text-ok" : "text-bad"}`}>
                {checks === null ? "Checking…" : verified ? "Seal verified" : "Does not verify"}
              </p>
              <ul className="space-y-2 text-sm">
                {allChecks.map((c) => (
                  <li key={c.label} className="flex gap-3">
                    <span className={`w-20 shrink-0 text-xs ${c.ok ? "text-ok" : "text-bad"}`}>
                      {c.label}: {c.ok ? "pass" : "fail"}
                    </span>
                    <span className="min-w-0 text-mute">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 pt-2 text-sm">
                <button type="button" onClick={downloadReceipt} className="text-gold hover:text-paper" disabled={!data.receiptJson}>
                  Download receipt
                </button>
                <Link to="/verify" className="text-mute hover:text-paper">
                  Verify a receipt
                </Link>
              </div>
              <p className="break-all font-mono text-xs text-mute">sha256 {data.entry.digest}</p>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 pb-8">
            <div className="panel space-y-3 p-6">
              <h2 className="font-display text-2xl">Check a document against this chain</h2>
              <p className="max-w-3xl text-sm text-mute">
                Got a certificate of origin, assay or invoice from the supplier? Choose it here. It is fingerprinted in this browser and
                compared with every evidence fingerprint sealed in this lot and the lots upstream of it. Nothing is uploaded.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-[4px] border border-line px-4 py-2 text-sm hover:bg-raised">
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void checkFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                {hashing ? "Fingerprinting…" : "Choose files"}
              </label>
              {matches.length ? (
                <ul className="space-y-2 text-sm">
                  {matches.map((m) => (
                    <li key={m.sha256 + m.name} className="rounded-[4px] border border-line p-3">
                      <p className={m.hits.length ? "text-ok" : "text-warn"}>
                        {m.name}: {m.hits.length ? "matches" : "no match in this chain"}
                      </p>
                      {m.hits.map((h, i) => (
                        <p key={i} className="text-xs text-mute">
                          {h.code} · {h.stage} · sealed as “{h.file}”
                        </p>
                      ))}
                      <p className="break-all font-mono text-xs text-mute">{m.sha256}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-8 lg:grid-cols-2">
            <div className="panel space-y-3 p-6">
              <h2 className="font-display text-2xl">Stages declared by {data.entry.publisher}</h2>
              {data.entry.description ? <p className="text-sm text-mute">{data.entry.description}</p> : null}
              {data.entry.stages.map((s) => (
                <div key={s.stage} className="border-t border-line pt-3 text-sm">
                  <p className="font-medium">{STAGE_LABEL[s.stage]}</p>
                  <p className={COVERED_COUNTRIES[s.country] ? "text-bad" : "text-mute"}>
                    {s.country} · {s.facility}
                    {s.operator ? ` · ${s.operator}` : ""}
                    {s.recycled ? " · recycled feedstock" : ""}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {s.evidence.map((e) => (
                      <li key={e.sha256} className="break-all text-xs text-mute">
                        {e.name} <span className="font-mono">{e.sha256.slice(0, 20)}…</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="panel space-y-5 p-6">
              <div>
                <h2 className="font-display text-2xl">Made from</h2>
                <LotList lots={data.chain.filter((c) => data.entry.inputs.includes(c.code))} empty="No input lots: every stage is declared by this publisher." />
                {data.chain.length > data.entry.inputs.length ? (
                  <p className="mt-2 text-xs text-mute">{data.chain.length - data.entry.inputs.length} more lots further upstream; open an input to follow the chain.</p>
                ) : null}
              </div>
              <div>
                <h2 className="font-display text-2xl">Used in</h2>
                <LotList lots={data.usedIn} empty="No sealed lot names this one as an input yet." />
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 pb-16">
            <p className="max-w-3xl text-xs leading-relaxed text-mute">
              A lot passport is its publisher’s own declaration of where each restricted stage happened, with fingerprints of the
              evidence. VerityX checks that the chain is complete and that each declaration was sealed unchanged; it does not audit
              facilities and does not certify compliance with DFARS 252.225-7052 or any other rule. Covered countries for that rule
              are China, Russia, Iran and North Korea.
            </p>
          </section>
        </>
      ) : null}

      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}

function LotList({
  lots,
  empty,
}: {
  lots: { code: string; publisher: string; lotRef: string; material: keyof typeof MATERIALS; status: string }[];
  empty: string;
}) {
  if (!lots.length) return <p className="mt-2 text-sm text-mute">{empty}</p>;
  return (
    <ul className="mt-2 space-y-2">
      {lots.map((l) => (
        <li key={l.code} className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-line px-3 py-2 text-sm">
          <span className="min-w-0">
            <Link to="/passport/$code" params={{ code: l.code }} className="font-mono hover:text-gold">
              {l.code}
            </Link>
            <span className="text-mute">
              {" "}
              · {MATERIALS[l.material]?.label} · {l.publisher} · lot {l.lotRef}
            </span>
          </span>
          <Pill tone={l.status}>{l.status}</Pill>
        </li>
      ))}
    </ul>
  );
}
