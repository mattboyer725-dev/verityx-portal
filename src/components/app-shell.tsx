import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Crown,
  FileText,
  Fingerprint,
  Gavel,
  Home,
  LayoutDashboard,
  Menu,
  Scale,
  ScrollText,
  Settings,
  Users,
  X,
  Layers,
  PackageCheck,
  CreditCard,
  BadgeCheck,
  Gauge,
  Tag,
  Globe,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useWorkspaceLive } from "@/lib/verityx/live";
import { cn } from "@/lib/cn";
import { SURFACES, WORK_GROUPS, openCommandPalette, workGroupsFor } from "@/lib/nav";
import { LivePulse, Pill } from "./status";
import { VxMark } from "./vx-mark";

const ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/": Home,
  "/core": Fingerprint,
  "/verify": BadgeCheck,
  "/check": Gauge,
  "/pricing": Tag,
  "/work": LayoutDashboard,
  "/work/sales": TrendingUp,
  "/work/prospects": Users,
  "/work/pilots": ClipboardList,
  "/work/portfolio": PackageCheck,
  "/work/billing": CreditCard,
  "/work/passports": Layers,
  "/work/decisions": Scale,
  "/work/reports": FileText,
  "/work/learning": Gavel,
  "/work/audit": ScrollText,
  "/work/settings": Settings,
  "/admin": Crown,
};

function NavLinks({ onNavigate, ownerTools }: { onNavigate?: () => void; ownerTools: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-5" aria-label="Workspace">
      {workGroupsFor(ownerTools).map((group) => (
        <div key={group.title ?? "home"}>
          {group.title ? (
            <p className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.18em] text-mute/80">{group.title}</p>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.links.map((item) => {
              const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = ICONS[item.to] ?? LayoutDashboard;
              return (
                <Link
                  key={item.to}
                  to={item.to as "/"}
                  onClick={onNavigate}
                  title={item.hint}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors",
                    active ? "bg-raised text-paper shadow-[inset_2px_0_0_var(--color-gold)]" : "text-mute hover:bg-raised/60 hover:text-paper",
                  )}
                >
                  <Icon className={cn("size-4", active && "text-gold")} strokeWidth={1.6} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.18em] text-mute/80">Public</p>
        <div className="flex flex-col gap-0.5">
          {SURFACES.filter((s) => s.to !== "/").map((item) => {
            const Icon = ICONS[item.to] ?? Globe;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={item.hint}
                className="flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm text-mute transition-colors hover:bg-raised/60 hover:text-paper"
              >
                <Icon className="size-4" strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/work" className="flex items-center gap-3 px-1">
      <VxMark className="size-8 shrink-0" title="VerityX" />
      <span>
        <span className="block font-display vx-wordmark-name text-lg leading-none">VerityX</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-mute">Workspace</span>
      </span>
    </Link>
  );
}

const OWNER_PATHS = WORK_GROUPS.filter((g) => g.ownerOnly).flatMap((g) => g.links.map((l) => l.to));

function isOwnerPath(pathname: string) {
  return OWNER_PATHS.some((to) => pathname === to || pathname.startsWith(`${to}/`));
}

export function AppShell() {
  const { data: workspace, refreshing, updatedAt } = useWorkspaceLive();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const blocked = !!workspace && !workspace.ownerTools && isOwnerPath(pathname);

  return (
    <div className="min-h-dvh bg-ink text-paper">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-graphite/90 px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-8 flex-1 overflow-y-auto px-0">
          <NavLinks ownerTools={!!workspace?.ownerTools} />
        </div>
        <div className="mt-4 space-y-3 border-t border-line px-1 pt-4">
          {workspace ? (
            <div>
              <p className="truncate text-xs text-mute">{workspace.organization.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <Pill tone={workspace.role}>{workspace.role}</Pill>
                <span className="text-[10px] uppercase tracking-[0.14em] text-mute">
                  {(workspace.members?.length ?? 0)} seat
                  {(workspace.members?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-10 animate-pulse rounded-[8px] bg-raised" />
          )}
          <button type="button" className="site-nav-cmd site-nav-cmd-rail" onClick={() => openCommandPalette()}>
            <span className="site-nav-cmd-label">Search</span>
            <kbd>⌘K</kbd>
          </button>
          <UserButton />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <button type="button" className="site-nav-cmd" aria-label="Search pages and passports" onClick={() => openCommandPalette()}>
            <Search className="size-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-[12px] border border-line"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/70 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-[min(100%,18rem)] border-r border-line bg-graphite p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button type="button" className="grid size-11 place-items-center" onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <NavLinks ownerTools={!!workspace?.ownerTools} onNavigate={() => setOpen(false)} />
            <div className="mt-6 border-t border-line pt-4">
              <UserButton />
            </div>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-wrap items-center justify-end gap-2 text-[11px] uppercase tracking-[0.16em] text-mute">
            <LivePulse refreshing={refreshing} updatedAt={updatedAt} />
          </div>
          {blocked ? (
            <div className="panel max-w-xl p-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Not available</p>
              <h1 className="mt-3 font-display text-3xl">This area isn’t part of your workspace.</h1>
              <Link to="/work" className="mt-6 inline-flex text-sm text-gold hover:text-paper">
                Back to overview →
              </Link>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
    </div>
  );
}
