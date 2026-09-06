import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones: Record<string, string> = {
  lead: "text-mist border-line",
  qualified: "text-mist border-line",
  discovery: "text-paper border-mist/30",
  proposal: "text-paper border-mist/30",
  won: "text-ok border-ok/30",
  lost: "text-mute border-line",
  unpaid: "text-warn border-warn/30",
  checkout_open: "text-warn border-warn/30",
  paid: "text-ok border-ok/30",
  failed: "text-bad border-bad/30",
  intake: "text-mist border-line",
  awaiting_payment: "text-warn border-warn/30",
  in_analysis: "text-paper border-mist/30",
  decision_pending: "text-warn border-warn/30",
  reported: "text-ok border-ok/30",
  follow_up: "text-mist border-mist/30",
  closed: "text-mute border-line",
  MONITOR: "text-mist border-line",
  WATCH: "text-warn border-warn/30",
  ESCALATE: "text-warn border-warn/40",
  BLOCK: "text-bad border-bad/40",
  recommended: "text-paper border-mist/30",
  pending_approval: "text-warn border-warn/30",
  approved: "text-ok border-ok/30",
  withdrawn: "text-mute border-line",
  founder: "text-paper border-mist/30",
  admin: "text-paper border-line",
  analyst: "text-mist border-line",
  viewer: "text-mute border-line",
  correct: "text-ok border-ok/30",
  partial: "text-warn border-warn/30",
  incorrect: "text-bad border-bad/30",
  unknown: "text-mute border-line",
  yes: "text-ok border-ok/30",
  no: "text-mute border-line",
  undecided: "text-mist border-line",
};

export function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium tracking-wide uppercase",
        tones[tone ?? ""] ?? "text-mist border-line",
      )}
    >
      {children}
    </span>
  );
}

export function SampleTag({ on }: { on?: boolean }) {
  if (!on) return null;
  return <Pill>Sample</Pill>;
}

export function LivePulse({
  refreshing,
  updatedAt,
}: {
  refreshing?: boolean;
  updatedAt?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const ago = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const label = refreshing
    ? "Syncing ledger"
    : ago == null
      ? "Live"
      : ago < 4
        ? "Live now"
        : ago < 60
          ? `Live · ${ago}s ago`
          : `Live · ${Math.floor(ago / 60)}m ago`;
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span
        className={cn(
          "size-1.5 rounded-full",
          refreshing ? "bg-warn vx-pulse" : "bg-ok",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
