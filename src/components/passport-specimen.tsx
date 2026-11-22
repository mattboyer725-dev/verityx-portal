/**
 * The example lot passport on the home page, and the page's one working demo.
 *
 * Five real passports chained mine to magnet (see lib/provenance/example-chain).
 * A visitor can open any stage to see what was sealed, revoke the refinery lot
 * to see what a buyer downstream sees, and recompute every seal in their own
 * browser with the same code the real passport pages use.
 */
import { useId, useState } from "react";
import {
  EXAMPLE_ROOT,
  EXAMPLE_STAGES,
  exampleAnalysis,
  recomputeChain,
  SEALED_DIGESTS,
  type SealCheck,
} from "@/lib/provenance/example-chain";

const REFINERY = "LP-8VRM-06KE";
const short = (hex: string) => `${hex.slice(0, 4)} ${hex.slice(4, 8)}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type CheckState = { phase: "idle" } | { phase: "running"; done: SealCheck[] } | { phase: "done"; done: SealCheck[] };

export function PassportSpecimen() {
  const baseId = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [check, setCheck] = useState<CheckState>({ phase: "idle" });
  const [message, setMessage] = useState("");

  const revokedIndex = revoked ? EXAMPLE_STAGES.findIndex((s) => s.code === REFINERY) : -1;
  const resultFor = (code: string) => (check.phase === "idle" ? undefined : check.done.find((c) => c.code === code));

  async function runCheck() {
    if (check.phase === "running") return;
    setMessage("Recomputing each seal in your browser…");
    setCheck({ phase: "running", done: [] });
    const [results, analysis] = await Promise.all([recomputeChain(), exampleAnalysis(revoked ? REFINERY : null)]);
    const done: SealCheck[] = [];
    for (const r of results) {
      done.push(r);
      setCheck({ phase: "running", done: [...done] });
      if (!reducedMotion()) await wait(180);
    }
    setCheck({ phase: "done", done });
    const matched = results.filter((r) => r.ok).length;
    if (matched !== results.length) {
      setMessage(`${results.length - matched} of ${results.length} seals do not match. This passport should not be relied on.`);
    } else if (analysis.revokedInputs.length) {
      setMessage(
        `All ${matched} seals match, so nothing was altered. The chain is still flagged: the refinery lot was revoked by its publisher.`,
      );
    } else {
      setMessage(`All ${matched} seals match, each one sealed over the lot before it. Nothing was sent to VerityX.`);
    }
  }

  async function toggleRevoke() {
    const next = !revoked;
    setRevoked(next);
    setCheck({ phase: "idle" });
    const analysis = await exampleAnalysis(next ? REFINERY : null);
    setMessage(
      next
        ? `Refinery lot revoked. ${analysis.revokedInputs.length} lot upstream of ${EXAMPLE_ROOT} is no longer valid, so the magnet is flagged.`
        : "Refinery lot restored. The chain is sealed end to end again.",
    );
  }

  return (
    <figure className={`vx-specimen ${revoked ? "is-flagged" : ""}`} aria-label="Example lot passport">
      <div className="vx-specimen-head">
        <div>
          <p className="vx-specimen-kind">Example lot passport</p>
          <p className="vx-specimen-code">{EXAMPLE_ROOT}</p>
        </div>
        <dl className="vx-specimen-meta">
          <div>
            <dt>Material</dt>
            <dd>NdFeB magnet, N52</dd>
          </div>
          <div>
            <dt>Lot</dt>
            <dd>MAG-N52-4471</dd>
          </div>
          <div>
            <dt>Mass</dt>
            <dd>300 kg</dd>
          </div>
        </dl>
      </div>

      <ol className="vx-chain vx-chain-live">
        {EXAMPLE_STAGES.map((s, i) => {
          const isOpen = open === s.code;
          const detailId = `${baseId}-${s.code}`;
          const result = resultFor(s.code);
          const state =
            i === revokedIndex ? "is-revoked" : revokedIndex >= 0 && i > revokedIndex ? "is-downstream" : "";
          return (
            <li key={s.code} className={state} style={{ ["--i" as string]: i }}>
              <button
                type="button"
                className="vx-chain-row"
                aria-expanded={isOpen}
                aria-controls={detailId}
                onClick={() => setOpen(isOpen ? null : s.code)}
              >
                <span className="vx-chain-node" aria-hidden />
                <span className="vx-chain-body">
                  <span className="vx-chain-stage">{s.stage}</span>
                  <span className="vx-chain-where">
                    {i === revokedIndex ? "Revoked by its publisher" : s.where}
                  </span>
                </span>
                <span className="vx-chain-country" aria-label={`Country ${s.country}`}>
                  {s.country}
                </span>
                <span className="vx-chain-print" title="Sealed digest, first 8 hex">
                  {result ? (
                    <span className={result.ok ? "vx-print-ok" : "vx-print-bad"}>
                      {result.ok ? "match" : "differs"}
                    </span>
                  ) : (
                    short(SEALED_DIGESTS[s.code])
                  )}
                </span>
              </button>
              <div id={detailId} className="vx-chain-detail" hidden={!isOpen}>
                <dl>
                  <div>
                    <dt>Lot passport</dt>
                    <dd className="font-mono">{s.code}</dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{s.file}</dd>
                  </div>
                  <div>
                    <dt>Sealed digest</dt>
                    <dd className="vx-hash">{SEALED_DIGESTS[s.code]}</dd>
                  </div>
                </dl>
                <p>
                  {i === 0
                    ? "The first lot in the chain. The evidence file stays with the mine; only its fingerprint is sealed."
                    : `Sealed over its own declaration plus the digest of ${EXAMPLE_STAGES[i - 1].code}, so changing anything upstream breaks this seal too.`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="vx-specimen-foot">
        {revoked ? (
          <>
            <span className="vx-flag" aria-hidden>
              <svg viewBox="0 0 40 40">
                <path d="M20 6 L35 33 H5 Z" />
                <path d="M20 16 V24 M20 28 V29" />
              </svg>
            </span>
            <div>
              <p className="vx-specimen-sealed">Flagged: a lot upstream was revoked</p>
              <p className="vx-specimen-proof">Every buyer watching {EXAMPLE_ROOT} gets an alert</p>
            </div>
          </>
        ) : (
          <>
            <span className="vx-seal" aria-hidden>
              <svg viewBox="0 0 40 40">
                <rect x="8" y="8" width="24" height="24" transform="rotate(45 20 20)" />
                <path d="M14 20.5 L18.5 25 L26.5 15" />
              </svg>
            </span>
            <div>
              <p className="vx-specimen-sealed">Sealed, no covered country declared</p>
              <p className="vx-specimen-proof">Ledger entry 1,182, signed by key 230be6f0</p>
            </div>
          </>
        )}
      </div>

      <div className="vx-specimen-try">
        <div className="vx-specimen-actions">
          <button type="button" className="vx-try-primary" onClick={runCheck} disabled={check.phase === "running"}>
            {check.phase === "running" ? "Checking…" : check.phase === "done" ? "Check again" : "Check the seals"}
          </button>
          <button type="button" className="vx-try-quiet" aria-pressed={revoked} onClick={toggleRevoke}>
            {revoked ? "Restore the refinery lot" : "Revoke the refinery lot"}
          </button>
        </div>
        <p className="vx-specimen-status" role="status" aria-live="polite">
          {message || "Open any stage to see what was sealed, or try it yourself."}
        </p>
      </div>
    </figure>
  );
}
