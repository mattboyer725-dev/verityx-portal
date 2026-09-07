import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Desk, LoginGate } from "@/components/desk";
import { hasSession } from "@/lib/session";

export const Route = createFileRoute("/desk")({
  validateSearch: (search: Record<string, unknown>): { prove?: string } => ({
    prove: typeof search.prove === "string" && search.prove.length < 40 ? search.prove : undefined,
  }),
  component: DeskPage,
});

function DeskPage() {
  const { prove } = Route.useSearch();
  const [inDesk, setInDesk] = useState(false);

  useEffect(() => {
    if (hasSession()) setInDesk(true);
  }, []);

  if (!inDesk) return <LoginGate prove={prove} onEnter={() => setInDesk(true)} />;
  return <Desk prove={prove} onLeave={() => setInDesk(false)} />;
}