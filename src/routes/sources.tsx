import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ECB_ATTRIBUTION, ECB_URL, latest, REFERENCE, type RefKey } from "@/lib/reference-prices";

export const Route = createFileRoute("/sources")({
  head: () => ({ meta: [{ title: "Sources & licences · VerityX" }] }),
  component: SourcesPage,
});

type Row = { what: string; source: string; url: string; license: string; cadence: string; note: string };

const SERIES: { key: RefKey; what: string }[] = [
  { key: "copper", what: "Copper price" },
  { key: "aluminium", what: "Aluminium price" },
  { key: "ndprOxide", what: "NdPr oxide price" },
  { key: "dyOxide", what: "Dy oxide price" },
];

function priceRows(): Row[] {
  const rows: Row[] = SERIES.map(({ key, what }) => {
    const l = latest(key);
    const s = REFERENCE.series[key];
    return {
      what,
      source: s.source.name,
      url: s.source.url,
      license: s.source.license,
      cadence: `${s.frequency === "monthly" ? "Monthly" : "Annual"} average · latest ${l?.periodLabel ?? "—"}: ${l ? `${l.value.toLocaleString("en-GB")} ${l.unit}` : "—"}`,
      note:
        s.frequency === "annual"
          ? "Context only. Rare-earth prices move far within a year and differ inside and outside China; a verdict needs your own licensed benchmark."
          : "A monthly average, not a spot price.",
    };
  });
  rows.push({
    what: "EUR/USD exchange rate",
    source: "European Central Bank, euro foreign exchange reference rates",
    url: ECB_URL,
    license: `Free reuse, commercial included, crediting “${ECB_ATTRIBUTION}” and without modifying the figures`,
    cadence: "Daily, each TARGET business day",
    note: "Shown as published (EUR 1 = x USD). USD→EUR is derived only inside calculations.",
  });
  return rows;
}

const SCREENING: Row[] = [
  {
    what: "Legal-entity identity (LEI)",
    source: "Global Legal Entity Identifier Foundation (GLEIF)",
    url: "https://www.gleif.org/en/meta/lei-data-terms-of-use",
    license: "CC0 1.0 (public domain dedication)",
    cadence: "Queried live per check",
    note: "Name match is fuzzy; the buyer confirms the exact legal entity.",
  },
  {
    what: "Sanctions screen",
    source: "UN Security Council Consolidated List",
    url: "https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list",
    license: "Public UN document",
    cadence: "Downloaded live, cached",
    note: "Whole-word name match. A possible match is a prompt for human review, never an automatic finding.",
  },
  {
    what: "EU public tenders",
    source: "Tenders Electronic Daily (TED), Publications Office of the EU",
    url: "https://ted.europa.eu",
    license: "Commission reuse policy: reuse permitted with acknowledgement (© European Union)",
    cadence: "Queried live",
    note: "Context on public demand only.",
  },
  {
    what: "Media-risk headlines",
    source: "The GDELT Project, DOC 2.0 API",
    url: "https://www.gdeltproject.org/about.html#termsofuse",
    license: "Free for commercial use with citation and a link to gdeltproject.org; publishers keep rights in their headlines",
    cadence: "Queried live, cached 15 minutes",
    note: "Only headline, outlet and link are shown; article text is never fetched or stored. A headline is a prompt for review, not a finding.",
  },
];

const NOT_USED = [
  "Argus Media, Fastmarkets, Shanghai Metals Market and Benchmark Mineral Intelligence price assessments — not subscribed and never displayed. Enter your own subscription’s price as your benchmark on a check; you hold that licence.",
  "LME prices and settlement data — not licensed; copper and aluminium are World Bank monthly averages instead.",
  "Stock-market prices — not used for any price, index or score.",
  "OpenSanctions — commercial use requires a paid data licence; not queried.",
  "Credit ratings (e.g. RapidRatings, D&B) — not used. The financial-health signal is VerityX’s own disclosure heuristic and says so.",
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="grid gap-3">
      {rows.map((r) => (
        <div key={r.what} className="panel grid gap-2 p-5 text-sm sm:grid-cols-[11rem_1fr]">
          <p className="font-medium text-paper">{r.what}</p>
          <div className="grid gap-1.5 leading-relaxed">
            <p>
              <a className="underline underline-offset-2" href={r.url} rel="noreferrer" target="_blank">
                {r.source}
              </a>
            </p>
            <p className="text-mute">
              <span className="text-paper">Licence:</span> {r.license}
            </p>
            <p className="text-mute">
              <span className="text-paper">Cadence:</span> {r.cadence}
            </p>
            <p className="text-mute">{r.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcesPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <section className="mx-auto max-w-4xl px-6 pb-8 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mute">Data</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Sources &amp; licences</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute">
          Every figure VerityX shows comes from a source that permits this use, and carries its period and attribution.
          Reference averages are refreshed monthly by an automated job and committed to the code, so every change to a
          price has a public history. Last refresh {REFERENCE.generatedAt.slice(0, 10)}.
        </p>
      </section>
      <section className="mx-auto grid max-w-4xl gap-10 px-6 pb-16">
        <div>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-mute">Prices</h2>
          <Table rows={priceRows()} />
        </div>
        <div>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-mute">Supplier screening and context</h2>
          <Table rows={SCREENING} />
        </div>
        <div>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-mute">What VerityX does not use</h2>
          <ul className="panel grid gap-3 p-5 text-sm leading-relaxed text-mute">
            {NOT_USED.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs leading-relaxed text-mute">
          {REFERENCE.series.copper.source.attribution} {REFERENCE.series.ndprOxide.source.attribution} {ECB_ATTRIBUTION}{" "}
          VerityX is independent and is not affiliated with or endorsed by any source listed here.
        </p>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
