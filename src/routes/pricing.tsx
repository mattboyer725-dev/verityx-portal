import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PILOT_CREDIT_DAYS, PILOT_PRICE_USD, PILOT_SLA_HOURS } from "@/lib/verityx/constants";
import { ENTERPRISE, FREE, PAID_PLANS } from "@/lib/provenance/plans";
import { money } from "@/lib/verityx/format";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | VerityX" },
      {
        name: "description",
        content: `Verifying a lot passport is free. Suppliers publish from ${money(PAID_PLANS.supplier.annualUsd)} a year; buyers monitor parts and generate evidence packs from ${money(PAID_PLANS.team.annualUsd)} a year.`,
      },
    ],
  }),
  component: PricingPage,
});

type Cta = { label: string; redirect?: string; href?: string; pilot?: boolean };

function Plan({
  kicker,
  name,
  price,
  from,
  per = "/ year",
  summary,
  features,
  cta,
  highlight,
}: {
  kicker: string;
  name: string;
  price: string;
  from?: boolean;
  per?: string;
  summary: string;
  features: string[];
  cta: Cta;
  highlight?: boolean;
}) {
  const cls = `mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-[4px] px-5 text-sm ${
    highlight ? "bg-gold font-semibold text-white" : "border border-line hover:bg-raised"
  }`;
  return (
    <div className={`panel flex h-full flex-col p-7 ${highlight ? "border-t-4 border-t-gold" : ""}`}>
      <p className="text-xs text-mute">{kicker}</p>
      <p className="mt-2 font-display text-2xl">{name}</p>
      <p className={`mt-2 whitespace-nowrap font-display tracking-tight ${from ? "text-[1.6rem]" : "text-[2rem]"}`}>
        {from ? <span className="mr-1 text-base text-mute">from</span> : null}
        {price}
        {per ? <span className="ml-1 text-base text-mute">{per}</span> : null}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-mute">{summary}</p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {cta.href ? (
        <a href={cta.href} className={cls}>
          {cta.label}
        </a>
      ) : cta.pilot ? (
        <Link to="/pilot" className={cls}>
          {cta.label}
        </Link>
      ) : (
        <a href={`/login?redirect=${encodeURIComponent(cta.redirect ?? "/work")}`} className={cls}>
          {cta.label}
        </a>
      )}
    </div>
  );
}

function PricingPage() {
  const contact = LEGAL.supportEmail ? `mailto:${LEGAL.supportEmail}?subject=${encodeURIComponent("VerityX Enterprise")}` : undefined;
  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <p className="text-xs text-gold">Pricing</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl">
          Free to verify. Pay to publish, or to monitor.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute">
          Anyone can open a lot passport and check its seal without an account. Suppliers pay to publish their lots; buyers pay to
          watch every magnet-bearing part they ship and to hand a contracting officer a sealed evidence pack.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-4">
        <h2 className="font-display text-2xl">Suppliers publish lot passports</h2>
        <p className="mt-1 text-sm text-mute">Mines, separators, metal and alloy makers, magnet makers.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-12 md:grid-cols-2">
        <Plan
          kicker="Start here"
          name="Free"
          price="$0"
          per=""
          summary="Answer a buyer's request today."
          features={[`${FREE.seals} sealed lot passports a year`, "Unlimited drafts", "Public page and receipt for every sealed lot"]}
          cta={{ label: "Create a workspace", redirect: "/work/passports" }}
        />
        <Plan
          kicker="Publish"
          name={PAID_PLANS.supplier.name}
          price={money(PAID_PLANS.supplier.annualUsd)}
          summary={PAID_PLANS.supplier.summary}
          features={PAID_PLANS.supplier.features}
          cta={{ label: "Start free", redirect: "/work/billing" }}
          highlight
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-4">
        <h2 className="font-display text-2xl">Buyers monitor parts and export evidence</h2>
        <p className="mt-1 text-sm text-mute">Contractors and subcontractors with magnet-bearing parts on their programs.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-12 md:grid-cols-2 lg:grid-cols-4">
        <Plan
          kicker="Try it"
          name="Free"
          price="$0"
          per=""
          summary="See your real parts against published passports."
          features={[`${FREE.parts} part lines in ${FREE.programs} program`, `${FREE.packs} sealed evidence pack`, "Change alerts"]}
          cta={{ label: "Create a workspace", redirect: "/work/portfolio" }}
        />
        <Plan
          kicker="Monitor"
          name={PAID_PLANS.team.name}
          price={money(PAID_PLANS.team.annualUsd)}
          summary={PAID_PLANS.team.summary}
          features={PAID_PLANS.team.features}
          cta={{ label: "Start free", redirect: "/work/billing" }}
          highlight
        />
        <Plan
          kicker="Monitor"
          name={PAID_PLANS.program.name}
          price={money(PAID_PLANS.program.annualUsd)}
          summary={PAID_PLANS.program.summary}
          features={PAID_PLANS.program.features}
          cta={{ label: "Start free", redirect: "/work/billing" }}
        />
        <Plan
          kicker="Order form"
          name={ENTERPRISE.name}
          price={money(ENTERPRISE.fromUsd)}
          from
          summary={ENTERPRISE.summary}
          features={ENTERPRISE.features}
          cta={contact ? { label: "Talk to us", href: contact } : { label: "Talk to us", pilot: true }}
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="panel flex flex-col gap-4 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-mute">For a single purchase order</p>
            <p className="mt-2 font-display text-2xl">Price-check pilot, {money(PILOT_PRICE_USD)}</p>
            <p className="mt-2 max-w-2xl text-sm text-mute">
              Should-cost against licensed reference prices, supplier screening and a sealed decision on one live order, {PILOT_SLA_HOURS}-hour
              target. Credited in full to a first-year plan signed within {PILOT_CREDIT_DAYS} days.
            </p>
          </div>
          <Link to="/pilot" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[4px] border border-line px-5 text-sm hover:bg-raised">
            Request a pilot
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="space-y-2 text-xs leading-relaxed text-mute">
          <p>
            Plans are billed yearly in US dollars by card or US bank transfer, or by invoice under an order form. Prices exclude tax.
            Cancel any time from Billing; the plan runs to the end of the paid year.
          </p>
          <p>
            Lot passports are their publishers' own declarations. VerityX checks that a chain is complete and sealed unchanged; it is
            not a certification body and does not certify compliance with DFARS 252.225-7052 or any other rule.{" "}
            <Link to="/terms" className="underline">
              Terms
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
