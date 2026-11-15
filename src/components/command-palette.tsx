import { Command } from "cmdk";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FOOTER_GROUPS, SURFACES, VX_COMMAND_EVENT, openCommandPalette, workGroupsFor } from "@/lib/nav";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { normalizePassportCode } from "@/components/passport-lookup";
import { getWorkspace } from "@/lib/verityx/api";
import { vxKeys } from "@/lib/verityx/live";

export { openCommandPalette };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();
  // Shares the app shell's cache; only fetched when the palette is open for a signed-in user.
  const ws = useQuery({ queryKey: vxKeys.workspace, queryFn: () => getWorkspace(), enabled: open && !!user, staleTime: 30_000 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(VX_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(VX_COMMAND_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function go(to: string) {
    setOpen(false);
    void navigate({ to: to as "/" });
  }

  if (!open) return null;

  const code = normalizePassportCode(search);
  const groups = user ? workGroupsFor(!!ws.data?.ownerTools) : [];
  const publicLinks = [
    ...SURFACES.map((s) => ({ to: s.to as string, label: s.label, hint: s.hint, keywords: s.keywords })),
    ...FOOTER_GROUPS.flatMap((g) => g.links)
      .filter((l) => !SURFACES.some((s) => s.to === l.href))
      .map((l) => ({ to: l.href, label: l.label, hint: "", keywords: "" })),
  ];

  return (
    <div className="vx-cmd-scrim" role="presentation" onClick={() => setOpen(false)}>
      <div className="vx-cmd" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <Command
          loop
          filter={(value, q) => {
            if (!q) return 1;
            if (value.startsWith("__passport")) return 1;
            return value.toLowerCase().includes(q.toLowerCase()) ? 1 : 0;
          }}
        >
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Go to a page, or paste a passport code…"
            autoFocus
          />
          <Command.List>
            {code ? (
              <Command.Group heading="Passport">
                <Command.Item value={`__passport ${code}`} onSelect={() => go(`/passport/${code}`)}>
                  <span>Open {code}</span>
                  <span>Verify the chain</span>
                </Command.Item>
              </Command.Group>
            ) : null}
            {groups.map((g) => (
              <Command.Group key={g.title ?? "Workspace"} heading={g.title ?? "Workspace"}>
                {g.links.map((item) => (
                  <Command.Item
                    key={item.to}
                    value={`${item.label} ${item.hint} ${item.keywords} ${g.title ?? ""}`}
                    onSelect={() => go(item.to)}
                  >
                    <span>{item.label}</span>
                    <span>{item.hint}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
            <Command.Group heading="Public">
              {publicLinks.map((item) => (
                <Command.Item key={item.to} value={`${item.label} ${item.hint} ${item.keywords}`} onSelect={() => go(item.to)}>
                  <span>{item.label}</span>
                  <span>{item.hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Empty>Nothing matches. Try portfolio, passports, verify or pricing.</Command.Empty>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
