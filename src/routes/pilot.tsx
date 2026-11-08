import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { requestPilot } from "@/lib/pilot-api";
import { COMMODITIES, PO_BANDS } from "@/lib/pilot-request";
import { PILOT_PRICE_USD, PILOT_SLA_HOURS } from "@/lib/verityx/constants";
import { money } from "@/lib/verityx/format";

export const Route = createFileRoute("/pilot")({
  head: () => ({ meta: [{ title: "Start a pilot · VerityX" }] }),
  validateSearch: (s: Record<string, unknown>): { canceled?: 1 } => (s.canceled === "1" || s.canceled === 1 ? { canceled: 1 } : {}),
  component: PilotPage,
});

const STEPS = [
  ["Hour 0", "You send one live purchase order for magnets, rare earths, copper conductor or electrical steel, with any quotes you have."],
  ["Hours 1–48", "We price it from what it is made of, compare it with your quotes and your licensed benchmark, and screen the supplier against GLEIF and the UN sanctions list."],
  ["Hours 48–72", "You get a written evidence packet and an advisory decision — proceed, review or hold — with every reason and source."],
  ["After", "Every finding is sealed in a tamper-evident ledger. Anyone you share it with can verify it at /verify, without an account."],
] as const;

const NOT = [
  "Not a legal finding, audit opinion or fraud determination — a person decides.",
  "Nothing changes in your systems; we never touch your ERP.",
  "No paid price assessments are resold; your own licensed benchmark is used when you provide it.",
];

const inputCls =
  "h-11 w-full rounded-[8px] border border-line bg-ink/60 px-3 text-paper placeholder:text-mute/70 focus:border-gold focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-paper">{label}</span>
      {children}
      {hint ? <span className="text-xs text-mute">{hint}</span> : null}
    </label>
  );
}

function PilotPage() {
  const { canceled } = Route.useSearch();
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "", commodity: "", poBand: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await requestPilot({ data: form });
      if (r.ok) setDone(r.id);
      else setErr(r.error);
    } catch {
      setErr("The request could not be sent. Please try again.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Pilot</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
          One purchase order. {PILOT_SLA_HOURS} hours. A decision you can prove.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute">
          {money(PILOT_PRICE_USD)} flat, paid by card or bank transfer after we confirm scope. You get a sealed evidence packet and an
          advisory decision on one live order.
        </p>
        {canceled ? (
          <p className="mt-5 max-w-2xl rounded-[10px] border border-warn/50 bg-warn/10 p-4 text-sm text-warn">
            Payment was cancelled and nothing was charged. Reply to the email we sent you if you would like to pay another way.
          </p>
        ) : null}
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid content-start gap-6">
          <ol className="panel grid gap-4 p-6">
            {STEPS.map(([when, what]) => (
              <li key={when} className="grid gap-1 border-t border-line pt-4 text-sm first:border-0 first:pt-0 sm:grid-cols-[7rem_1fr]">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-gold">{when}</span>
                <span className="leading-relaxed">{what}</span>
              </li>
            ))}
          </ol>
          <div className="panel p-6 text-sm">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-mute">What it is not</h2>
            <ul className="mt-3 grid gap-2 leading-relaxed text-mute">
              {NOT.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-mute">
              Try it first: <Link className="underline underline-offset-2" to="/check">check a quote</Link> or{" "}
              <Link className="underline underline-offset-2" to="/desk">open the demo desk</Link>. Terms:{" "}
              <Link className="underline underline-offset-2" to="/terms">pilot terms</Link> ·{" "}
              <Link className="underline underline-offset-2" to="/privacy">privacy</Link>.
            </p>
          </div>
        </div>

        {done ? (
          <div className="panel grid content-start gap-3 p-6" role="status">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ok">Request received · {done}</p>
            <h2 className="font-display text-3xl tracking-tight">Thank you — we will reply within one business day.</h2>
            <p className="text-sm leading-relaxed text-mute">
              We will confirm scope, then send a secure payment link. The {PILOT_SLA_HOURS}-hour clock starts when we have your purchase
              order and payment.
            </p>
          </div>
        ) : (
          <form className="panel grid content-start gap-5 p-6" onSubmit={submit}>
            <h2 className="font-display text-2xl tracking-tight">Request a pilot</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name">
                <input className={inputCls} required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={set("name")} />
              </Field>
              <Field label="Work email">
                <input className={inputCls} required type="email" maxLength={160} autoComplete="email" value={form.email} onChange={set("email")} />
              </Field>
              <Field label="Company">
                <input className={inputCls} required minLength={2} maxLength={160} autoComplete="organization" value={form.company} onChange={set("company")} />
              </Field>
              <Field label="Role (optional)">
                <input className={inputCls} maxLength={120} value={form.role} onChange={set("role")} />
              </Field>
              <Field label="What are you buying?">
                <select className={inputCls} required value={form.commodity} onChange={set("commodity")}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {COMMODITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Order size">
                <select className={inputCls} required value={form.poBand} onChange={set("poBand")}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {PO_BANDS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Anything we should know (optional)" hint="No order documents here — we will ask for those securely after scoping.">
              <textarea className={`${inputCls} h-28 py-2`} maxLength={2000} value={form.message} onChange={set("message")} />
            </Field>
            {/* Honeypot: hidden from people; bots fill it. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-[8px] bg-gold px-5 text-sm font-medium text-plum disabled:opacity-60"
            >
              {busy ? "Sending…" : `Request a ${money(PILOT_PRICE_USD)} pilot`}
            </button>
            {err ? (
              <p role="alert" className="text-sm text-bad">
                {err}
              </p>
            ) : null}
            <p className="text-xs text-mute">We use your details only to answer this request. See the privacy notice.</p>
          </form>
        )}
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
