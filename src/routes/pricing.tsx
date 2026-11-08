import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PILOT_PRICE_USD, PILOT_SLA_HOURS } from "@/lib/verityx/constants";
import { PILOT_OFFER, PLANS, monthlyEquivalent } from "@/lib/verityx/plans";
import { money } from "@/lib/verityx/format";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · VerityX" },
      {
        name: "description",
        content: `VerityX pricing: a ${money(PILOT_PRICE_USD)} one-order pilot, credited in full, then annual plans from ${money(PLANS[0].annualUsd)} a year.`,
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Pricing</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
          Start with one order. Keep every order on the record.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute">
          Prove it on a live purchase order first. If it earns its place, move to a yearly plan — and the pilot fee comes off
          your first year.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="panel flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Pilot · one purchase order</p>
            <p className="mt-2 font-display text-4xl tracking-tight">{money(PILOT_OFFER.priceUsd)}</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-mute">
              {PILOT_SLA_HOURS}-hour target from the later of order and payment. {PILOT_OFFER.line}
            </p>
          </div>
          <Link
            to="/pilot"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[8px] bg-gold px-5 text-sm font-medium text-plum"
          >
            Start a pilot
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-10 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className="panel flex h-full flex-col p-7">
            <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{p.name}</p>
            <p className="mt-3 font-display text-4xl tracking-tight">
              {p.from ? <span className="mr-1 text-base text-mute">from </span> : null}
              {money(p.annualUsd)}
              <span className="ml-1 text-base text-mute">/ year</span>
            </p>
            <p className="mt-1 text-xs text-mute">
              about {money(monthlyEquivalent(p.annualUsd))} a month, billed yearly
            </p>
            <p className="mt-4 text-sm leading-relaxed text-mute">{p.summary}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            </div>
            {LEGAL.supportEmail ? (
              <a
                href={`mailto:${LEGAL.supportEmail}?subject=${encodeURIComponent(`VerityX ${p.name} plan`)}`}
                className="mt-7 inline-flex h-11 items-center justify-center rounded-[8px] border border-line px-5 text-sm text-paper hover:bg-raised"
              >
                Talk to us about {p.name}
              </a>
            ) : (
              <Link
                to="/pilot"
                className="mt-7 inline-flex h-11 items-center justify-center rounded-[8px] border border-line px-5 text-sm text-paper hover:bg-raised"
              >
                Talk to us about {p.name}
              </Link>
            )}
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="space-y-2 text-xs leading-relaxed text-mute">
          <p>
            Plans are invoiced yearly in US dollars under an order form, payable by card or bank transfer. Prices exclude tax.
            Unused orders do not roll over. Extra orders are billed at the pilot rate unless your order form says otherwise.
          </p>
          <p>
            Every output is advisory. VerityX is not a certification body and does not certify compliance with any law or
            contract clause. <Link to="/terms" className="underline">Terms</Link>.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
