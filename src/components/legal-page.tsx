import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { LEGAL } from "@/lib/legal";

export type LegalSection = readonly [heading: string, paragraphs: readonly string[]];

export function LegalPage({ title, sections }: { title: string; sections: readonly LegalSection[] }) {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <article className="mx-auto max-w-3xl px-6 pb-16 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Legal</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 font-mono text-xs text-mute">
          Version {LEGAL.version} · effective {LEGAL.effective} · {LEGAL.entity}
        </p>
        <div className="mt-8 grid gap-8">
          {sections.map(([h, ps], i) => (
            <section key={h}>
              <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-gold">
                {i + 1}. {h}
              </h2>
              <div className="mt-3 grid gap-3 text-sm leading-relaxed text-paper/90">
                {ps.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
