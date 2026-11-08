import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Guided tour of the magnetics desk — the spotlight walkthrough from
 * verityx-demo (Aug 2026), rebuilt for the live desk. The mechanism is the
 * demo's; the copy is rewritten to say only what this desk actually does
 * (advisory BLOCK, human-approved SAP HOLD, server-sealed packets).
 *
 * Targets are `data-tour="<id>"` attributes on desk elements. A step whose
 * target is missing is skipped rather than pointed at nothing.
 */
export type TourStep = { target: string; heading: string; body: string };

export const DESK_TOUR: TourStep[] = [
  {
    target: "tape",
    heading: "Live tape",
    body: "LME copper and aluminium cash, an NdPr/Dy index scaled from MP Materials, and ECB USD/EUR, refreshed from public feeds. A feed that is down reads “standby” — it is never back-filled with a made-up print.",
  },
  {
    target: "kpis",
    heading: "The book at a glance",
    body: "Every open magnetics PO on this desk: how many are on hold, how far the proposed prices sit above consensus, and how strongly the sources agree.",
  },
  {
    target: "pos",
    heading: "Purchase orders",
    body: "Rows come from the SAP OData analog tenant on this host (API_PURCHASEORDER_PROCESS_SRV), with Ariba RFQ events alongside. Pick a row to inspect it.",
  },
  {
    target: "stats",
    heading: "Proposed vs consensus",
    body: "CONSENSUS drops outlier prints with a median-absolute-deviation filter, then scores agreement by coefficient of variation. VERIFIED at 0.80 confidence or better; anything less is DISPUTED.",
  },
  {
    target: "verify",
    heading: "Verify and seal",
    body: "Runs the 11-agent pipeline on the server and seals the packet into Local Core with a server-held HMAC key, Merkle-included. If the server cannot answer, nothing is sealed — the desk says so.",
  },
  {
    target: "sap",
    heading: "A human holds the PO",
    body: "VerityX advises; it never blocks on its own. HOLD or RELEASE posts to SAP only when you click it, and the writeback lands in the audit trail.",
  },
  {
    target: "evidence",
    heading: "The evidence behind it",
    body: "Each tab is one source of the packet: SAP and Ariba, LME and the NdPr index, sanctions screens, lot custody, the 27-node PBFT seal, and the Local Core proof. Export hands over the whole packet.",
  },
];

const SEEN_KEY = "vx.deskTour.seen.v1";

export function tourSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: never nag
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;
const TIP_W = 320;
const GAP = 14;

export function DeskTour({ open, onClose, steps = DESK_TOUR }: { open: boolean; onClose: () => void; steps?: TourStep[] }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [tip, setTip] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tipRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const available = useCallback(
    () => steps.filter((s) => typeof document !== "undefined" && document.querySelector(`[data-tour="${s.target}"]`)),
    [steps],
  );
  const [live, setLive] = useState<TourStep[]>([]);

  useEffect(() => {
    if (open) {
      setLive(available());
      setI(0);
    }
  }, [open, available]);

  const close = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  const step = live[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const b = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    setBox(b);
    const th = tipRef.current?.offsetHeight ?? 190;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(TIP_W, vw - 24);
    // Prefer below, then above, then pinned to the bottom of the viewport.
    let top = b.top + b.height + GAP;
    if (top + th > vh - 12) top = b.top - th - GAP;
    if (top < 12) top = vh - th - 12;
    const left = Math.max(12, Math.min(b.left + b.width / 2 - w / 2, vw - w - 12));
    setTip({ top, left });
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    measure();
    const t = window.setTimeout(measure, reduce ? 0 : 360);
    nextRef.current?.focus();
    return () => window.clearTimeout(t);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, live.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, close, measure, live.length]);

  if (!open || !step) return null;
  const last = i === live.length - 1;

  return (
    <div className="tour-overlay">
      <div className="tour-backdrop" onClick={close} aria-hidden="true" />
      {box ? (
        <div className="tour-spotlight" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />
      ) : null}
      <div
        ref={tipRef}
        className="tour-tooltip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-heading"
        aria-describedby="tour-body"
        style={{ top: tip.top, left: tip.left, width: Math.min(TIP_W, typeof window === "undefined" ? TIP_W : window.innerWidth - 24) }}
      >
        <div className="tour-step-pill">
          {i + 1} / {live.length}
        </div>
        <h3 id="tour-heading" className="tour-heading">
          {step.heading}
        </h3>
        <p id="tour-body" className="tour-body">
          {step.body}
        </p>
        <div className="tour-actions">
          <button type="button" className="tour-btn-skip" onClick={close}>
            Skip tour
          </button>
          <div className="tour-nav">
            <button type="button" className="tour-btn" disabled={i === 0} onClick={() => setI((n) => n - 1)}>
              Back
            </button>
            <button
              ref={nextRef}
              type="button"
              className="tour-btn tour-btn-next"
              onClick={() => (last ? close() : setI((n) => n + 1))}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
