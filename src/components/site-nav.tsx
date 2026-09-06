import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

const LINKS: { to: "/" | "/desk" | "/core" | "/work" | "/admin"; label: string; exact?: boolean }[] = [
  { to: "/", label: "Hub", exact: true },
  { to: "/desk", label: "Desk" },
  { to: "/core", label: "Core" },
  { to: "/work", label: "OS" },
  { to: "/admin", label: "Command" },
];

type Tone = "ink" | "linen";

export function SiteNav({
  tone = "ink",
  brand = "VerityX",
}: {
  tone?: Tone;
  brand?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const linen = tone === "linen";

  return (
    <header className={cn("site-nav", linen ? "site-nav-linen" : "site-nav-ink")}>
      <Link to="/" className="site-nav-brand" onClick={() => setOpen(false)}>
        {brand}
      </Link>
      <nav className="site-nav-row" aria-label="Primary">
        {LINKS.map((item) => {
          const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link key={item.to} to={item.to} className={cn("site-nav-link", active && "is-active")}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        className="site-nav-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-4" strokeWidth={1.8} /> : <Menu className="size-4" strokeWidth={1.8} />}
      </button>
      {open ? (
        <nav className="site-nav-sheet" aria-label="Primary">
          {LINKS.map((item) => {
            const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn("site-nav-sheet-link", active && "is-active")}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
