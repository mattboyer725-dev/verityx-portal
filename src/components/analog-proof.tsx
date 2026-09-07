import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AdapterCard } from "@/lib/adapters";
import { analogSummary, sapEntityPath } from "@/lib/analog";

function fetchSseTick(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(url);
    const t = setTimeout(() => {
      es.close();
      reject(new Error("stream timeout"));
    }, 4000);
    es.addEventListener("tick", (ev) => {
      clearTimeout(t);
      es.close();
      try {
        resolve(JSON.parse((ev as MessageEvent).data));
      } catch {
        resolve((ev as MessageEvent).data);
      }
    });
    es.onerror = () => {
      clearTimeout(t);
      es.close();
      reject(new Error("stream closed"));
    };
  });
}

export async function loadAnalog(card: AdapterCard): Promise<{ status: number; path: string; body: unknown }> {
  let path = card.path;
  if (card.id === "sap") path = sapEntityPath(path);
  if (card.id === "argus") {
    const body = await fetchSseTick(path);
    return { status: 200, path, body };
  }
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, path, body };
}

export function AnalogProof({ card, onClose }: { card: AdapterCard; onClose: () => void }) {
  const [status, setStatus] = useState<"load" | "ok" | "err">("load");
  const [http, setHttp] = useState(0);
  const [path, setPath] = useState(card.path);
  const [lines, setLines] = useState<string[]>([]);
  const [json, setJson] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let live = true;
    setStatus("load");
    loadAnalog(card)
      .then((res) => {
        if (!live) return;
        setHttp(res.status);
        setPath(res.path);
        setLines(analogSummary(card.id, res.body));
        const pretty = JSON.stringify(res.body, null, 2);
        setJson(pretty.length > 6000 ? `${pretty.slice(0, 6000)}\n…` : pretty);
        setStatus(res.status >= 200 && res.status < 300 ? "ok" : "err");
      })
      .catch(() => {
        if (!live) return;
        setStatus("err");
      });
    return () => {
      live = false;
    };
  }, [card]);

  return (
    <div className="vx-cmd-scrim" role="presentation" onClick={onClose}>
      <div
        className="vx-proof"
        role="dialog"
        aria-modal="true"
        aria-label={`Prove ${card.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Analog on this host</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight">{card.name}</h2>
            <p className="mt-1 break-all font-mono text-[11px] text-mist">{path}</p>
          </div>
          <span
            className={`shrink-0 text-[10px] uppercase tracking-[0.16em] ${
              status === "ok" && card.status === "LIVE"
                ? "text-ok"
                : status === "err"
                  ? "text-bad"
                  : "text-warn"
            }`}
          >
            {status === "load" ? "…" : status === "ok" ? `${http} · ${card.status}` : "failed"}
          </span>
        </div>
        <div className="min-w-0 overflow-hidden px-5 py-4">
          <p className="text-sm leading-relaxed text-mute">{card.detail}</p>
          {status === "load" ? <p className="mt-4 text-sm text-mute">Fetching the analog…</p> : null}
          {status === "err" ? (
            <p className="mt-4 text-sm text-warn">The analog did not answer. The vendor tenant is not subscribed; this path is hosted here.</p>
          ) : null}
          {lines.length ? (
            <ul className="mt-4 grid gap-1 text-sm text-paper">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
          {json ? (
            <pre className="vx-proof-json mt-4">{json}</pre>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <button type="button" className="text-sm text-mute hover:text-paper" onClick={onClose}>
            Close
          </button>
          <Link
            to="/desk"
            search={{ prove: card.id }}
            className="inline-flex h-11 items-center rounded-[8px] bg-gold px-4 text-sm text-plum hover:opacity-90"
            onClick={onClose}
          >
            Open on Elena’s desk
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProveAnalogButton({
  card,
  label = "Prove analog",
  className,
}: {
  card: AdapterCard;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? <AnalogProof card={card} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
