import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Compass,
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
  Shield,
  Users,
  X,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useWorkspaceLive } from "@/lib/verityx/live";
import { cn } from "@/lib/cn";
import { OS_LINKS, SURFACES, openCommandPalette } from "@/lib/nav";
import { LivePulse, Pill } from "./status";
import { VxMark } from "./vx-mark";

const ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/": Home,
  "/desk": Shield,
  "/field": Compass,
  "/core": Fingerprint,
  "/work": LayoutDashboard,
  "/work/prospects": Users,
  "/work/pilots": ClipboardList,
  "/work/decisions": Scale,
  "/work/reports": FileText,
  "/work/learning": Gavel,
  "/work/audit": ScrollText,
  "/work/settings": Settings,
  "/admin": Crown,
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    ...SURFACES.filter((s) => s.to !== "/work" && s.to !== "/admin"),
    ...OS_LINKS,
    ...SURFACES.filter((s) => s.to === "/admin"),
  ];
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = ICONS[item.to] ?? LayoutDashboard;
        return (
          <Link
            key={item.to}
            to={item.to as "/"}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm transition-colors",
              active ? "bg-raised text-gold" : "text-mute hover:bg-raised/60 hover:text-paper",
            )}
          >
            <Icon className="size-4" strokeWidth={1.6} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/work" className="flex items-center gap-3 px-1">
      <VxMark className="size-8 shrink-0" title="VerityX" />
      <span>
        <span className="block font-display vx-wordmark-name text-lg leading-none">VerityX</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-mute">Customer Zero OS</span>
      </span>
    </Link>
  );
}

export function AppShell() {
  const { data: workspace, refreshing, updatedAt } = useWorkspaceLive();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-ink text-paper">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-graphite/90 px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-8 flex-1 overflow-y-auto px-0">
          <NavLinks />
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
            <span className="site-nav-cmd-label">Menu</span>
            <kbd>⌘K</kbd>
          </button>
          <UserButton />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <button type="button" className="site-nav-cmd" aria-label="Open platform menu" onClick={() => openCommandPalette()}>
            <span className="site-nav-cmd-label">Menu</span>
            <kbd>⌘K</kbd>
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
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-6 border-t border-line pt-4">
              <UserButton />
            </div>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-mute">
            <span className="inline-flex items-center gap-2">
              <Shield className="size-3.5" strokeWidth={1.6} />
              Advisory system · tenant file · no automatic accusations
            </span>
            <LivePulse refreshing={refreshing} updatedAt={updatedAt} />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
