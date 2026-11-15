import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, FileCheck2, Layers, PackageCheck, ShieldCheck } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PassportLookup } from "@/components/passport-lookup";
import { ENTERPRISE, FREE, PAID_PLANS } from "@/lib/provenance/plans";
import { STAGES, STAGE_LABEL } from "@/lib/provenance/passport";

export const Route = createFileRoute("/")({ component: Home });

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const STEPS = [
  {
    icon: Layers,
    n: "01",
    title: "Suppliers publish",
    body: "Each lot gets a passport: where every stage happened, linked to the passports of the lots it was made from, with fingerprints of the evidence. Sealed on a public ledger.",
  },
  {
    icon: PackageCheck,
    n: "02",
    title: "Buyers monitor",
    body: "Import the parts you ship with their passport codes. See every chain from mine to magnet and get an alert the moment a lot upstream is revoked or corrected.",
  },
  {
    icon: BadgeCheck,
    n: "03",
    title: "Anyone verifies",
    body: "A contracting officer, auditor or customer opens the code and checks it in their own browser. No account, no fee, no need to trust us.",
  },
] as const;

function Home() {
  const { user } = useCurrentUserState();
  const workspace = user ? { to: "/work" as const } : { to: "/login" as const, search: { redirect: "/work" } };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-mute">
          <ShieldCheck className="size-3.5 text-gold" />
          Magnet provenance, mine to magnet
        </p>
        <h1 className="mt-6 max-w-4xl font-display text-[2.6rem] leading-[1.04] tracking-tight sm:text-6xl">
          Know where every magnet came from. Prove it in one click.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-mute sm:text-lg">
          Sealed lot passports that cover all five stages defense buyers are asked about, from mining to the finished
          magnet. Suppliers publish once; every buyer downstream can check it.
        </p>

        <PassportLookup size="lg" className="mt-9" />
        <p className="mt-3 pl-4 text-xs text-mute">Have a code from a supplier? Paste it to check the chain. Free, no account.</p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            {...workspace}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            {user ? "Open workspace" : "Start free"}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm text-paper transition-colors hover:bg-raised"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* Chain strip */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STAGES.map((s, i) => (
            <li key={s} className="rounded-[16px] border border-line bg-raised/40 px-4 py-4 last:col-span-2 sm:last:col-span-1">
              <p className="font-mono text-[11px] text-gold">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-1 font-display text-lg capitalize">{s}</p>
              <p className="mt-1 text-xs leading-snug text-mute">{STAGE_LABEL[s].replace(/^[^(]*\(?/, "").replace(/\)$/, "")}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-mute">
          The five stages named in DFARS 252.225-7052 for covered magnets. A passport records what the supplier declares
          and fingerprints their evidence. It is not a determination of compliance; that stays with the buyer and the
          contracting officer.
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-display text-3xl tracking-tight sm:text-4xl">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, n, title, body }) => (
            <div key={n} className="panel p-6">
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-gold" strokeWidth={1.6} />
                <span className="font-mono text-xs text-mute">{n}</span>
              </div>
              <h3 className="mt-5 font-display text-2xl">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mute">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two paths */}
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-2">
        <div className="panel flex flex-col p-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold">For suppliers</p>
          <h3 className="mt-3 font-display text-3xl tracking-tight">Answer every buyer once</h3>
          <p className="mt-3 text-sm leading-relaxed text-mute">
            Mines, separators, metal and alloy makers, magnet makers. Publish a passport per lot instead of filling in
            another questionnaire. Your documents stay with you; only their fingerprints go on the ledger.
          </p>
          <p className="mt-6 text-sm">
            <span className="font-display text-2xl">Free</span>
            <span className="text-mute"> for {FREE.seals} lots a year · then {usd(PAID_PLANS.supplier.annualUsd)}/yr unlimited</span>
          </p>
          <Link {...workspace} className="mt-6 inline-flex items-center gap-1 text-sm text-gold hover:text-paper">
            Publish your first lot <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="panel flex flex-col p-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gold">For buyers</p>
          <h3 className="mt-3 font-display text-3xl tracking-tight">Know before the audit does</h3>
          <p className="mt-3 text-sm leading-relaxed text-mute">
            Primes and tier-1s shipping magnet-bearing parts. One view of every part's chain, alerts when anything
            upstream changes, and a sealed evidence pack ready to hand over.
          </p>
          <p className="mt-6 text-sm">
            <span className="font-display text-2xl">Free</span>
            <span className="text-mute">
              {" "}
              for {FREE.parts} parts · Team {usd(PAID_PLANS.team.annualUsd)}/yr · Enterprise from {usd(ENTERPRISE.fromUsd)}
            </span>
          </p>
          <Link {...workspace} className="mt-6 inline-flex items-center gap-1 text-sm text-gold hover:text-paper">
            Import your parts <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* Also */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="flex flex-col gap-4 rounded-[20px] border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <FileCheck2 className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.6} />
            <div>
              <p className="font-medium">Also free: check a rare-earth purchase order price</p>
              <p className="mt-1 text-sm text-mute">Supplier, commodity, kg and total against live reference prices and a should-cost band.</p>
            </div>
          </div>
          <Link
            to="/check"
            className="inline-flex h-10 shrink-0 items-center gap-1 self-start rounded-full border border-line px-4 text-sm hover:bg-raised sm:self-auto"
          >
            Price check <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
