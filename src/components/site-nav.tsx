import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { VxWordmark } from "@/components/vx-mark";
import { SURFACES, openCommandPalette } from "@/lib/nav";

type Tone = "ink" | "linen";

function surfaceActive(pathname: string, to: string, exact?: boolean) {
  if (exact) return pathname === to;
  if (to === "/verify") return pathname === "/verify" || pathname.startsWith("/passport/");
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Signed in → Workspace. Signed out → Sign in. Never a dead end. */
function AccountCta({ onClick, block }: { onClick?: () => void; block?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  // The server can't know the session; render the same placeholder on the first client pass to keep hydration clean.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cls = cn("site-nav-cta", block && "site-nav-cta-block");
  if (!mounted || isPending) return <span className={cn(cls, "opacity-0")} aria-hidden="true">Workspace</span>;
  if (user) {
    return (
      <Link to="/work" className={cls} onClick={onClick}>
        Workspace
        <ArrowRight className="size-3.5" strokeWidth={2} />
      </Link>
    );
  }
  return (
    <Link to="/login" search={{ redirect: "/work" }} className={cls} onClick={onClick}>
      Sign in
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
          <Link
            key={item.to}
            to={item.to}
            className={cn("site-nav-link", surfaceActive(pathname, item.to, item.exact) && "is-active")}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="site-nav-actions">
        <button type="button" className="site-nav-cmd" aria-label="Search pages and passports" onClick={() => openCommandPalette()}>
          <Search className="size-3.5" strokeWidth={1.8} />
          <kbd>⌘K</kbd>
        </button>
        <span className="site-nav-cta-wrap">
          <AccountCta />
        </span>
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
            <Link
              key={item.to}
              to={item.to}
              className={cn("site-nav-sheet-link", surfaceActive(pathname, item.to, item.exact) && "is-active")}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <AccountCta onClick={() => setOpen(false)} block />
        </nav>
      ) : null}
    </header>
  );
}
