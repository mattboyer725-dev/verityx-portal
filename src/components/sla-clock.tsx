import { useEffect, useState } from "react";
import { slaState } from "@/lib/verityx/format";
import { cn } from "@/lib/cn";

export function SlaClock({
  inputsReceivedAt,
  slaHours,
}: {
  inputsReceivedAt: string | null;
  slaHours: number;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const state = slaState(inputsReceivedAt, slaHours);
  return (
    <div className={cn("rounded-[16px] border px-4 py-3", state.overdue ? "border-warn/40 bg-warn/10" : "border-line bg-raised/40")}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-mute">72-hour SLA</p>
      <p className={cn("mt-1 text-sm", state.overdue ? "text-warn" : "text-paper")}>{state.label}</p>
    </div>
  );
}
