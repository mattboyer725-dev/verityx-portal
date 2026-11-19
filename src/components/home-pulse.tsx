import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPulse } from "@/lib/provenance/api";

import { daysUntilDeadline } from "@/lib/provenance/deadline";

/** Same number on server and client for the first render; refreshes after mount and hourly. */
export function useDaysLeft() {
  const [days, setDays] = useState(() => daysUntilDeadline());
  useEffect(() => {
    setDays(daysUntilDeadline());
    const t = setInterval(() => setDays(daysUntilDeadline()), 3_600_000);
    return () => clearInterval(t);
  }, []);
  return days;
}

const usd = (n: number, digits = 0) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

function Cell({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "seal" | "warn" }) {
  return (
    <div className="vx-strip-cell">
      <p className="vx-strip-label">{label}</p>
      <p className={`vx-strip-value ${tone === "seal" ? "is-seal" : tone === "warn" ? "is-warn" : ""}`}>{value}</p>
      <p className="vx-strip-note">{note}</p>
    </div>
  );
}

export function PulseStrip() {
  const days = useDaysLeft();
  const q = useQuery({ queryKey: ["vx", "pulse"], queryFn: () => getPulse(), staleTime: 60_000, refetchInterval: 120_000 });
  const p = q.data;
  const pending = q.isPending;
  const dash = pending ? "…" : "Not available";

  return (
    <section aria-label="Live figures" className="vx-strip">
      <Cell label="Until the upstream ban" value={`${days} days`} note="From Jan 1, 2027" tone="warn" />
      <Cell
        label="NdPr oxide"
        value={p?.ndpr ? `${usd(p.ndpr.usdKg)}/kg` : dash}
        note={p?.ndpr ? `USGS ${p.ndpr.period}` : "USGS reference"}
      />
      <Cell
        label="Dysprosium oxide"
        value={p?.ndpr && p.ndpr.dyUsdKg > 0 ? `${usd(p.ndpr.dyUsdKg)}/kg` : dash}
        note={p?.ndpr ? `USGS ${p.ndpr.period}` : "USGS reference"}
      />
      <Cell
        label="EUR / USD"
        value={p?.fx ? p.fx.eurUsd.toFixed(4) : dash}
        note={p?.fx ? `ECB, ${p.fx.date}` : "ECB reference rate"}
      />
      <Cell
        label="VerityX ledger"
        value={p?.ledger ? `${p.ledger.entries.toLocaleString("en-US")} entries` : dash}
        note={p?.ledger ? (p.ledger.intact ? "Chain checked, intact" : "Chain check failed") : "Chain check"}
        tone={p?.ledger?.intact ? "seal" : undefined}
      />
      <Cell
        label="Passports sealed"
        value={p?.passports ? p.passports.sealed.toLocaleString("en-US") : dash}
        note={
          p?.passports
            ? `by ${p.passports.suppliers.toLocaleString("en-US")} supplier${p.passports.suppliers === 1 ? "" : "s"}`
            : "All suppliers"
        }
      />
    </section>
  );
}

const CHANGES = [
  {
    head: "Mining, refining and separating join the list",
    body: "Until now the ban covered where a magnet's material was melted and the magnet produced. From January 1 it reaches back to where the ore was mined, refined and separated.",
  },
  {
    head: "End items made in a covered country are caught too",
    body: "An end item manufactured in China, Russia, Iran or North Korea that contains a covered magnet is restricted, wherever its magnet came from.",
  },
  {
    head: "The off-the-shelf exemption narrows",
    body: "Commercial off-the-shelf items stay exempt only while covered material is under half their weight.",
  },
  {
    head: "Which clause is in your contract matters",
    body: "Contracts awarded before 2027 that carry clause 252.225-7961 are not hit by the new upstream stages. Contracts carrying 252.225-7052 (May 2024) are. Check each one.",
  },
] as const;

export function DeadlinePanel() {
  const days = useDaysLeft();
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="vx-countdown" aria-label={`${days} days until January 1, 2027`}>
            {days}
            <span>days</span>
          </p>
          <h2 className="font-display mt-6 text-3xl leading-tight sm:text-[2.25rem]">
            Until every stage from mine to magnet has to be outside a covered country.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-mist">
            Primes will ask their suppliers to prove it lot by lot. A passport is how a supplier answers once, and how the
            buyer keeps the answer.
          </p>
        </div>
        <ol className="vx-changes">
          {CHANGES.map((c) => (
            <li key={c.head}>
              <h3>{c.head}</h3>
              <p>{c.body}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-mute">
        Summary of DFARS 225.7018 and clause 252.225-7052 as published on acquisition.gov, and Class Deviation 2026-O0041
        Rev. 1 (clause 252.225-7961). It is not legal advice; your contracting officer and counsel decide what applies.
      </p>
    </section>
  );
}

const ROWS = [
  {
    who: "Supplier questionnaires and spreadsheets",
    gives: "A declaration from each supplier, collected by email.",
    stops: "Nothing shows whether the file was changed later, and every customer asks the same supplier again.",
  },
  {
    who: "A magnet maker's compliance certificate",
    gives: "The maker's own statement that its magnets meet DFARS. Makers such as Arnold and Dexter have announced targets for compliant supply ahead of 2027.",
    stops: "Covers one company's step. The mine, separator and refinery behind it are on the maker's word.",
  },
  {
    who: "Bill-of-materials screening (for example Z2Data)",
    gives: "Screens your parts against DFARS and NDAA rules from a large parts and supplier database, and generates attestations.",
    stops: "Works at part and supplier level. The record of where a particular lot was processed still has to come from the supply chain.",
  },
  {
    who: "Supplier survey platforms (for example Assent)",
    gives: "Sends DFARS declarations out to suppliers at scale and tracks the replies.",
    stops: "Each answer is a supplier's declaration in the buyer's own account; another buyer runs the same survey again.",
  },
] as const;

export function CompareTable() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
      <h2 className="font-display max-w-3xl text-3xl leading-tight sm:text-[2.5rem]">How buyers check magnets today, and where a passport differs.</h2>
      <div className="vx-compare mt-10" role="table" aria-label="Comparison of ways to check magnet origin">
        <div className="vx-compare-row vx-compare-head" role="row">
          <span role="columnheader">Approach</span>
          <span role="columnheader">What it gives you</span>
          <span role="columnheader">Where it stops</span>
        </div>
        {ROWS.map((r) => (
          <div className="vx-compare-row" role="row" key={r.who}>
            <span role="cell" className="vx-compare-who">
              {r.who}
            </span>
            <span role="cell">
              <em className="vx-compare-k">What it gives you</em>
              {r.gives}
            </span>
            <span role="cell">
              <em className="vx-compare-k">Where it stops</em>
              {r.stops}
            </span>
          </div>
        ))}
        <div className="vx-compare-row is-us" role="row">
          <span role="cell" className="vx-compare-who">
            VerityX lot passport
          </span>
          <span role="cell">
            <em className="vx-compare-k">What it gives you</em>
            One sealed record per lot, written by the company that did the work and linked to the lots it came from, back to
            the mine.
          </span>
          <span role="cell">
            <em className="vx-compare-k">Where it stops</em>
            It records declarations and fingerprints of evidence; it doesn't inspect plants. Anyone can check it, no account
            needed.
          </span>
        </div>
      </div>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-mute">
        These tools do things VerityX doesn't: Z2Data covers a parts database far larger than any one buyer's, and Assent
        runs a supplier network. A passport code can sit beside either. Named companies are described from their own
        published material; none is affiliated with VerityX.
      </p>
    </section>
  );
}
