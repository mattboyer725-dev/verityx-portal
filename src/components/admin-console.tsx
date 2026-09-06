import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  ACCESS_MATRIX,
  ADMIN_ROLES,
  OWNER_EMAIL,
  can,
  type AdminPerm,
  type Presence,
} from "@/lib/admin";
import {
  createAdminKey,
  getAdminState,
  runAdminAction,
  type AdminAction,
  type AdminSnapshot,
  type IdentityRow,
  type SeatRow,
} from "@/lib/admin-api";
import { VxMark } from "@/components/vx-mark";

type Panel =
  | "command"
  | "monitor"
  | "identities"
  | "seats"
  | "access"
  | "agents"
  | "alerts"
  | "policies"
  | "sessions"
  | "flags"
  | "security"
  | "keys"
  | "audit"
  | "backup";

const NAV: { label: string; items: { id: Panel; label: string }[] }[] = [
  {
    label: "Command",
    items: [
      { id: "command", label: "Overview" },
      { id: "monitor", label: "Monitor" },
    ],
  },
  {
    label: "People",
    items: [
      { id: "identities", label: "Identities" },
      { id: "seats", label: "Seats" },
      { id: "sessions", label: "Sessions" },
      { id: "access", label: "Access" },
    ],
  },
  {
    label: "Control",
    items: [
      { id: "agents", label: "Agents" },
      { id: "alerts", label: "Alerts" },
      { id: "policies", label: "Policies" },
      { id: "flags", label: "Flags" },
    ],
  },
  {
    label: "Trust",
    items: [
      { id: "security", label: "Security" },
      { id: "keys", label: "Keys" },
      { id: "audit", label: "Audit" },
      { id: "backup", label: "Backup" },
    ],
  },
];

const PANELS = NAV.flatMap((g) => g.items);

function pillFor(v: string) {
  const s = v.toLowerCase();
  if (["active", "healthy", "open", "owner", "verified", "release", "online"].includes(s)) return "pill pill-ok";
  if (["suspended", "down", "critical", "high", "closed", "revoked", "offline"].includes(s)) return "pill pill-bad";
  if (["degraded", "med", "ack", "invited", "restarted", "watch", "idle", "pending"].includes(s)) return "pill pill-mid";
  return "pill pill-cyan";
}

function relTime(iso: string | null) {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const d = Date.now() - t;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

function canDo(state: AdminSnapshot, perm: AdminPerm) {
  return state.actor.permissions.includes(perm);
}

function matchQ(q: string, ...parts: (string | null | undefined)[]) {
  if (!q) return true;
  const n = q.trim().toLowerCase();
  return parts.some((p) => (p ?? "").toLowerCase().includes(n));
}

function uaShort(ua: string | null) {
  if (!ua) return "unknown client";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return ua.slice(0, 28);
}

export function AdminPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="login-wrap">
        <div className="login-card vx-skel" aria-hidden="true">
          <div className="vx-skel-bar" />
          <div className="vx-skel-bar wide" />
        </div>
      </div>
    );
  }

  if (!user) return <AdminSignIn />;
  return <AdminConsole />;
}

function AdminSignIn() {
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
        <h1>Enter platform command</h1>
        <p>
          Operator control for identities, seats, live desk activity, agents, gates, sessions, keys, and the
          sealed ledger. Owner seat is {OWNER_EMAIL}. Continue with Google using that Gmail.
        </p>
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
        <p className="hint">
          <Link to="/">Platform hub</Link>
          {" · "}
          <Link to="/desk">Siemens Gamesa live desk</Link>
        </p>
      </div>
    </div>
  );
}

