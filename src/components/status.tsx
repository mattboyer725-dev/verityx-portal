import type { ReactNode } from "react";
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
