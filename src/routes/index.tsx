import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PILOT_PRICE_USD, PILOT_SLA_HOURS } from "@/lib/verityx/constants";
import { money } from "@/lib/verityx/format";
import { BUYER } from "@/lib/engine";
import { OWNER_EMAIL } from "@/lib/admin";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user } = useCurrentUserState();

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl tracking-tight">VerityX</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/desk" className="hidden h-11 items-center rounded-[8px] px-3 text-mute hover:text-paper sm:flex">
            Desk
          </Link>
          <Link to="/work" className="hidden h-11 items-center rounded-[8px] px-3 text-mute hover:text-paper sm:flex">
            OS
          </Link>
          <Link
            to="/login"
            className="flex h-11 items-center rounded-[8px] border border-line px-4 text-sm text-paper hover:bg-raised"
          >
            {user ? "Workspace" : "Sign in"}
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-8 sm:pt-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-mute">Sovereign · dual plane</p>
        <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.06] tracking-tight sm:text-6xl">
          One product. A live magnetics desk, a paying-pilot OS, and owner command.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-mute">
          Siemens Gamesa procurement on the PO line. Customer Zero operating system for the $2,500 / 72-hour audit.
          HMAC + Merkle continuity from local-core v1.6.0. Advisory decisions — never an automatic fraud finding.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 lg:grid-cols-3">
        <Link
          to="/desk"
          className="panel vx-enter group flex flex-col justify-between p-7 transition-colors hover:bg-raised"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Live desk</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight">Magnetics</h2>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              One click as {BUYER.name}. SAP analog, MAD consensus, n-tier provenance, GLEIF / UN screens, 27-node
              PBFT, exportable packet.
            </p>
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-paper">
            Enter as Elena
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        <Link
          to={user ? "/work" : "/login"}
          className="panel vx-enter group flex flex-col justify-between p-7 transition-colors hover:bg-raised"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Customer Zero OS</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight">Pilots</h2>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Prospect → payment → evidence → human-approved decision → PDF. {money(PILOT_PRICE_USD)} · {PILOT_SLA_HOURS}
              -hour target. Tenant-isolated. BLOCK never auto-applies.
            </p>
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-paper">
            {user ? "Open workspace" : "Sign in to OS"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>

        <Link
          to="/admin"
          className="panel vx-enter group flex flex-col justify-between p-7 transition-colors hover:bg-raised"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Command</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight">Owner</h2>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Fleet, seats, policies, keys, freeze, backup. Google as {OWNER_EMAIL}.
            </p>
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-paper">
            Open command
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      </section>
    </main>
  );
}