function AdminConsole() {
  const [state, setState] = useState<AdminSnapshot | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [panel, setPanel] = useState<Panel>("command");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("Command online");
  const [query, setQuery] = useState("");
  const [focusUser, setFocusUser] = useState<string | null>(null);

  async function refresh() {
    try {
      const next = await getAdminState();
      if (!next.ok) {
        setDenied(next.actor.reason || "Access denied.");
        setState(null);
        return;
      }
      setDenied(null);
      setState(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load command.";
      if (msg.toLowerCase().includes("unauthorized")) {
        setLoadErr("Session expired. Sign in with Google again.");
      } else {
        setLoadErr(msg);
      }
    }
  }

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(t);
  }, []);

  async function act(action: AdminAction, okNote: string) {
    setBusy(true);
    try {
      const next = await runAdminAction({ data: action });
      if (!next.ok) {
        setNote(next.actor.reason || "Denied");
      } else {
        setState(next);
        setNote(okNote);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Command unavailable</h1>
          <p>{loadErr}</p>
          <div className="vx-actions">
            <Link className="vx-btn vx-btn-ghost" to="/login">
              Sign in
            </Link>
            <Link className="vx-btn vx-btn-ghost" to="/">
              Platform hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (denied) {
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
          <h1>No command seat</h1>
          <p>
            {denied} Platform owner is {OWNER_EMAIL}. A buyer or viewer identity cannot enter this surface.
          </p>
          <div className="vx-actions">
            <Link className="vx-btn vx-btn-primary" to="/desk">
              Open desk
            </Link>
            <Link className="vx-btn vx-btn-ghost" to="/">
              Platform hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="vx-shell">
        <header className="vx-top">
          <div className="vx-brand">
            <VxMark />
            <div className="vx-word">
              <strong>VERITYX</strong>
              <span>Sovereign · command</span>
            </div>
          </div>
        </header>
        <div className="login-wrap">
          <div className="login-card vx-skel">
            <div className="vx-skel-bar" />
            <div className="vx-skel-bar wide" />
          </div>
        </div>
      </div>
    );
  }

  const live = state.frozen ? "DESK FROZEN" : state.security.maintenance ? "MAINTENANCE" : "LIVE · COMMAND";

  return (
    <div className="vx-shell">
      <header className="vx-top">
        <div className="vx-brand">
          <VxMark />
          <div className="vx-word">
            <strong>VERITYX</strong>
            <span>Sovereign v6 · command</span>
          </div>
        </div>
        <div className={state.frozen || state.security.maintenance ? "vx-live vx-live-hold" : "vx-live"}>{live}</div>
        <label className="vx-search" htmlFor="vx-q">
          <span className="vx-label" style={{ margin: 0 }}>
            Search
          </span>
          <input
            id="vx-q"
            className="vx-input"
            placeholder="Identities, seats, alerts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="vx-user">
          <UserButton />
          <Link className="vx-btn vx-btn-ghost" to="/desk">
            Desk
          </Link>
          <Link className="vx-btn vx-btn-ghost" to="/work">
            OS
          </Link>
        </div>
      </header>

      <div className="vx-admin">
        <aside className="vx-side">
          {NAV.map((g) => (
            <div key={g.label}>
              <div className="vx-label">{g.label}</div>
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`vx-side-btn ${panel === p.id ? "on" : ""}`}
                  onClick={() => setPanel(p.id)}
                >
                  {p.label}
                  {p.id === "alerts" ? <span className="mono">{state.kpis.alertsOpen}</span> : null}
                  {p.id === "identities" ? <span className="mono">{state.kpis.identities}</span> : null}
                  {p.id === "seats" ? <span className="mono">{state.kpis.seats}</span> : null}
                  {p.id === "monitor" ? <span className="mono">{state.kpis.online}</span> : null}
                  {p.id === "sessions" ? <span className="mono">{state.kpis.sessions}</span> : null}
                </button>
              ))}
            </div>
          ))}
          <p className="vx-side-note">{note}</p>
        </aside>

        <main className="vx-main">
          <div className="vx-admin-mobile">
            <label className="vx-label" htmlFor="vx-panel">
              Panel
            </label>
            <select
              id="vx-panel"
              className="vx-select"
              value={panel}
              onChange={(e) => setPanel(e.target.value as Panel)}
            >
              {PANELS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {query.trim() ? <SearchHits state={state} query={query} setPanel={setPanel} setFocusUser={setFocusUser} /> : null}
          {panel === "command" ? <CommandPanel state={state} busy={busy} act={act} /> : null}
          {panel === "monitor" ? (
            <MonitorPanel state={state} query={query} setFocusUser={setFocusUser} setPanel={setPanel} />
          ) : null}
          {panel === "identities" ? (
            <IdentitiesPanel state={state} busy={busy} act={act} query={query} focusUser={focusUser} setFocusUser={setFocusUser} />
          ) : null}
          {panel === "seats" ? <SeatsPanel state={state} busy={busy} act={act} query={query} /> : null}
          {panel === "access" ? <AccessPanel state={state} /> : null}
          {panel === "agents" ? <AgentsPanel state={state} busy={busy} act={act} /> : null}
          {panel === "alerts" ? <AlertsPanel state={state} busy={busy} act={act} query={query} /> : null}
          {panel === "policies" ? <PoliciesPanel state={state} busy={busy} act={act} /> : null}
          {panel === "sessions" ? <SessionsPanel state={state} busy={busy} act={act} query={query} /> : null}
          {panel === "flags" ? <FlagsPanel state={state} busy={busy} act={act} /> : null}
          {panel === "security" ? <SecurityPanel state={state} busy={busy} act={act} /> : null}
          {panel === "keys" ? (
            <KeysPanel state={state} busy={busy} act={act} setState={setState} setNote={setNote} setBusy={setBusy} />
          ) : null}
          {panel === "audit" ? <AuditPanel state={state} query={query} /> : null}
          {panel === "backup" ? <BackupPanel state={state} busy={busy} act={act} /> : null}
        </main>
      </div>

      <footer className="vx-status">
        <span>
          Owner <strong>{state.ownerEmail}</strong>
        </span>
        <span>
          Online <strong>{state.kpis.online}</strong>
        </span>
        <span>
          Seats <strong>
            {state.kpis.seatsActive}/{state.kpis.seats}
          </strong>
        </span>
        <span>
          Agents <strong>
            {state.kpis.agentsHealthy}/{state.kpis.agentsTotal}
          </strong>
        </span>
        <span>
          Sessions <strong>{state.kpis.sessions}</strong>
        </span>
        <span>
          Pulse <strong>{relTime(state.generatedAt)}</strong>
        </span>
      </footer>
    </div>
  );
}

