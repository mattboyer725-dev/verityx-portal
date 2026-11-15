import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PassportLookup } from "@/components/passport-lookup";
import { PassportSpecimen } from "@/components/passport-specimen";
import { ENTERPRISE, FREE, PAID_PLANS } from "@/lib/provenance/plans";

export const Route = createFileRoute("/")({ component: Home });

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const FLOW = [
  {
    who: "The supplier publishes",
    body: "A mine, separator, refiner, alloy maker or magnet maker records where its stage happened and links the passports of the lots it used. The evidence stays on its own systems; only fingerprints are sealed.",
  },
  {
    who: "The buyer watches",
    body: "A prime or tier-1 imports the parts it ships with their passport codes and sees each chain end to end. If a lot anywhere upstream is revoked or corrected, the part is flagged.",
  },
  {
    who: "Anyone checks",
    body: "A contracting officer, auditor or customer opens the code. The checks run in their own browser against our published key, so they don't have to take our word for it.",
  },
] as const;

function Home() {
  const { user } = useCurrentUserState();
  const workspace = user ? { to: "/work" as const } : { to: "/login" as const, search: { redirect: "/work" } };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 pt-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>

      <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-12 lg:pt-20">
        <div>
          <h1 className="vx-hero-title">Mine to magnet, sealed.</h1>
          <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-mist">
            Rare-earth suppliers publish a sealed passport for every lot. Every buyer downstream can check where it was
            mined, separated, refined, melted and made.
          </p>

          <div className="mt-10">
            <p className="mb-3 text-sm font-semibold">Check a passport</p>
            <PassportLookup size="lg" />
            <p className="mt-2.5 text-sm text-mute">Paste the code from your supplier. It's free and needs no account.</p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link {...workspace} className="vx-btn-primary">
              {user ? "Open your workspace" : "Start free"}
            </Link>
            <Link to="/pricing" className="vx-btn-quiet">
              See pricing
            </Link>
          </div>
        </div>

        <div className="lg:pt-3">
          <PassportSpecimen />
          <p className="mt-7 max-w-md text-xs leading-relaxed text-mute">
            The five stages are the ones DFARS 252.225-7052 names for covered magnets. A passport records what the supplier
            declares and fingerprints its evidence. Deciding compliance stays with the buyer and the contracting officer.
          </p>
        </div>
      </section>

      <section className="vx-band">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
          <h2 className="font-display max-w-2xl text-3xl leading-tight sm:text-[2.5rem]">
            One passport, written once, checked by everyone after.
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {FLOW.map((f, i) => (
              <li
                key={f.who}
                className="border-t-2 pt-5"
                style={{ borderColor: i === 0 ? "var(--color-seal)" : "color-mix(in oklab, var(--color-ink) 30%, transparent)" }}
              >
                <h3 className="text-lg font-bold" style={{ fontStretch: "125%" }}>
                  {f.who}
                </h3>
                <p className="vx-band-mute mt-3 text-[0.9375rem] leading-relaxed">{f.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
        <h2 className="font-display text-3xl leading-tight sm:text-[2.5rem]">Free to check. Paid to publish or to monitor.</h2>
        <div className="mt-12 grid border-y border-line md:grid-cols-2">
          <div className="py-8 md:pr-10">
            <h3 className="text-xl font-bold" style={{ fontStretch: "125%" }}>
              If you make or process the material
            </h3>
            <p className="mt-3 max-w-md leading-relaxed text-mist">
              Publish a passport per lot instead of filling in each customer's questionnaire. Your documents stay with you.
            </p>
            <p className="mt-6">
              <span className="font-display text-3xl">Free</span>
              <span className="ml-2 text-mute">for {FREE.seals} lots a year</span>
            </p>
            <p className="mt-1 text-sm text-mute">Then {usd(PAID_PLANS.supplier.annualUsd)} a year for unlimited lots.</p>
            <Link {...workspace} className="vx-btn-quiet mt-5">
              Publish your first lot
            </Link>
          </div>
          <div className="border-t border-line py-8 md:border-l md:border-t-0 md:pl-10">
            <h3 className="text-xl font-bold" style={{ fontStretch: "125%" }}>
              If you buy parts with magnets in them
            </h3>
            <p className="mt-3 max-w-md leading-relaxed text-mist">
              See every part's chain, get flagged when anything upstream changes, and hand over a sealed evidence pack.
            </p>
            <p className="mt-6">
              <span className="font-display text-3xl">Free</span>
              <span className="ml-2 text-mute">for {FREE.parts} parts</span>
            </p>
            <p className="mt-1 text-sm text-mute">
              Team {usd(PAID_PLANS.team.annualUsd)} a year. Enterprise from {usd(ENTERPRISE.fromUsd)}.
            </p>
            <Link {...workspace} className="vx-btn-quiet mt-5">
              Import your parts
            </Link>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="max-w-xl text-mist">
            <span className="font-semibold text-paper">Buying rare-earth material?</span> Check one purchase order's price
            against live reference prices and a should-cost range, free.
          </p>
          <Link to="/check" className="vx-btn-quiet shrink-0">
            Check a price
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
