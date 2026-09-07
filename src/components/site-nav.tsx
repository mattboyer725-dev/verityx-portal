import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { VxWordmark } from "@/components/vx-mark";
import { SURFACES } from "@/lib/nav";
import { openCommandPalette } from "@/lib/nav";

type Tone = "ink" | "linen";

function surfaceActive(pathname: string, to: string, exact?: boolean) {
  if (to === "/work") return pathname === "/work" || pathname.startsWith("/work/");
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function OsAwareLink({
  to,
  label,
  className,
  onClick,
}: {
  to: string;
  label: string;
  className: string;
  onClick?: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  if (to === "/work" && !isPending && !user) {
    return (
      <Link to="/login" search={{ redirect: "/work" }} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  }
  return (
    <Link to={to as "/"} className={className} onClick={onClick}>
      {label}
    </Link>
  );
}

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
        <VxWordmark name={brand} />
      </Link>
      <nav className="site-nav-row" aria-label="Primary">
        {SURFACES.map((item) => (
          <OsAwareLink
            key={item.to}
            to={item.to}
            label={item.label}
            className={cn("site-nav-link", surfaceActive(pathname, item.to, item.exact) && "is-active")}
          />
        ))}
      </nav>
      <div className="site-nav-actions">
        <button
          type="button"
          className="site-nav-cmd"
          aria-label="Open platform menu"
          onClick={() => openCommandPalette()}
        >
          <span className="site-nav-cmd-label">Menu</span>
          <kbd>⌘K</kbd>
        </button>
        <button
          type="button"
          className="site-nav-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" strokeWidth={1.8} /> : <Menu className="size-4" strokeWidth={1.8} />}
        </button>
      </div>
      {open ? (
        <nav className="site-nav-sheet" aria-label="Primary">
          {SURFACES.map((item) => (
            <OsAwareLink
              key={item.to}
              to={item.to}
              label={item.label}
              className={cn("site-nav-sheet-link", surfaceActive(pathname, item.to, item.exact) && "is-active")}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>
      ) : null}
    </header>
  );
}
