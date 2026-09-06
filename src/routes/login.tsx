import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { VxMark } from "@/components/vx-mark";
import { OWNER_EMAIL } from "@/lib/admin";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="login-wrap">
        <div className="login-card vx-skel" aria-hidden="true">
          <div className="vx-skel-bar" />
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/admin" />;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="vx-brand">
          <VxMark />
          <div className="vx-word">
            <strong>VERITYX</strong>
            <span>Sovereign · command</span>
          </div>
        </div>
        <h1>Owner command</h1>
        <p>
          Continue with Google as {OWNER_EMAIL}. The live magnetics desk is a separate one-click Siemens Gamesa seat.
        </p>
        {authEnabled ? (
          <div className="vx-stack">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className={p.idp === "google" ? "vx-btn vx-btn-primary" : "vx-btn vx-btn-ghost"}
                style={{ width: "100%" }}
                onClick={() => signIn(p.providerId, { callbackURL: "/admin" })}
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="login-err">Sign-in is disabled.</p>
        )}
        <p className="hint">
          <Link to="/">Back to live desk</Link>
        </p>
      </div>
    </div>
  );
}
