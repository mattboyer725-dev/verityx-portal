import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { findReceipt, verifyReceipt, type ReceiptVerdict, type SealReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Verify a seal · VerityX" }] }),
  component: VerifyPage,
});

type Published = { available: boolean; publicKey?: string; kid?: string; ephemeral?: boolean };

function Row({ label, r }: { label: string; r: { ok: boolean; detail: string } }) {
  return (
    <li className="grid grid-cols-[5.5rem_1fr] gap-4 border-t border-line py-3 first:border-0">
      <span className={`font-mono text-xs uppercase tracking-[0.12em] ${r.ok ? "text-ok" : "text-bad"}`}>
        {r.ok ? "Pass" : "Fail"} · {label}
      </span>
      <span className="text-sm leading-relaxed">{r.detail}</span>
    </li>
  );
}

function VerifyPage() {
  const [published, setPublished] = useState<Published | null>(null);
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<SealReceipt | null>(null);
  const [verdict, setVerdict] = useState<ReceiptVerdict | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/seal-key")
      .then((r) => r.json())
      .then((j: Published) => setPublished(j))
      .catch(() => setPublished({ available: false }));
  }, []);

  async function check(raw: string) {
    setErr("");
    setVerdict(null);
    setReceipt(null);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      setErr("That is not valid JSON. Drop the receipt file or the exported packet exactly as downloaded.");
      return;
    }
    const r = findReceipt(json);
    if (!r) {
      setErr("No VerityX seal receipt was found in that file.");
      return;
    }
    setReceipt(r);
    setVerdict(await verifyReceipt(r, published?.available ? published.publicKey : null));
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) {
      setErr("That file is larger than a receipt should be.");
      return;
    }
    const t = await f.text();
    setText(t);
    await check(t);
  }

  const p = receipt?.entry.payload as Record<string, unknown> | undefined;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-6 pt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">Verify a seal</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.02] tracking-tight sm:text-6xl">
          Check a VerityX record yourself. No account, no trust required.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute">
          Drop a seal receipt or an exported evidence packet. The checks run in this browser, on the file you give it:
          nothing is uploaded. It confirms the record was not changed, that it sits in the VerityX ledger, and that VerityX
          signed it.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid content-start gap-4">
          <label
            className="panel grid cursor-pointer place-items-center gap-2 border-dashed p-8 text-center text-sm text-mute hover:border-gold"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files?.[0]);
            }}
          >
            <span className="text-paper">Drop the receipt or packet here</span>
            <span>or choose the .json file</span>
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span>…or paste it</span>
            <textarea
              className="h-40 w-full rounded-[8px] border border-line bg-ink/60 p-3 font-mono text-xs text-paper focus:border-gold focus:outline-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            onClick={() => void check(text)}
            className="inline-flex h-11 w-fit items-center rounded-[8px] bg-gold px-5 text-sm font-medium text-plum"
          >
            Verify
          </button>
          {err ? (
            <p role="alert" className="text-sm text-bad">
              {err}
            </p>
          ) : null}
          <div className="panel p-5 text-xs leading-relaxed text-mute">
            <p className="text-paper">VerityX’s published seal key</p>
            {published?.available ? (
              <p className="mt-2 break-all font-mono">
                {published.publicKey} <span className="text-mute">· id {published.kid}</span>
                {published.ephemeral ? <span className="text-warn"> · ephemeral development key</span> : null}
              </p>
            ) : (
              <p className="mt-2">Not available from this server right now.</p>
            )}
            <p className="mt-3">
              Prefer not to trust this page? The same checks run with Python and OpenSSL alone:{" "}
              <a className="text-gold hover:text-paper" href="https://github.com/mattboyer725-dev/verityx-portal/blob/main/scripts/verify-receipt.py">
                verify-receipt.py
              </a>
              .
            </p>
          </div>
        </div>

        <div className="grid content-start gap-4" aria-live="polite">
          {!verdict || !receipt ? (
            <div className="panel p-6 text-sm leading-relaxed text-mute">
              The result appears here: four checks, each with what it proves. A single failure means the record should not be
              relied on.
            </div>
          ) : (
            <>
              <div className={`rounded-[12px] border p-5 ${verdict.valid ? "border-ok/50 bg-ok/10 text-ok" : "border-bad/50 bg-bad/10 text-bad"}`}>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em]">Result</p>
                <p className="mt-2 font-display text-3xl tracking-tight">
                  {verdict.valid ? "Valid — unchanged, in the ledger, signed by VerityX" : "Not valid — do not rely on this record"}
                </p>
              </div>
              <div className="panel p-6">
                <ul>
                  <Row label="Content" r={verdict.content} />
                  <Row label="Ledger" r={verdict.ledger} />
                  <Row label="Signature" r={verdict.signature} />
                  <Row label="Signer" r={verdict.key} />
                </ul>
              </div>
              <div className="panel grid gap-2 p-6 text-sm">
                <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-mute">What was sealed</h2>
                {p?.title ? <p className="font-display text-xl">{String(p.title)}</p> : null}
                {p?.choice ? <p>Verdict: {String(p.choice)}</p> : null}
                {p?.context ? <p className="text-mute">{String(p.context)}</p> : null}
                <p className="text-mute">
                  by {receipt.entry.actor} · {new Date(receipt.entry.timestamp * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC
                </p>
                <p className="break-all font-mono text-xs text-mute">fingerprint {receipt.entry.hash}</p>
                <p className="break-all font-mono text-xs text-mute">ledger root {receipt.merkle.root}</p>
              </div>
              <p className="text-xs text-mute">
                What this does not prove: that the prices and screens behind the record were correct — only that this is
                exactly what VerityX recorded, when it says. See <Link to="/core" className="text-gold">the ledger</Link>.
              </p>
            </>
          )}
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
