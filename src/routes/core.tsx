import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Shield } from "lucide-react";
import { getCoreStatus } from "@/lib/live-api";
import { CORE_SHA, CORE_VERSION, LOCAL_CORE } from "@/lib/core-ledger";

export const Route = createFileRoute("/core")({ component: CoreStatus });

function shortHash(h: string, n = 10) {
  if (!h) return "—";
  return `${h.slice(0, n)}…${h.slice(-6)}`;
}

function CoreStatus() {
  const q = useQuery({
    queryKey: ["core-status"],
    queryFn: () => getCoreStatus(),
    refetchInterval: 12_000,
  });
  const data = q.data;
  const ok = data?.chain.ok && data?.doctor.overall === "ok";

  return (
    <main className="min-h-dvh bg-ink text-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-xl tracking-tight">
          VerityX
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/desk" className="hidden h-11 items-center rounded-[8px] px-3 text-mute hover:text-paper sm:flex">
            Desk
          </Link>
          <Link to="/work" className="hidden h-11 items-center rounded-[8px] px-3 text-mute hover:text-paper sm:flex">
            OS
          </Link>
          <a
            href="https://github.com/mattboyer725-dev/verityx-local-core"
            className="flex h-11 items-center rounded-[8px] border border-line px-4 text-sm text-paper hover:bg-raised"
          >
            GitHub
          </a>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-10 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ok">
            Offline integrity layer · v{CORE_VERSION}
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">Proof over trust.</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-mute">
            Live HMAC-SHA256 chain and domain-separated Merkle tree, bit-identical to{" "}
            <span className="font-mono text-paper">mattboyer725-dev/verityx-local-core</span> at{" "}
            <span className="font-mono text-paper">{CORE_SHA.slice(0, 7)}</span>. Not a mesh peer. No public write
            route.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-ok/40 bg-ok/10 px-4 text-sm text-ok">
              <span className="size-1.5 rounded-full bg-ok" />
              {ok ? "Chain verified" : q.isPending ? "Hydrating ledger…" : "Checking…"}
            </span>
            <span className="inline-flex h-11 items-center rounded-[8px] border border-line px-4 font-mono text-xs text-mute">
              {LOCAL_CORE.sha.slice(0, 12)}
            </span>
          </div>
        </div>

        <div className="panel p-6">
          <div className="mb-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
            <span>core_events</span>
            <span>{ok ? "chain verified" : "pending"}</span>
          </div>
          <div className="grid gap-3">
            {(data?.events.slice(-4) ?? []).map((e, i) => (
              <div key={e.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-[8px] border border-line bg-ink/50 px-3 py-3">
                <span className="font-mono text-xs text-ok">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-sm">{e.type}</span>
                  <span className="font-mono text-[11px] text-mute">{shortHash(e.hash)}</span>
                </span>
                <Check className="size-4 text-ok" strokeWidth={1.8} />
              </div>
            ))}
            {!data?.events.length ? (
              <p className="py-8 text-center text-sm text-mute">
                {q.isPending ? "Loading signed log…" : "No events yet."}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 border-y border-line lg:grid-cols-4">
        {[
          { v: "112", l: "Python tests" },
          { v: String(data?.chain.depth ?? "—"), l: "Signed events" },
          { v: String(data?.snap.leaf_count ?? "—"), l: "Merkle leaves" },
          { v: "0", l: "Public writes" },
        ].map((m) => (
          <div key={m.l} className="border-r border-line px-6 py-8 last:border-r-0">
            <p className="font-display text-3xl">{m.v}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-mute">{m.l}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <h2 className="font-display text-4xl tracking-tight">Integrity, live.</h2>
          <p className="max-w-xl text-sm leading-relaxed text-mute">
            GitHub pin verified. Merkle fixtures match merkle.py (empty root 64 zeros, leaf 0x00, pair 0x01). Events
            persist to Postgres on Neon; preview uses PGLite. Fail-closed replay — a damaged chain refuses append.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { n: "01 / AUTHENTICATE", t: "Content-derived hashes", d: "HMAC-SHA256 over canonical JSON, then SHA-256(canonical || signature)." },
            { n: "02 / INCLUDE", t: "Merkle proofs", d: data?.proof ? `Last leaf ${shortHash(data.proof.leaf)} · valid ${String(data.proof.valid)}` : "Inclusion path for the tip leaf, domain-separated." },
            { n: "03 / DOCTOR", t: "Self-check", d: data?.doctor ? `overall ${data.doctor.overall} · secret ${data.doctor.checks.secret.status} · chain ${data.doctor.checks.chain.status}` : "Secret hygiene, chain, Merkle, mesh=false." },
          ].map((c) => (
            <article key={c.n} className="panel min-h-52 p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ok">{c.n}</p>
              <h3 className="mt-8 text-base">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{c.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-8 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <h2 className="font-display text-4xl tracking-tight">One hard boundary.</h2>
          <p className="max-w-xl text-sm leading-relaxed text-mute">
            Local Core remains the continuity plane. This desk hydrates and appends through a typed JS port, then
            persists rows. It never gossips, never joins MESH_PEERS, and never exposes a public write API.
          </p>
        </div>
        <div className="grid overflow-hidden rounded-[24px] border border-line lg:grid-cols-2">
          <div className="bg-graphite p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ok">Local trusted host</p>
            <ul className="mt-6 space-y-3 text-sm text-mist">
              <li className="border-t border-line pt-3">Signed append-only event log</li>
              <li className="border-t border-line pt-3">HMAC secret (32+ bytes)</li>
              <li className="border-t border-line pt-3">Backup, restore, ritual CLI</li>
              <li className="border-t border-line pt-3">Loopback-only read API :8420</li>
            </ul>
          </div>
          <div className="bg-raised/40 p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-warn">This deployed surface</p>
            <ul className="mt-6 space-y-3 text-sm text-mist">
              <li className="border-t border-line pt-3">Live doctor + Merkle snapshot</li>
              <li className="border-t border-line pt-3">Postgres persistence (Neon)</li>
              <li className="border-t border-line pt-3">No mesh role, no gossip</li>
              <li className="border-t border-line pt-3">No public POST to the log</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="panel p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm uppercase tracking-[0.14em]">Merkle root</h3>
            <span className="inline-flex items-center gap-2 text-xs text-mute">
              <Shield className="size-3.5" />
              {data?.snap.algorithm}
            </span>
          </div>
          <p className="break-all font-mono text-sm leading-relaxed text-paper">{data?.snap.merkle_root ?? "…"}</p>
          {data?.proof ? (
            <p className="mt-4 font-mono text-[11px] text-mute">
              tip proof · index {data.proof.index} · {data.proof.valid ? "VALID" : "INVALID"} · path{" "}
              {data.proof.path.length} · {shortHash(data.proof.leaf, 12)}
            </p>
          ) : null}
          {data?.chain.errors.length ? (
            <p className="mt-4 text-sm text-bad">{data.chain.errors.join(" · ")}</p>
          ) : null}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/desk" className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-paper px-4 text-sm text-ink">
            Open magnetics desk
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-[8px] border border-line px-4 text-sm text-paper hover:bg-raised"
          >
            Back to hub
          </Link>
        </div>
      </section>
    </main>
  );
}
