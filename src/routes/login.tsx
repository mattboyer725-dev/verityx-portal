import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorNote } from "@/components/page-header";
import { SiteNav } from "@/components/site-nav";
import { VxWordmark } from "@/components/vx-mark";
import { MIN_PASSWORD_LENGTH } from "@/lib/verityx/constants";
import { normalizeEmail, safeAppPath } from "@/lib/verityx/format";
import { enterOwnerSeat } from "@/lib/owner-enter";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: Login,
});

function Login() {
  const { user } = useCurrentUserState();
  const { redirect } = Route.useSearch();
  const dest = safeAppPath(redirect);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={dest} replace />;

  async function enterOwner() {
    setError(null);
    setBusy(true);
    try {
      await enterOwnerSeat();
      queryClient.clear();
      await navigate({ to: "/admin", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open command");
      setBusy(false);
    }
  }

  async function returnToPlatform() {
    queryClient.clear();
    await authClient.getSession().catch(() => undefined);
    await navigate({ to: dest, replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!authEnabled) {
      setError("Sign-in is disabled.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: normalized,
          password,
          name: name.trim() || normalized.split("@")[0],
        });
        if (err) throw new Error(err.message ?? "Could not create the workspace");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: normalized,
          password,
        });
        if (err) throw new Error(err.message ?? "Could not sign in");
      }
      await returnToPlatform();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-ink lg:grid-cols-2">
      <section className="login-plane relative hidden flex-col justify-between border-r border-line px-12 py-12 lg:flex">
        <Link to="/" className="login-lockup">
          <VxWordmark />
        </Link>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-mute">Supply chain risk audit</p>
          <h1 className="mt-4 max-w-md font-display text-5xl leading-[1.1] text-paper">
            One paying pilot. A decision you can defend.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-mute">
            $2,500 · 72-hour target · advisory only. Evidence in, human approval for BLOCK, no fabricated
            intelligence.
          </p>
        </div>
        <p className="text-xs text-mute">v1.0-soft-prod · Customer Zero OS</p>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <SiteNav tone="ink" />
          </div>
          <h2 className="font-display text-3xl tracking-tight">
            {mode === "in" ? "Sign in" : "Create a workspace"}
          </h2>
          <p className="mt-2 text-sm text-mute">
            {mode === "in"
              ? "Continue, then return to the platform hub."
              : "Register the organization that will own the first customer."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            {mode === "up" ? (
              <Field label="Your name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            ) : null}
            <Field label="Work email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </Field>
            <ErrorNote message={error} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "in" ? "Enter platform" : "Create workspace"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-[8px] border border-line text-sm text-paper hover:bg-raised"
            disabled={busy}
            onClick={() => void enterOwner()}
          >
            {busy ? "Opening…" : "Enter as owner"}
          </button>

          <button
            type="button"
            className="mt-4 text-sm text-mute hover:text-paper"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
            }}
          >
            {mode === "in" ? "Need a workspace? Register" : "Already registered? Sign in"}
          </button>

          {authEnabled ? (
            <div className="mt-8">
              <p className="mb-3 text-center text-[11px] uppercase tracking-[0.16em] text-mute">Or continue with</p>
              <div className="space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() =>
                      signIn(p.providerId, { callbackURL: dest, errorCallbackURL: "/login" })
                    }
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-mute">Sign-in is disabled.</p>
          )}

          <div className="mt-8 space-y-2 border-t border-line pt-6 text-sm">
            <Link to="/" className="block text-mute hover:text-paper">
              Back to the platform hub →
            </Link>
            <Link to="/desk" className="block text-mute hover:text-paper">
              Open the Siemens Gamesa magnetics desk →
            </Link>
            <Link to="/core" className="block text-mute hover:text-paper">
              Verify the signed core →
            </Link>
            <Link to="/admin" className="block text-mute hover:text-paper">
              Owner command →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
