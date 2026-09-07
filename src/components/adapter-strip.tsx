import { Link } from "@tanstack/react-router";
import type { AdapterCard } from "@/lib/adapters";
import { fieldIdForAdapter } from "@/lib/competition";
import { ProveAnalogButton } from "@/components/analog-proof";

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
        const fieldId = fieldIdForAdapter(a.id);
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
            <p className="mt-2 break-all font-mono text-[11px] text-mist">{a.path}</p>
            {compact ? null : <p className="mt-3 text-sm leading-relaxed text-mute">{a.detail}</p>}
            {compact ? null : <p className="mt-3 text-[11px] leading-relaxed text-mute">{a.protocol}</p>}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {fieldId ? (
                <Link to="/field" hash={fieldId} className="text-gold hover:text-paper">
                  On the field
                </Link>
              ) : null}
              <ProveAnalogButton card={a} className="text-mute hover:text-gold" />
            </div>
          </article>
        );
      })}
    </div>
  );
}
