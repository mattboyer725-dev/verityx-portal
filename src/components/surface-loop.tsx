import { Link, useRouterState } from "@tanstack/react-router";
import { LOOP } from "@/lib/nav";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";

export function SurfaceLoop({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();

  return (
    <ol className={cn("vx-loop", className)}>
      {LOOP.map((step) => {
        const active =
          step.to === "/work"
            ? pathname === "/work" || pathname.startsWith("/work/")
            : pathname === step.to || pathname.startsWith(`${step.to}/`);
        const needsLogin = step.to === "/work" && !isPending && !user;
        const body = (
          <>
            <span className="n">{step.n}</span>
            {step.label}
          </>
        );
        return (
          <li key={step.n}>
            {needsLogin ? (
              <Link to="/login" search={{ redirect: "/work" }} className={cn(active && "is-active")}>
                {body}
              </Link>
            ) : (
              <Link to={step.to} className={cn(active && "is-active")}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
