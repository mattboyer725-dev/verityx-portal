import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/work")({ component: WorkLayout });

function WorkLayout() {
  const { user, isPending } = useCurrentUserState();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!isPending) return;
    const t = window.setTimeout(() => setGaveUp(true), 2500);
    return () => window.clearTimeout(t);
  }, [isPending]);

  if (user) return <AppShell />;
  if (isPending && !gaveUp) {
    return (
      <div className="min-h-dvh bg-ink">
        <div className="hidden lg:block">
          <div className="fixed inset-y-0 left-0 w-60 border-r border-line bg-graphite" />
        </div>
        <div className="lg:pl-60">
          <div className="h-14 border-b border-line lg:hidden" />
          <div className="p-8">
            <div className="h-10 w-48 animate-pulse rounded-[12px] bg-raised" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="h-28 animate-pulse rounded-[24px] bg-graphite" />
              <div className="h-28 animate-pulse rounded-[24px] bg-graphite" />
              <div className="h-28 animate-pulse rounded-[24px] bg-graphite" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <Navigate to="/login" search={{ redirect: "/work" }} />;
}