import { Command } from "cmdk";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FIELD } from "@/lib/competition";
import { OS_LINKS, SURFACES, VX_COMMAND_EVENT, openCommandPalette } from "@/lib/nav";

export { openCommandPalette };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function go(to: string, hash?: string) {
    setOpen(false);
    void navigate({ to: to as "/", hash });
  }

  if (!open) return null;

  return (
    <div className="vx-cmd-scrim" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="vx-cmd"
        role="dialog"
        aria-modal="true"
        aria-label="Platform menu"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          loop
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <Command.Input placeholder="Jump to a surface, competitor, or OS file…" autoFocus />
          <Command.List>
            <Command.Group heading="Surfaces">
              {SURFACES.map((item) => (
                <Command.Item
                  key={item.to}
                  value={`${item.label} ${item.hint} ${item.keywords}`}
                  onSelect={() => go(item.to)}
                >
                  <span>{item.label}</span>
                  <span>{item.hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Customer Zero OS">
              {OS_LINKS.map((item) => (
                <Command.Item
                  key={item.to}
                  value={`${item.label} ${item.hint} ${item.keywords} os`}
                  onSelect={() => go(item.to)}
                >
                  <span>{item.label}</span>
                  <span>{item.hint}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Field">
              {FIELD.map((row) => (
                <Command.Item
                  key={row.id}
                  value={`${row.names} ${row.category} ${row.analog ?? ""} ${row.analogPath ?? ""}`}
                  onSelect={() => go("/field", row.id)}
                >
                  <span>{row.names}</span>
                  <span>{row.category}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Empty>Nothing matches. Try desk, field, EcoVadis, or pilots.</Command.Empty>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
