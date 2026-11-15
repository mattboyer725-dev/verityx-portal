import type { AdapterCard } from "@/lib/adapters";

export function AdapterStrip({
  adapters,
  compact = false,
}: {
  adapters: AdapterCard[];
  compact?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {adapters.map((a) => {
        return (
          <article key={a.id} className="panel min-w-0 overflow-hidden p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 font-display text-xl tracking-tight">{a.name}</h3>
              <span
                className={`shrink-0 text-[10px] uppercase tracking-[0.16em] ${
                  a.status === "LIVE" ? "text-ok" : a.status === "DOWN" ? "text-bad" : "text-warn"
                }`}
              >
                {a.status}
              </span>
            </div>
                        {compact ? null : <p className="mt-3 text-sm leading-relaxed text-mute">{a.detail}</p>}
            {compact ? null : <p className="mt-3 text-[11px] leading-relaxed text-mute">{a.protocol}</p>}
          </article>
        );
      })}
    </div>
  );
}
