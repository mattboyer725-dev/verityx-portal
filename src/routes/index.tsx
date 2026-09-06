import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Desk, LoginGate } from "@/components/desk";
import { hasSession } from "@/lib/session";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [inDesk, setInDesk] = useState(false);

  useEffect(() => {
    if (hasSession()) setInDesk(true);
  }, []);

  if (!inDesk) return <LoginGate onEnter={() => setInDesk(true)} />;
  return <Desk onLeave={() => setInDesk(false)} />;
}