function SearchHits({
  state,
  query,
  setPanel,
  setFocusUser,
}: {
  state: AdminSnapshot;
  query: string;
  setPanel: (p: Panel) => void;
  setFocusUser: (id: string | null) => void;
}) {
  const ids = state.identities.filter((i) => matchQ(query, i.name, i.email, i.role)).slice(0, 4);
  const seats = state.seats.filter((s) => matchQ(query, s.name, s.email, s.title, s.plant)).slice(0, 4);
  const alerts = state.alerts.filter((a) => matchQ(query, a.title, a.detail, a.source)).slice(0, 4);
  if (!ids.length && !seats.length && !alerts.length) {
    return <p className="vx-copy">No matches for “{query}”.</p>;
  }
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Search
        <span>{query}</span>
      </div>
      <div className="vx-pad vx-hit-list">
        {ids.map((i) => (
          <button
            key={i.id}
            type="button"
            className="vx-hit"
            onClick={() => {
              setFocusUser(i.id);
              setPanel("identities");
            }}
          >
            <span className={pillFor(i.presence)}>{i.presence}</span>
            <strong>{i.name}</strong>
            <span className="vx-sub">{i.email}</span>
          </button>
        ))}
        {seats.map((s) => (
          <button key={s.id} type="button" className="vx-hit" onClick={() => setPanel("seats")}>
            <span className={pillFor(s.status)}>{s.role}</span>
            <strong>{s.name}</strong>
            <span className="vx-sub">{s.email}</span>
          </button>
        ))}
        {alerts.map((a) => (
          <button key={a.id} type="button" className="vx-hit" onClick={() => setPanel("alerts")}>
            <span className={pillFor(a.severity)}>{a.severity}</span>
            <strong>{a.title}</strong>
            <span className="vx-sub">{a.source}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CommandPanel({
  state,
  busy,
  act,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  const tenant = state.tenants[0];
  const holdPct = (state.kpis.hold / Math.max(state.kpis.pos, 1)) * 100;
  const healthyPct = (state.kpis.agentsHealthy / Math.max(state.kpis.agentsTotal, 1)) * 100;
  const [licence, setLicence] = useState(String(tenant?.seatsLicensed ?? 40));
  useEffect(() => {
    setLicence(String(tenant?.seatsLicensed ?? 40));
  }, [tenant?.seatsLicensed]);

  return (
    <>
      <div className="vx-kpis">
        <div className="vx-kpi">
          <div className="k">Open POs</div>
          <div className="v">{state.kpis.pos}</div>
          <div className="s">Live magnetics book</div>
        </div>
        <div className="vx-kpi">
          <div className="k">Hold</div>
          <div className="v vx-bad">{state.kpis.hold}</div>
          <div className="s">{state.kpis.release} clear to release</div>
        </div>
        <div className="vx-kpi">
          <div className="k">Gross overpay</div>
          <div className="v">{state.kpis.overpay}</div>
          <div className="s">proposed − consensus</div>
        </div>
        <div className="vx-kpi">
          <div className="k">Online now</div>
          <div className="v">{state.kpis.online}</div>
          <div className="s">
            {state.kpis.idle} idle · {state.kpis.sessions} sessions
          </div>
        </div>
      </div>

      <div className="vx-split">
        <section className="vx-card">
          <div className="vx-card-h">
            Mix
            <span>hold vs fleet</span>
          </div>
          <div className="vx-bars">
            <div className="vx-bar">
              <span>Hold</span>
              <i style={{ width: `${holdPct}%` }} className="bad" />
              <em>{state.kpis.hold}</em>
            </div>
            <div className="vx-bar">
              <span>Release</span>
              <i style={{ width: `${100 - holdPct}%` }} className="ok" />
              <em>{state.kpis.release}</em>
            </div>
            <div className="vx-bar">
              <span>Agents</span>
              <i style={{ width: `${healthyPct}%` }} className="ok" />
              <em>
                {state.kpis.agentsHealthy}/{state.kpis.agentsTotal}
              </em>
            </div>
            <div className="vx-bar">
              <span>Alerts</span>
              <i style={{ width: `${(state.kpis.alertsOpen / Math.max(state.alerts.length, 1)) * 100}%` }} className="bad" />
              <em>{state.kpis.alertsOpen}</em>
            </div>
          </div>
        </section>
        <section className="vx-card">
          <div className="vx-card-h">
            Desk freeze
            <span>{state.frozen ? "verifies blocked" : "desk accepting verifies"}</span>
          </div>
          <div className="vx-pad">
            <p className="vx-copy">
              Freeze stops Verify on the live PO desk without taking command offline. Use it for a suspected
              poisoned print or a tenant-wide hold.
            </p>
            {canDo(state, "desk.freeze") ? (
              <button
                type="button"
                className={state.frozen ? "vx-btn vx-btn-primary" : "vx-btn vx-btn-ghost"}
                disabled={busy}
                onClick={() =>
                  act({ type: "desk.freeze", frozen: !state.frozen }, state.frozen ? "Desk thawed" : "Desk frozen")
                }
              >
                {state.frozen ? "Thaw desk" : "Freeze desk"}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {tenant ? (
        <section className="vx-card">
          <div className="vx-card-h">
            Tenant
            <span>{tenant.id}</span>
          </div>
          <div className="vx-pad">
            <strong>{tenant.name}</strong>
            <p className="vx-copy">
              {tenant.plants}. Status {tenant.status}. {state.kpis.pendingInvites} pending invites.
            </p>
            {canDo(state, "tenants.write") ? (
              <form
                className="vx-inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(licence);
                  if (!Number.isFinite(n)) return;
                  void act({ type: "tenant.seats", id: tenant.id, seatsLicensed: n }, `Licensed seats → ${n}`);
                }}
              >
                <label htmlFor="lic">Licensed seats</label>
                <input id="lic" className="vx-input" value={licence} onChange={(e) => setLicence(e.target.value)} />
                <button className="vx-btn vx-btn-ghost vx-btn-sm" type="submit" disabled={busy}>
                  Save
                </button>
              </form>
            ) : (
              <p className="vx-copy">Licensed seats {tenant.seatsLicensed}.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="vx-card">
        <div className="vx-card-h">
          Live book
          <span>hold vs release</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="vx-table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Commodity</th>
                <th className="hide-sm">Buyer</th>
                <th>Gate</th>
              </tr>
            </thead>
            <tbody>
              {state.book.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.po}</td>
                  <td>
                    {r.title}
                    <div className="vx-sub">{r.supplier}</div>
                  </td>
                  <td className="hide-sm">{r.buyer}</td>
                  <td>
                    <span className={pillFor(r.hold ? "high" : "active")}>{r.hold ? "HOLD" : "RELEASE"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function MonitorPanel({
  state,
  query,
  setFocusUser,
  setPanel,
}: {
  state: AdminSnapshot;
  query: string;
  setFocusUser: (id: string | null) => void;
  setPanel: (p: Panel) => void;
}) {
  const people = [
    ...state.identities.map((i) => ({
      key: `id-${i.id}`,
      name: i.name,
      email: i.email,
      role: i.role,
      presence: i.presence,
      lastSeenAt: i.lastSeenAt,
      kind: "identity" as const,
      id: i.id,
    })),
    ...state.seats.map((s) => ({
      key: `seat-${s.id}`,
      name: s.name,
      email: s.email,
      role: s.role,
      presence: s.presence,
      lastSeenAt: s.lastSeenAt,
      kind: "seat" as const,
      id: s.id,
    })),
  ]
    .filter((p) => matchQ(query, p.name, p.email, p.role))
    .sort((a, b) => rankPresence(a.presence) - rankPresence(b.presence));

  const activity = state.activity.filter((e) => matchQ(query, e.actorName, e.actorEmail, e.kind, e.target, e.detail));

  return (
    <>
      <div className="vx-kpis">
        <div className="vx-kpi">
          <div className="k">Online</div>
          <div className="v">{state.kpis.online}</div>
          <div className="s">seen in the last 5 minutes</div>
        </div>
        <div className="vx-kpi">
          <div className="k">Idle</div>
          <div className="v">{state.kpis.idle}</div>
          <div className="s">5–30 minutes</div>
        </div>
        <div className="vx-kpi">
          <div className="k">Desk verifies</div>
          <div className="v">{state.kpis.verifies}</div>
          <div className="s">recorded on the analog desk</div>
        </div>
        <div className="vx-kpi">
          <div className="k">Open alerts</div>
          <div className="v">{state.kpis.alertsOpen}</div>
          <div className="s">command + gate</div>
        </div>
      </div>

      <div className="vx-split">
        <section className="vx-card">
          <div className="vx-card-h">
            Presence
            <span>{people.length} watched</span>
          </div>
          <div className="vx-watch">
            {people.length === 0 ? (
              <p className="vx-pad vx-copy">No people match.</p>
            ) : (
              people.slice(0, 24).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="vx-watch-row"
                  onClick={() => {
                    if (p.kind === "identity") {
                      setFocusUser(p.id);
                      setPanel("identities");
                    } else {
                      setPanel("seats");
                    }
                  }}
                >
                  <i className={`vx-dot ${p.presence}`} />
                  <div>
                    <strong>{p.name}</strong>
                    <div className="vx-sub">{p.email}</div>
                  </div>
                  <span className={pillFor(p.role)}>{p.role}</span>
                  <span className="mono hide-sm">{relTime(p.lastSeenAt)}</span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="vx-card">
          <div className="vx-card-h">
            Live activity
            <span>desk + command</span>
          </div>
          <div className="vx-watch">
            {activity.length === 0 ? (
              <p className="vx-pad vx-copy">No events yet. Desk login and verify land here.</p>
            ) : (
              activity.slice(0, 28).map((e) => (
                <div key={e.id} className="vx-watch-row static">
                  <span className={pillFor(kindTone(e.kind))}>{e.kind.replace(/^(desk|admin|system)\./, "")}</span>
                  <div>
                    <strong>{e.actorName || e.actorEmail}</strong>
                    <div className="vx-sub">
                      {e.target ? `${e.target} · ` : ""}
                      {e.detail}
                    </div>
                  </div>
                  <span className="mono hide-sm">{relTime(e.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function rankPresence(p: Presence) {
  if (p === "online") return 0;
  if (p === "idle") return 1;
  return 2;
}

function kindTone(kind: string) {
  if (kind.includes("verify") || kind.includes("writeback")) return "high";
  if (kind.includes("login")) return "online";
  if (kind.includes("revoke") || kind.includes("suspend")) return "critical";
  return "active";
}

function IdentitiesPanel({
  state,
  busy,
  act,
  query,
  focusUser,
  setFocusUser,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
  query: string;
  focusUser: string | null;
  setFocusUser: (id: string | null) => void;
}) {
  const write = canDo(state, "identities.write");
  const suspend = canDo(state, "users.suspend");
  const rows = state.identities.filter((i) => matchQ(query, i.name, i.email, i.role, i.status));
  const selected = rows.find((r) => r.id === focusUser) ?? null;

  return (
    <>
      <section className="vx-card">
        <div className="vx-card-h">
          Signed-in identities
          <span>{rows.length} from Google / X</span>
        </div>
        {rows.length === 0 ? (
          <p className="vx-pad vx-copy">
            No platform identities yet. The first Google sign-in from {OWNER_EMAIL} becomes owner and lands
            here with last-seen, role, and session control.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="hide-sm">Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === focusUser ? "sel" : ""}
                    onClick={() => setFocusUser(row.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className={`vx-dot ${row.presence}`} /> {row.name}
                      <div className="vx-sub">
                        {row.email}
                        {row.emailVerified ? " · verified" : " · unverified"}
                      </div>
                    </td>
                    <td>
                      {write && row.id !== state.actor.userId ? (
                        <select
                          className="vx-select tight"
                          value={row.role}
                          disabled={busy}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            act(
                              { type: "identity.role", userId: row.id, role: e.target.value },
                              `Role → ${e.target.value}`,
                            )
                          }
                        >
                          {ADMIN_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={pillFor(row.role)}>{row.role}</span>
                      )}
                    </td>
                    <td>
                      <span className={pillFor(row.status)}>{row.status}</span>
                    </td>
                    <td className="hide-sm mono">{relTime(row.lastSeenAt)}</td>
                    <td>
                      {suspend && row.id !== state.actor.userId ? (
                        <button
                          type="button"
                          className="vx-btn vx-btn-ghost vx-btn-sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void act(
                              {
                                type: "identity.status",
                                userId: row.id,
                                status: row.status === "suspended" ? "active" : "suspended",
                              },
                              row.status === "suspended" ? "Restored" : "Suspended",
                            );
                          }}
                        >
                          {row.status === "suspended" ? "Restore" : "Suspend"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected ? (
        <IdentityDetail state={state} row={selected} busy={busy} act={act} onClose={() => setFocusUser(null)} />
      ) : null}
    </>
  );
}

function IdentityDetail({
  state,
  row,
  busy,
  act,
  onClose,
}: {
  state: AdminSnapshot;
  row: IdentityRow;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(row.notes);
  useEffect(() => setNotes(row.notes), [row.id, row.notes]);
  const sessions = state.sessions.filter((s) => s.userId === row.id);
  const trail = state.activity.filter((e) => e.actorEmail.toLowerCase() === row.email.toLowerCase()).slice(0, 8);
  const write = canDo(state, "identities.write");
  const revoke = canDo(state, "sessions.revoke");

  return (
    <section className="vx-card">
      <div className="vx-card-h">
        {row.name}
        <button type="button" className="vx-btn vx-btn-ghost vx-btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="vx-pad">
        <p className="vx-copy">
          {row.email} · {row.role} · {row.presence} · {row.sessionCount} sessions · joined {relTime(row.createdAt)}
        </p>
        {write ? (
          <form
            className="vx-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ type: "identity.note", userId: row.id, notes }, "Note saved");
            }}
          >
            <textarea className="vx-input vx-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <button className="vx-btn vx-btn-ghost vx-btn-sm" type="submit" disabled={busy}>
              Save note
            </button>
          </form>
        ) : row.notes ? (
          <p className="vx-copy">{row.notes}</p>
        ) : null}
        {revoke && row.id !== state.actor.userId && sessions.length > 0 ? (
          <button
            type="button"
            className="vx-btn vx-btn-ghost vx-btn-sm"
            disabled={busy}
            onClick={() => act({ type: "session.revokeAll", userId: row.id }, "All sessions revoked")}
          >
            Revoke all sessions
          </button>
        ) : null}
        {trail.length ? (
          <div className="vx-watch" style={{ marginTop: "0.8rem" }}>
            {trail.map((e) => (
              <div key={e.id} className="vx-watch-row static">
                <span className="mono">{relTime(e.createdAt)}</span>
                <div>
                  {e.kind} {e.target}
                  <div className="vx-sub">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="vx-copy">No activity on this identity yet.</p>
        )}
      </div>
    </section>
  );
}

function SeatsPanel({
  state,
  busy,
  act,
  query,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
  query: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [plant, setPlant] = useState("");
  const [role, setRole] = useState("buyer");
  const write = canDo(state, "users.write");
  const seats = state.seats.filter((s) => matchQ(query, s.name, s.email, s.title, s.plant, s.role));
  const pending = state.invites.filter((i) => i.status === "pending");

  return (
    <>
      <section className="vx-card">
        <div className="vx-card-h">
          Tenant seats
          <span>
            {state.kpis.seatsActive} active · {pending.length} pending
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="vx-table">
            <thead>
              <tr>
                <th>Seat</th>
                <th>Role</th>
                <th>Status</th>
                <th className="hide-sm">Plant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {seats.map((s) => (
                <SeatRowView
                  key={s.id}
                  seat={s}
                  busy={busy}
                  write={write}
                  act={act}
                  canSuspend={canDo(state, "users.suspend")}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pending.length ? (
        <section className="vx-card">
          <div className="vx-card-h">
            Pending invites
            <span>Google sign-in inherits the role</span>
          </div>
          {pending.map((i) => (
            <div key={i.id} className="vx-policy">
              <div>
                <strong>{i.name || i.email}</strong>
                <div className="vx-sub">
                  {i.email} · {i.role} · by {i.invitedBy} · {relTime(i.createdAt)}
                </div>
              </div>
              {write ? (
                <button
                  type="button"
                  className="vx-btn vx-btn-ghost vx-btn-sm"
                  disabled={busy}
                  onClick={() => act({ type: "invite.revoke", id: i.id }, "Invite revoked")}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {write ? (
        <section className="vx-card">
          <div className="vx-card-h">
            Invite seat
            <span>Google sign-in later inherits this role</span>
          </div>
          <form
            className="vx-pad vx-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ type: "seat.invite", email, name, title, role, plant }, `Invited ${email}`).then(() => {
                setName("");
                setEmail("");
                setTitle("");
                setPlant("");
                setRole("buyer");
              });
            }}
          >
            <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              required
              type="email"
              placeholder="Corporate email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input placeholder="Plant" value={plant} onChange={(e) => setPlant(e.target.value)} />
            <select className="vx-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ADMIN_ROLES.filter((r) => r !== "owner").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button className="vx-btn vx-btn-primary" type="submit" disabled={busy}>
              Invite
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}

function SeatRowView({
  seat,
  busy,
  write,
  canSuspend,
  act,
}: {
  seat: SeatRow;
  busy: boolean;
  write: boolean;
  canSuspend: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  return (
    <tr>
      <td>
        <span className={`vx-dot ${seat.presence}`} /> {seat.name}
        <div className="vx-sub">{seat.email}</div>
      </td>
      <td>
        {write ? (
          <select
            className="vx-select tight"
            value={seat.role}
            disabled={busy}
            onChange={(e) => act({ type: "seat.role", id: seat.id, role: e.target.value }, `Seat role → ${e.target.value}`)}
          >
            {ADMIN_ROLES.filter((r) => r !== "owner").map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          seat.role
        )}
      </td>
      <td>
        <span className={pillFor(seat.status)}>{seat.status}</span>
      </td>
      <td className="hide-sm">{seat.plant}</td>
      <td>
        <div className="vx-actions">
          {canSuspend ? (
            <button
              type="button"
              className="vx-btn vx-btn-ghost vx-btn-sm"
              disabled={busy}
              onClick={() =>
                act(
                  {
                    type: "seat.status",
                    id: seat.id,
                    status: seat.status === "suspended" ? "active" : "suspended",
                  },
                  seat.status === "suspended" ? "Seat restored" : "Seat suspended",
                )
              }
            >
              {seat.status === "suspended" ? "Restore" : "Suspend"}
            </button>
          ) : null}
          {write && seat.status !== "active" ? (
            <button
              type="button"
              className="vx-btn vx-btn-ghost vx-btn-sm"
              disabled={busy}
              onClick={() => act({ type: "seat.remove", id: seat.id }, "Seat removed")}
            >
              Remove
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function AccessPanel({ state }: { state: AdminSnapshot }) {
  const roles = ADMIN_ROLES;
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Permission matrix
        <span>your role {state.actor.role}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="vx-table vx-matrix">
          <thead>
            <tr>
              <th>Capability</th>
              {roles.map((r) => (
                <th key={r}>{r.replace("_", " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACCESS_MATRIX.map((row) => (
              <tr key={row.perm}>
                <td>{row.label}</td>
                {roles.map((r) => (
                  <td key={r} className="mono">
                    {can(r, row.perm) ? "●" : "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AgentsPanel({
  state,
  busy,
  act,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  const control = canDo(state, "agents.control");
  const max = Math.max(...state.agents.map((a) => a.latencyMs), 1);
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Agent fleet
        <span>
          {state.kpis.agentsHealthy}/{state.kpis.agentsTotal} healthy
        </span>
      </div>
      <div className="vx-agent-list">
        {state.agents.map((a) => (
          <div key={a.id} className="vx-agent">
            <div>
              <strong>{a.id}</strong>
              <div className="vx-sub">{a.role}</div>
            </div>
            <div className="vx-bar slim">
              <i style={{ width: `${(a.latencyMs / max) * 100}%` }} className={a.status === "healthy" ? "ok" : "bad"} />
            </div>
            <span className="mono">{a.latencyMs}ms</span>
            <span className={pillFor(a.status)}>{a.status}</span>
            {control ? (
              <div className="vx-actions">
                <button
                  type="button"
                  className="vx-btn vx-btn-ghost vx-btn-sm"
                  disabled={busy}
                  onClick={() => act({ type: "agent.status", id: a.id, status: "restarted" }, `${a.id} restarted`)}
                >
                  Restart
                </button>
                <button
                  type="button"
                  className="vx-btn vx-btn-ghost vx-btn-sm"
                  disabled={busy}
                  onClick={() =>
                    act(
                      {
                        type: "agent.status",
                        id: a.id,
                        status: a.status === "healthy" ? "degraded" : "healthy",
                      },
                      `${a.id} ${a.status === "healthy" ? "degraded" : "healthy"}`,
                    )
                  }
                >
                  {a.status === "healthy" ? "Degrade" : "Heal"}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({
  state,
  busy,
  act,
  query,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
  query: string;
}) {
  const manage = canDo(state, "alerts.manage");
  const [filter, setFilter] = useState<"all" | "open" | "ack" | "closed">("open");
  const rows = state.alerts.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    return matchQ(query, a.title, a.detail, a.source, a.severity);
  });
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Alerts
        <span>{state.kpis.alertsOpen} open</span>
      </div>
      <div className="vx-pad vx-actions">
        {(["all", "open", "ack", "closed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "vx-btn vx-btn-primary vx-btn-sm" : "vx-btn vx-btn-ghost vx-btn-sm"}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {rows.map((a) => (
        <div key={a.id} className="alert">
          <span className={pillFor(a.severity)}>{a.severity}</span>
          <div>
            <strong>{a.title}</strong>
            <div className="vx-sub">
              {a.source} · {a.detail}
            </div>
          </div>
          {manage && a.status !== "closed" ? (
            <div className="vx-actions">
              {a.status === "open" ? (
                <button
                  type="button"
                  className="vx-btn vx-btn-ghost vx-btn-sm"
                  disabled={busy}
                  onClick={() => act({ type: "alert.set", id: a.id, status: "ack" }, "Alert acknowledged")}
                >
                  Ack
                </button>
              ) : null}
              <button
                type="button"
                className="vx-btn vx-btn-ghost vx-btn-sm"
                disabled={busy}
                onClick={() => act({ type: "alert.set", id: a.id, status: "closed" }, "Alert closed")}
              >
                Close
              </button>
            </div>
          ) : (
            <span className={pillFor(a.status)}>{a.status}</span>
          )}
        </div>
      ))}
    </section>
  );
}

function PoliciesPanel({
  state,
  busy,
  act,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  const write = canDo(state, "policies.write");
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(state.policies.map((p) => [p.key, p.value])),
  );
  useEffect(() => {
    setDraft(Object.fromEntries(state.policies.map((p) => [p.key, p.value])));
  }, [state.policies]);

  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Gate policies
        <span>MAD · CoV · PBFT · anomaly</span>
      </div>
      {state.policies.map((p) => (
        <div key={p.key} className="vx-policy">
          <div>
            <strong>{p.label}</strong>
            <div className="vx-sub">
              {p.description} · {relTime(p.updatedAt)} by {p.updatedBy}
            </div>
          </div>
          <div className="vx-policy-edit">
            <input
              className="vx-input"
              value={draft[p.key] ?? p.value}
              disabled={!write || busy}
              onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
            />
            <span className="mono">{p.unit}</span>
            {write ? (
              <button
                type="button"
                className="vx-btn vx-btn-ghost vx-btn-sm"
                disabled={busy || (draft[p.key] ?? p.value) === p.value}
                onClick={() => act({ type: "policy.set", key: p.key, value: draft[p.key] ?? p.value }, `${p.label} saved`)}
              >
                Save
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}

function SessionsPanel({
  state,
  busy,
  act,
  query,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
  query: string;
}) {
  const revoke = canDo(state, "sessions.revoke");
  const rows = state.sessions.filter((s) => matchQ(query, s.name, s.email, s.ip, s.userAgent));
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Active sessions
        <span>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="vx-pad vx-copy">No Better Auth sessions yet. They appear after Google / X sign-in.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="vx-table">
            <thead>
              <tr>
                <th>User</th>
                <th className="hide-sm">Client</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    <div className="vx-sub">{s.email}</div>
                  </td>
                  <td className="hide-sm">
                    {uaShort(s.userAgent)}
                    <div className="vx-sub">{s.ip || "no IP"}</div>
                  </td>
                  <td className="mono">{relTime(s.expiresAt)}</td>
                  <td>
                    {revoke ? (
                      <button
                        type="button"
                        className="vx-btn vx-btn-ghost vx-btn-sm"
                        disabled={busy}
                        onClick={() => act({ type: "session.revoke", id: s.id }, "Session revoked")}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FlagsPanel({
  state,
  busy,
  act,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  const write = canDo(state, "flags.write");
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Feature flags
        <span>runtime gates</span>
      </div>
      {state.flags.map((f) => (
        <div key={f.key} className="vx-policy">
          <div>
            <strong>{f.label}</strong>
            <div className="vx-sub">{f.description}</div>
          </div>
          <button
            type="button"
            className={f.enabled ? "vx-btn vx-btn-primary vx-btn-sm" : "vx-btn vx-btn-ghost vx-btn-sm"}
            disabled={!write || busy}
            onClick={() => act({ type: "flag.toggle", key: f.key, enabled: !f.enabled }, `${f.label} ${f.enabled ? "off" : "on"}`)}
          >
            {f.enabled ? "On" : "Off"}
          </button>
        </div>
      ))}
    </section>
  );
}

function SecurityPanel({
  state,
  busy,
  act,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  const write = canDo(state, "security.write");
  const [announce, setAnnounce] = useState(state.security.announce);
  const [days, setDays] = useState(state.security.sessionDays);
  useEffect(() => {
    setAnnounce(state.security.announce);
    setDays(state.security.sessionDays);
  }, [state.security.announce, state.security.sessionDays]);

  return (
    <>
      <section className="vx-card">
        <div className="vx-card-h">
          Security
          <span>owner {state.ownerEmail}</span>
        </div>
        <div className="vx-policy">
          <div>
            <strong>Require verified email</strong>
            <div className="vx-sub">Block unverified Google / X identities from command (owner always allowed).</div>
          </div>
          <button
            type="button"
            className={state.security.requireVerified ? "vx-btn vx-btn-primary vx-btn-sm" : "vx-btn vx-btn-ghost vx-btn-sm"}
            disabled={!write || busy}
            onClick={() =>
              act(
                { type: "security.set", key: "require_verified", value: state.security.requireVerified ? "false" : "true" },
                state.security.requireVerified ? "Verified email optional" : "Verified email required",
              )
            }
          >
            {state.security.requireVerified ? "On" : "Off"}
          </button>
        </div>
        <div className="vx-policy">
          <div>
            <strong>Maintenance mode</strong>
            <div className="vx-sub">Blocks the analog desk login. Command stays up for operators.</div>
          </div>
          <button
            type="button"
            className={state.security.maintenance ? "vx-btn vx-btn-primary vx-btn-sm" : "vx-btn vx-btn-ghost vx-btn-sm"}
            disabled={!write || busy}
            onClick={() =>
              act(
                { type: "security.set", key: "maintenance", value: state.security.maintenance ? "false" : "true" },
                state.security.maintenance ? "Maintenance off" : "Maintenance on",
              )
            }
          >
            {state.security.maintenance ? "On" : "Off"}
          </button>
        </div>
        {write ? (
          <form
            className="vx-pad vx-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ type: "security.set", key: "announce", value: announce }, "Banner saved");
            }}
          >
            <input
              className="vx-input"
              placeholder="Desk banner (shown to buyers)"
              value={announce}
              onChange={(e) => setAnnounce(e.target.value)}
            />
            <button className="vx-btn vx-btn-ghost" type="submit" disabled={busy}>
              Save banner
            </button>
          </form>
        ) : null}
        {write ? (
          <form
            className="vx-pad vx-inline"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ type: "security.set", key: "session_days", value: days }, `Session window ${days}d`);
            }}
          >
            <label htmlFor="sdays">Session window (days)</label>
            <input id="sdays" className="vx-input" value={days} onChange={(e) => setDays(e.target.value)} />
            <button className="vx-btn vx-btn-ghost vx-btn-sm" type="submit" disabled={busy}>
              Save
            </button>
          </form>
        ) : (
          <p className="vx-pad vx-copy">Session window {state.security.sessionDays} days.</p>
        )}
      </section>
    </>
  );
}

function KeysPanel({
  state,
  busy,
  act,
  setState,
  setNote,
  setBusy,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
  setState: (s: AdminSnapshot) => void;
  setNote: (n: string) => void;
  setBusy: (b: boolean) => void;
}) {
  const write = canDo(state, "keys.write");
  const [name, setName] = useState("desk-integration");
  const [role, setRole] = useState<"operator" | "auditor" | "viewer">("operator");
  const [secret, setSecret] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvent, setWhEvent] = useState("alert.open");

  async function issue() {
    setBusy(true);
    try {
      const next = await createAdminKey({ data: { name, role } });
      if (!next.state.ok) {
        setNote(next.state.actor.reason || "Denied");
      } else {
        setState(next.state);
        setSecret(next.secret);
        setNote("API key issued — copy it now");
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Key issue failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="vx-card">
        <div className="vx-card-h">
          API keys
          <span>{state.kpis.keysActive} active · secret shown once</span>
        </div>
        {secret ? (
          <div className="vx-pad">
            <p className="vx-copy">Copy this key now. Command will not show it again.</p>
            <code className="vx-secret">{secret}</code>
          </div>
        ) : null}
        {state.keys.length === 0 ? (
          <p className="vx-pad vx-copy">No keys issued. Use these for SAP analog writeback and evidence export jobs.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="vx-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      {k.name}
                      <div className="vx-sub">{k.createdBy}</div>
                    </td>
                    <td className="mono">{k.prefix}…</td>
                    <td>{k.role}</td>
                    <td>
                      <span className={pillFor(k.status)}>{k.status}</span>
                    </td>
                    <td>
                      {write && k.status === "active" ? (
                        <button
                          type="button"
                          className="vx-btn vx-btn-ghost vx-btn-sm"
                          disabled={busy}
                          onClick={() => act({ type: "key.revoke", id: k.id }, "Key revoked")}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {write ? (
          <form
            className="vx-pad vx-form"
            onSubmit={(e) => {
              e.preventDefault();
              void issue();
            }}
          >
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name" />
            <select className="vx-select" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="operator">operator</option>
              <option value="auditor">auditor</option>
              <option value="viewer">viewer</option>
            </select>
            <button className="vx-btn vx-btn-primary" type="submit" disabled={busy}>
              Issue key
            </button>
          </form>
        ) : null}
      </section>

      <section className="vx-card">
        <div className="vx-card-h">
          Webhooks
          <span>outbound event sinks</span>
        </div>
        {state.webhooks.map((w) => (
          <div key={w.id} className="vx-policy">
            <div>
              <strong>{w.event}</strong>
              <div className="vx-sub">
                {w.url} · {w.status}
              </div>
            </div>
            {write && w.status === "active" ? (
              <button
                type="button"
                className="vx-btn vx-btn-ghost vx-btn-sm"
                disabled={busy}
                onClick={() => act({ type: "webhook.revoke", id: w.id }, "Webhook revoked")}
              >
                Revoke
              </button>
            ) : (
              <span className={pillFor(w.status)}>{w.status}</span>
            )}
          </div>
        ))}
        {write ? (
          <form
            className="vx-pad vx-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ type: "webhook.create", url: whUrl, event: whEvent }, "Webhook registered").then(() =>
                setWhUrl(""),
              );
            }}
          >
            <input required type="url" placeholder="https://…" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} />
            <select className="vx-select" value={whEvent} onChange={(e) => setWhEvent(e.target.value)}>
              <option value="alert.open">alert.open</option>
              <option value="desk.verify">desk.verify</option>
              <option value="desk.freeze">desk.freeze</option>
              <option value="identity.suspend">identity.suspend</option>
            </select>
            <button className="vx-btn vx-btn-ghost" type="submit" disabled={busy}>
              Add webhook
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}

function AuditPanel({ state, query }: { state: AdminSnapshot; query: string }) {
  const rows = state.audit.filter((a) => matchQ(query, a.actorEmail, a.action, a.target, a.detail));
  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Audit log
        <span>append-only</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="vx-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th className="hide-sm">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="mono">{relTime(a.createdAt)}</td>
                <td>{a.actorEmail}</td>
                <td className="mono">{a.action}</td>
                <td className="hide-sm">
                  {a.target} {a.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BackupPanel({
  state,
  busy,
  act,
}: {
  state: AdminSnapshot;
  busy: boolean;
  act: (a: AdminAction, n: string) => Promise<void>;
}) {
  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          product: "VerityX Sovereign Command",
          exportedAt: new Date().toISOString(),
          owner: state.ownerEmail,
          actor: state.actor.email,
          frozen: state.frozen,
          security: state.security,
          tenants: state.tenants,
          seats: state.seats,
          identities: state.identities.map(({ image: _i, ...rest }) => rest),
          agents: state.agents,
          policies: state.policies,
          alerts: state.alerts,
          flags: state.flags,
          invites: state.invites,
          audit: state.audit,
          activity: state.activity,
          keys: state.keys,
          webhooks: state.webhooks,
          book: state.book,
        },
        null,
        2,
      ),
    [state],
  );

  function download(kind: "json" | "csv") {
    if (kind === "csv") {
      const header = "id,name,email,title,plant,role,status,lastSeenAt";
      const lines = state.seats.map((s) =>
        [s.id, s.name, s.email, s.title, s.plant, s.role, s.status, s.lastSeenAt ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      );
      const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verityx-seats-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verityx-command-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onRestore(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      void act({ type: "backup.restore", payload: text }, "Backup restored");
    };
    reader.readAsText(file);
  }

  return (
    <section className="vx-card">
      <div className="vx-card-h">
        Backup
        <span>JSON snapshot of command state</span>
      </div>
      <div className="vx-pad">
        <p className="vx-copy">
          Export seats, identities, policies, flags, alerts, activity, and the audit trail. Restore applies
          policies, flags, agent health, freeze, and security knobs — never identities or sessions.
        </p>
        {canDo(state, "backup.export") ? (
          <div className="vx-actions">
            <button type="button" className="vx-btn vx-btn-primary" onClick={() => download("json")}>
              Download backup
            </button>
            <button type="button" className="vx-btn vx-btn-ghost" onClick={() => download("csv")}>
              Seats CSV
            </button>
          </div>
        ) : (
          <p className="vx-copy">Your role cannot export backups.</p>
        )}
        {canDo(state, "backup.restore") ? (
          <label className="vx-file">
            Restore JSON
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => onRestore(e.target.files?.[0])}
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
