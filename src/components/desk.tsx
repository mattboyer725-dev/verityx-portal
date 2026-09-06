import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AGENTS,
  BUYER,
  SCENARIOS,
  consensusAgent,
  money,
  runPipeline,
  type PipelineResult,
  type Scenario,
} from "@/lib/engine";
import { getDeskControls, recordDeskEvent } from "@/lib/admin-api";
import { oidcToken, postSapWriteback, runLiveVerify } from "@/lib/live-api";
import { deskKeys, useDeskTape } from "@/lib/desk-live";
import { useQueryClient } from "@tanstack/react-query";
import { issueDeskToken } from "@/lib/oidc";
import type { LiveBundle } from "@/lib/feeds";
import { VxMark } from "@/components/vx-mark";
import { Spark } from "@/components/spark";
import { SESSION_KEY, type DeskSession } from "@/lib/session";
import { OWNER_EMAIL } from "@/lib/admin";

function clientBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

function pillClass(v: string) {
  const s = v.toUpperCase();
  if (
    ["VERIFIED", "CLEAR", "LOW", "PASS", "RELEASE_PO", "RELEASE", "POSITIVE", "GOLD", "PLATINUM", "COMMITTED", "OPEN"].includes(
      s,
    )
  )
    return "pill pill-ok";
  if (["DISPUTED", "HIGH", "CRITICAL", "HOLD_PO", "WATCH", "HOLD", "NEGATIVE", "OPAQUE", "BYZANTINE"].includes(s))
    return "pill pill-bad";
  return "pill pill-mid";
}

type LiveSnap = LiveBundle & {
  sapCount?: number;
  sap?: { PurchaseOrder: string; ReleaseStatus: string; ETag?: string; LastChangeDateTime?: string }[];
  writebacks?: { po: string; action: string; doc: string; ts: string }[];
  core?: {
    ok: boolean;
    merkle_root: string;
    leaf_count: number;
    repo?: string;
    version?: string;
    sha?: string;
    doctor?: { overall: string; sha?: string } | null;
    events?: { id: string; type: string; hash: string; mac: string; ts: string }[];
  };
};

function chg(n: number) {
  const sign = n >= 0 ? "+" : "";
  return (
    <span className={n >= 0 ? "up" : "dn"}>
      {sign}
      {n.toFixed(2)}%
    </span>
  );
}

export function LoginGate({ onEnter }: { onEnter: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [announce, setAnnounce] = useState("");
  const tapeQ = useDeskTape();
  const tape = tapeQ.data ?? null;

  useEffect(() => {
    getDeskControls()
      .then((c) => {
        setMaintenance(c.maintenance);
        setAnnounce(c.announce);
      })
      .catch(() => setMaintenance(false));
    clientBudget(getLiveSnapshot(), 7000)
      .then(setTape)
      .catch(() => setTape(null));
  }, []);

  async function enterSeat() {
    if (maintenance) {
      setErr("Desk is in maintenance. Platform command is still available.");
      return;
    }
    setBusy(true);
    setErr("");
    let access = "";
    let iss = "";
    let sub = "";
    try {
      const tok = await Promise.race([
        oidcToken({ data: { seat: true } }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      if (tok && tok.ok && "access_token" in tok) {
        access = tok.access_token;
        iss = tok.claims.iss;
        sub = tok.claims.sub;
      }
    } catch {
      /* local issuer */
    }
    if (!access) {
      const local = await issueDeskToken(BUYER.email, BUYER.password);
      if (!local) {
        setBusy(false);
        setErr("Seat could not be signed. Try again.");
        return;
      }
      access = local.access_token;
      iss = String(local.claims.iss || "");
      sub = String(local.claims.sub || "");
    }
    const session: DeskSession = {
      email: BUYER.email,
      at: Date.now(),
      access_token: access,
      iss,
      sub,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    void recordDeskEvent({
      data: { kind: "desk.login", target: "desk", detail: "Elena Hartmann opened the magnetics desk." },
    }).catch(() => undefined);
    onEnter();
  }

  return (
    <div className="gate">
      <section className="gate-left">
        <div>
          <div className="vx-brand">
            <VxMark />
            <div className="vx-word">
              <strong>VERITYX</strong>
              <span>Sovereign desk</span>
            </div>
          </div>
          <h1>One provable version of the purchase order.</h1>
          <p className="lede">
            Siemens Gamesa magnetics. Live LME cash, SAP writeback, EcoVadis screens, Circulor custody, sealed by a
            27-node PBFT cluster and an HMAC local-core ledger.
          </p>
          <div className="gate-tape">
            {tape?.lme ? <span className="tape-chip">LME Cu {tape.lme.copperUsdMt.toFixed(0)} USD/mt</span> : null}
            {tape?.lme ? <span className="tape-chip">LME Al {tape.lme.aluminiumUsdMt.toFixed(0)} USD/mt</span> : null}
            {tape?.argus ? <span className="tape-chip">Argus NdPr {tape.argus.ndprUsdKg.toFixed(1)} USD/kg</span> : null}
            {tape?.fx ? <span className="tape-chip">USD/EUR {tape.fx.usdEur.toFixed(4)}</span> : null}
            {tape?.core ? (
              <span className="tape-chip">
                Core {tape.core.ok ? "HMAC ok" : "break"} · {tape.core.leaf_count} leaves
              </span>
            ) : null}
            {!tape ? <span className="tape-chip">Connecting LME · Argus · ECB…</span> : null}
          </div>
        </div>
        <p className="hint">SAP · Ariba · LME · Argus · EcoVadis · Circulor · PBFT 27 · Local Core HMAC · Okta</p>
      </section>
      <section className="gate-right">
        <div className="login-card">
          <div className="vx-brand">
            <VxMark />
            <div className="vx-word">
              <strong>DESK</strong>
              <span>Siemens Gamesa · magnetics</span>
            </div>
          </div>
          <h2>Continue as Elena</h2>
          <p>Head of Magnetics Procurement. One click issues an RS256 seat token and opens the live PO tape.</p>
          <div className="seat-card">
            <div className="vx-avatar">EH</div>
            <div className="who">
              <strong>{BUYER.name}</strong>
              <span>{BUYER.title}</span>
              <span className="mono">{BUYER.email}</span>
            </div>
          </div>
          {announce ? <p className="login-err">{announce}</p> : null}
          {err ? <p className="login-err">{err}</p> : null}
          <button
            className="vx-btn vx-btn-primary"
            type="button"
            style={{ width: "100%", marginTop: "0.4rem" }}
            disabled={maintenance || busy}
            onClick={() => void enterSeat()}
          >
            {maintenance ? "Desk in maintenance" : busy ? "Signing seat…" : "Enter the desk"}
          </button>
          <p className="hint">
            <Link to="/admin">Owner command · {OWNER_EMAIL}</Link>
            {" · "}
            <Link to="/work">Customer Zero OS</Link>
            {" · "}
            <Link to="/core">Local Core</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export function Desk({ onLeave }: { onLeave: () => void }) {
  const [desk, setDesk] = useState<"all" | Scenario["desk"]>("all");
  const [flag, setFlag] = useState<"all" | "hold" | "clear">("all");
  const [selected, setSelected] = useState(SCENARIOS[0].id);
  const [running, setRunning] = useState(false);
  const [packet, setPacket] = useState<PipelineResult | null>(null);
  const [note, setNote] = useState("Select a PO and verify");
  const [wb, setWb] = useState("");
  const [frozen, setFrozen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const tapeQ = useDeskTape();
  const live = (tapeQ.data as LiveSnap | undefined) ?? null;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pipe" | "sap" | "mkt" | "screen" | "prov" | "seal" | "core">("pipe");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    getDeskControls()
      .then((c) => {
        setFrozen(c.frozen);
        setAnnounce(c.announce);
      })
      .catch(() => setFrozen(false));
    clientBudget(getLiveSnapshot(), 7000)
      .then(setLive)
      .catch(() => setLive(null));
    const t = setInterval(() => {
      clientBudget(getLiveSnapshot(), 7000)
        .then(setLive)
        .catch(() => undefined);
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const sapMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of live?.sap || []) m[p.PurchaseOrder] = p.ReleaseStatus;
    return m;
  }, [live]);

  const previews = useMemo(
    () =>
      SCENARIOS.map((s) => {
        const scaled = live
          ? s.observations.map((v) => {
              const q = live.quotes[s.oracleSymbol];
              if (!q || !s.baselinePx) return v;
              return Math.round(v * (q.price / s.baselinePx));
            })
          : s.observations;
        const proposed = live
          ? (() => {
              const q = live.quotes[s.oracleSymbol];
              if (!q || !s.baselinePx) return s.proposed;
              return Math.round(s.proposed * (q.price / s.baselinePx));
            })()
          : s.proposed;
        const c = consensusAgent(scaled);
        const anomaly = c.market ? ((proposed - c.market) / c.market) * 100 : 0;
        const sapStatus = sapMap[s.po];
        const hold =
          sapStatus === "HOLD" || sapStatus === "RELEASE"
            ? sapStatus === "HOLD"
            : anomaly >= 8 || c.verdict !== "VERIFIED" || s.screens.exportPermit === "WATCH";
        return { s: { ...s, proposed, observations: scaled }, c, anomaly, hold, sapStatus: sapStatus || "OPEN" };
      }),
    [live, sapMap],
  );

  const rows = previews.filter((r) => {
    if (desk !== "all" && r.s.desk !== desk) return false;
    if (flag === "hold" && !r.hold) return false;
    if (flag === "clear" && r.hold) return false;
    return true;
  });

  const current = previews.find((r) => r.s.id === selected) || previews[0];
  const view = packet && packet.scenario.id === selected ? packet : null;

  const kpis = useMemo(() => {
    const hold = previews.filter((p) => p.hold).length;
    const savings = previews.reduce((a, p) => a + Math.max(0, p.s.proposed - p.c.market), 0);
    const conf = previews.reduce((a, p) => a + p.c.confidence, 0) / previews.length;
    return { hold, savings, conf, n: previews.length };
  }, [previews]);

  async function writeback(action: "HOLD" | "RELEASE") {
    try {
      const res = await postSapWriteback({ data: { id: current.s.id, action } });
      setWb(`${res.rec.action} · ${res.rec.doc}`);
      setNote(`SAP OData PATCH ${res.rec.action} on ${res.rec.po}`);
      qc.setQueryData(deskKeys.tape, (prev: LiveSnap | undefined) => {
        if (!prev) return prev;
        const sap = (prev.sap || []).map((p) =>
          p.PurchaseOrder === current.s.po ? { ...p, ReleaseStatus: action } : p,
        );
        return { ...prev, sap };
      });
    } catch {
      setNote("SAP writeback failed");
    }
    void recordDeskEvent({
      data: { kind: "desk.writeback", target: current.s.id, detail: `${action} posted on ${current.s.po}` },
    }).catch(() => undefined);
  }

  async function verify(id: string) {
    if (frozen) {
      setNote("COMMAND · desk is frozen by platform owner");
      return;
    }
    setRunning(true);
    setNote("INGEST · SAP OData + Ariba + LME cash…");
    try {
      const result = await clientBudget(runLiveVerify({ data: { id } }), 12000);
      setPacket(result);
      setNote(result.message);
      void qc.invalidateQueries({ queryKey: deskKeys.tape });
      void recordDeskEvent({
        data: { kind: "desk.verify", target: id, detail: result.message.slice(0, 280) },
      }).catch(() => undefined);
    } catch {
      const result = await runPipeline(id, live || undefined);
      setPacket(result);
      setNote(result.message);
    }
    setRunning(false);
    setTab("pipe");
  }

  function exportPacket() {
    if (!packet) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            message: packet.message,
            po: packet.scenario.po,
            verdict: packet.consensus.verdict,
            market: Math.round(packet.consensus.market),
            proposed: packet.scenario.proposed,
            sap: packet.sap,
            ariba: packet.ariba,
            risk: packet.risk,
            seal: { hash: packet.seal.hash, quorum: packet.seal.quorum, committed: packet.seal.pbft.committed },
            provenance: packet.provenance,
            screen: {
              ecovadis: packet.screen.ecovadis,
              prewave: packet.screen.prewave,
              rapid: packet.screen.rapid,
              gleif: packet.screen.gleif,
            },
            ledger: {
              repo: packet.ledger.repo,
              depth: packet.ledger.depth,
              intact: packet.ledger.intact,
              merkleRoot: packet.ledger.merkleRoot,
              tip: packet.ledger.tip,
            },
            merkle: packet.merkle,
            auth: packet.auth,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${packet.scenario.id}-verityx-packet.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote(`EVIDENCE · ${packet.scenario.id}-verityx-packet.json`);
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    onLeave();
  }

  const screens = view?.screen.screens ?? current.s.screens;
  const alerts = view?.screen.alerts ?? [];
  const tiers = view?.provenance.tiers ?? current.s.tiers;
  const eco = view?.screen.ecovadis;
  const pre = view?.screen.prewave;
  const rapid = view?.screen.rapid;
  const sap = view?.sap;
  const ariba = view?.ariba;
  const cluster = view?.seal.cluster;
  const cuHist = live?.lme?.copperHistory?.map((p) => p.cash).slice(0, 18).reverse() || [];
  const ndprHist = live?.argus?.spark || [];

  return (
    <div className="vx-shell">
      <header className="vx-top">
        <div className="vx-brand">
          <VxMark />
          <div className="vx-word">
            <strong>VERITYX</strong>
            <span>Magnetics · Siemens Gamesa</span>
          </div>
        </div>
        <div className={frozen ? "vx-live vx-live-hold" : "vx-live"}>{frozen ? "DESK FROZEN" : "LIVE · PBFT 27"}</div>
        {announce ? <div className="vx-banner">{announce}</div> : null}
        <div className="vx-user">
          <span className="idp-chip">Okta RS256</span>
          <div className="vx-avatar">EH</div>
          <div>
            {BUYER.name}
            <small>{BUYER.title}</small>
          </div>
          <Link className="vx-btn vx-btn-ghost" to="/admin">
            Command
          </Link>
          <Link className="vx-btn vx-btn-ghost" to="/work">
            OS
          </Link>
          <button className="vx-btn vx-btn-ghost" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="ticker" aria-label="Live tape">
        {live?.lme ? (
          <span>
            LME Cu cash <b>{live.lme.copperUsdMt.toFixed(0)}</b> USD/mt {chg(live.lme.copperChangePct)}
          </span>
        ) : (
          <span>Connecting LME…</span>
        )}
        {live?.lme ? (
          <span>
            LME Al cash <b>{live.lme.aluminiumUsdMt.toFixed(0)}</b> USD/mt {chg(live.lme.aluminiumChangePct)}
          </span>
        ) : null}
        {live?.lme?.copper3mUsdMt ? (
          <span>
            Cu 3M <b>{live.lme.copper3mUsdMt.toFixed(0)}</b>
          </span>
        ) : null}
        {live?.argus ? (
          <span>
            Argus NdPr <b>{live.argus.ndprUsdKg.toFixed(1)}</b> USD/kg {chg(live.argus.ndprChangePct)}
          </span>
        ) : null}
        {live?.argus ? (
          <span>
            Argus Dy <b>{live.argus.dyUsdKg.toFixed(0)}</b> USD/kg
          </span>
        ) : null}
        {live?.fx ? (
          <span>
            USD/EUR <b>{live.fx.usdEur.toFixed(4)}</b>
          </span>
        ) : null}
        {live?.quotes["SIE.DE"] ? (
          <span>
            SIE.DE <b>{live.quotes["SIE.DE"].price.toFixed(2)}</b>
          </span>
        ) : null}
        {live?.core ? (
          <span>
            Core <b>{live.core.ok ? "HMAC" : "BREAK"}</b> {live.core.leaf_count} leaves
          </span>
        ) : null}
      </div>

      <div className="desk-grid">
        <nav className="desk-nav" aria-label="Desks">
          <div className="vx-label">Desks</div>
          {(
            [
              ["all", "All POs"],
              ["metals", "Metals"],
              ["energy", "Power electronics"],
              ["composites", "Composites"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`vx-side-btn ${desk === id && flag === "all" ? "on" : ""}`}
              type="button"
              onClick={() => {
                setDesk(id);
                setFlag("all");
              }}
            >
              {label}
              <span className="mono">
                {id === "all" ? previews.length : previews.filter((p) => p.s.desk === id).length}
              </span>
            </button>
          ))}
          <div className="vx-label">Flags</div>
          <button
            className={`vx-side-btn ${flag === "hold" ? "on" : ""}`}
            type="button"
            onClick={() => {
              setFlag("hold");
              setDesk("all");
            }}
          >
            Hold / disputed
            <span className="mono">{kpis.hold}</span>
          </button>
          <button
            className={`vx-side-btn ${flag === "clear" ? "on" : ""}`}
            type="button"
            onClick={() => {
              setFlag("clear");
              setDesk("all");
            }}
          >
            Release
            <span className="mono">{kpis.n - kpis.hold}</span>
          </button>
          <div className="vx-label">Agents</div>
          {AGENTS.map((a) => (
            <div className="vx-side-btn" key={a.id} style={{ cursor: "default" }}>
              {a.id}
              <span className="pill pill-ok">LIVE</span>
            </div>
          ))}
        </nav>

        <section className="desk-list">
          <div className="vx-kpis" style={{ marginBottom: "0.9rem" }}>
            <div className="vx-kpi">
              <div className="k">POs</div>
              <div className="v">{kpis.n}</div>
              <div className="s">SAP S/4 · Ariba</div>
            </div>
            <div className="vx-kpi">
              <div className="k">Hold</div>
              <div className="v">{kpis.hold}</div>
              <div className="s">anomaly or SAP HOLD</div>
            </div>
            <div className="vx-kpi">
              <div className="k">Overpay</div>
              <div className="v">{money(kpis.savings)}</div>
              <div className="s">proposed − consensus</div>
            </div>
            <div className="vx-kpi">
              <div className="k">Confidence</div>
              <div className="v">{kpis.conf.toFixed(3)}</div>
              <div className="s">MAD-filtered CoV</div>
            </div>
          </div>

          <div className="chip-row vx-mobile-rail">
            {(
              [
                ["all", "All"],
                ["metals", "Metals"],
                ["energy", "Power"],
                ["composites", "Composites"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={`chip ${desk === id && flag === "all" ? "on" : ""}`}
                type="button"
                onClick={() => {
                  setDesk(id);
                  setFlag("all");
                }}
              >
                {label}
              </button>
            ))}
            <button
              className={`chip ${flag === "hold" ? "on" : ""}`}
              type="button"
              onClick={() => {
                setFlag("hold");
                setDesk("all");
              }}
            >
              Hold
            </button>
          </div>

          <section className="vx-card">
            <div className="vx-card-h">
              Purchase orders
              <span>{wb || note}</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="vx-table">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Commodity</th>
                    <th className="hide-sm">Supplier</th>
                    <th>Proposed</th>
                    <th>Market</th>
                    <th>SAP</th>
                    <th>Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.s.id}
                      className={r.s.id === selected ? "sel" : ""}
                      onClick={() => {
                        setSelected(r.s.id);
                        setPacket((p) => (p && p.scenario.id === r.s.id ? p : null));
                      }}
                    >
                      <td className="mono">{r.s.po}</td>
                      <td>
                        {r.s.title}
                        <div style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>{r.s.id}</div>
                      </td>
                      <td className="hide-sm">{r.s.supplier}</td>
                      <td className="mono">{money(r.s.proposed)}</td>
                      <td className="mono">{money(r.c.market)}</td>
                      <td>
                        <span className={pillClass(r.sapStatus)}>{r.sapStatus}</span>
                      </td>
                      <td>
                        <span className={pillClass(r.hold ? "HOLD_PO" : "RELEASE_PO")}>{r.hold ? "HOLD" : "RELEASE"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="desk-inspect">
          <div className="inspect-kicker">
            {current.s.plant} · due {current.s.due} · SAP {current.s.po}
          </div>
          <h2 className="inspect-title">{current.s.title}</h2>
          <p className="inspect-sub">
            {current.s.supplier} · {current.s.commodity} · buyer {current.s.buyer}
          </p>
          <div className="inspect-stats">
            <div>
              <div className="l">Proposed</div>
              <div className="n">{money((view?.scenario ?? current.s).proposed)}</div>
            </div>
            <div>
              <div className="l">Consensus</div>
              <div className="n">{money(view?.consensus.market ?? current.c.market)}</div>
            </div>
            <div>
              <div className="l">Anomaly</div>
              <div className="n">{(view?.risk.anomalyPct ?? current.anomaly).toFixed(1)}%</div>
            </div>
          </div>
          <div className="vx-actions" style={{ marginBottom: "1rem" }}>
            <button className="vx-btn vx-btn-primary" type="button" disabled={running || frozen} onClick={() => verify(current.s.id)}>
              {frozen ? "Frozen" : running ? "Sealing…" : "Verify PO"}
            </button>
            <button className="vx-btn vx-btn-ghost" type="button" onClick={() => writeback("HOLD")}>
              Hold in SAP
            </button>
            <button className="vx-btn vx-btn-ghost" type="button" onClick={() => writeback("RELEASE")}>
              Release in SAP
            </button>
            <button className="vx-btn vx-btn-ghost" type="button" onClick={exportPacket} disabled={!view}>
              Export
            </button>
            <button className="vx-btn vx-btn-ghost" type="button" onClick={() => setDrawer(true)} disabled={!view}>
              Packet
            </button>
          </div>

          <div className="chip-row">
            {(
              [
                ["pipe", "Pipeline"],
                ["sap", "SAP / Ariba"],
                ["mkt", "LME / Argus"],
                ["screen", "Screens"],
                ["prov", "Circulor"],
                ["seal", "PBFT 27"],
                ["core", "Local Core"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={`chip ${tab === id ? "on" : ""}`} type="button" onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "pipe" ? (
            <div className="vx-pipe">
              {(
                [
                  ["01", "INGEST", view ? view.ingest.po : current.s.po],
                  ["02", "ORACLE", view?.oracle.lme ? "LME cash" : `${current.s.observations.length} prints`],
                  ["03", "CONSENSUS", view ? view.consensus.verdict : current.c.verdict],
                  ["04", "RISK", view ? view.risk.action : current.hold ? "HOLD_PO" : "RELEASE_PO"],
                  ["05", "PROVENANCE", `${tiers.length}-tier DPP`],
                  ["06", "SCREEN", view ? `${view.screen.alerts.length} alerts` : "pre-screen"],
                  ["07", "COMPLIANCE", view ? view.compliance.gate : "awaiting"],
                  ["08", "SEAL", view ? `${view.seal.pbft.commitOk}/27` : "awaiting"],
                  ["09", "LEDGER", view ? `HMAC ${view.ledger.depth}` : live?.core ? `HMAC ${live.core.leaf_count}` : "GENESIS"],
                  ["10", "EVIDENCE", view ? "ready" : "awaiting"],
                  ["11", "AUTH", "Okta RS256"],
                  ["12", "OS", view?.advisory ? view.advisory.proposedAction : "advisory"],
                ] as const
              ).map(([n, t, d]) => (
                <div key={t} className={`vx-step ${view ? "on" : ""}`}>
                  <div className="n">{n}</div>
                  <div className="t">{t}</div>
                  <div className="d">{d}</div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "sap" ? (
            <div>
              <div className="screen-row">
                <span>OData</span>
                <span className="mono">API_PURCHASEORDER_PROCESS_SRV</span>
              </div>
              <div className="screen-row">
                <span>GET</span>
                <span className="mono">A_PurchaseOrder('{sap?.PurchaseOrder || current.s.po}')</span>
              </div>
              <div className="screen-row">
                <span>Company / org</span>
                <span className="mono">
                  {sap?.CompanyCode || "SG01"} · {sap?.PurchasingOrganization || "SGRE"}
                </span>
              </div>
              <div className="screen-row">
                <span>Release</span>
                <span className={pillClass(sapMap[current.s.po] || sap?.ReleaseStatus || current.sapStatus)}>
                  {sapMap[current.s.po] || sap?.ReleaseStatus || current.sapStatus}
                </span>
              </div>
              <div className="screen-row">
                <span>ETag</span>
                <span className="mono">{sap?.ETag || live?.sap?.find((p) => p.PurchaseOrder === current.s.po)?.ETag || "—"}</span>
              </div>
              <div className="screen-row">
                <span>Ariba RFQ</span>
                <span className="mono">{ariba?.eventId || `RFQ-${current.s.po.slice(-6)}`}</span>
              </div>
              <div className="screen-row">
                <span>Ariba status</span>
                <span>{ariba?.status || "Open"}</span>
              </div>
              {wb ? (
                <div className="screen-row">
                  <span>Last BAPI</span>
                  <span className="mono">{wb}</span>
                </div>
              ) : null}
              <p className="hash" style={{ marginTop: 12 }}>
                PATCH /sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('{current.s.po}')
              </p>
            </div>
          ) : null}

          {tab === "mkt" ? (
            <div>
              <div className="mkt-hero">
                <div className="score-card">
                  <div className="k">LME Cu cash</div>
                  <div className="v">{live?.lme ? live.lme.copperUsdMt.toFixed(0) : "—"}</div>
                  <div className="s">{live?.lme?.settlementDate || "Westmetall"} · USD/mt</div>
                  <Spark values={cuHist} />
                </div>
                <div className="score-card">
                  <div className="k">Argus NdPr</div>
                  <div className="v">{live?.argus ? live.argus.ndprUsdKg.toFixed(1) : "—"}</div>
                  <div className="s">USD/kg · listed REE tape</div>
                  <Spark values={ndprHist} />
                </div>
              </div>
              {view?.oracle.prints.map((p) => (
                <div className={`obs ${p.outlier ? "out" : ""}`} key={p.source + p.value}>
                  <span>{p.source}</span>
                  <span>{money(p.value)}</span>
                </div>
              ))}
              {live?.lme ? (
                <>
                  <div className="screen-row">
                    <span>LME Al cash</span>
                    <span className="mono">{live.lme.aluminiumUsdMt.toFixed(0)} USD/mt</span>
                  </div>
                  <div className="screen-row">
                    <span>Cu 3-month</span>
                    <span className="mono">{live.lme.copper3mUsdMt.toFixed(0)}</span>
                  </div>
                  {live.lme.fredCopperUsdMt ? (
                    <div className="screen-row">
                      <span>FRED PCOPPUSDM</span>
                      <span className="mono">{live.lme.fredCopperUsdMt.toFixed(0)}</span>
                    </div>
                  ) : null}
                  {live.lme.comexHgLb ? (
                    <div className="screen-row">
                      <span>COMEX HG</span>
                      <span className="mono">{live.lme.comexHgLb.toFixed(3)} USD/lb</span>
                    </div>
                  ) : null}
                </>
              ) : null}
              {live?.fx ? (
                <div className="screen-row">
                  <span>ECB FX</span>
                  <span className="mono">USD/EUR {live.fx.usdEur.toFixed(4)}</span>
                </div>
              ) : null}
              <div className="vx-label">Feed bus</div>
              {(live?.traces || []).slice(0, 8).map((t) => (
                <div className="trace-row" key={t.ts + t.url}>
                  <b>{t.status}</b>
                  <span>{t.url.replace(/^https?:\/\//, "").slice(0, 42)}</span>
                  <span>{t.ms}ms</span>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "screen" ? (
            <div>
              <div className="score-grid">
                <div className="score-card">
                  <div className="k">EcoVadis</div>
                  <div className="v">{eco ? `${eco.score}` : "—"}</div>
                  <div className="s">{eco ? `${eco.medal} medal` : "Verify to score"}</div>
                </div>
                <div className="score-card">
                  <div className="k">Prewave</div>
                  <div className="v">{pre ? pre.risk : "—"}</div>
                  <div className="s">{pre ? `${pre.level} media risk` : "live news RSS"}</div>
                </div>
                <div className="score-card">
                  <div className="k">RapidRatings</div>
                  <div className="v">{rapid ? rapid.fhr : "—"}</div>
                  <div className="s">{rapid ? `${rapid.outlook} FHR` : "listed tape"}</div>
                </div>
                <div className="score-card">
                  <div className="k">GLEIF</div>
                  <div className="v">{view?.screen.gleif?.country || "—"}</div>
                  <div className="s">{view?.screen.gleif?.lei?.slice(0, 12) || "identity"}</div>
                </div>
              </div>
              {eco
                ? (Object.entries(eco.themes) as [string, number][]).map(([k, v]) => (
                    <div className="theme-bar" key={k}>
                      <span>{k}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${v}%` }} />
                      </div>
                      <span className="mono">{v}</span>
                    </div>
                  ))
                : null}
              {(["exportPermit", "esg", "financial", "dualUse"] as const).map((k) => (
                <div className="screen-row" key={k}>
                  <span>{k}</span>
                  <span className={pillClass(screens[k])}>{screens[k]}</span>
                </div>
              ))}
              {view?.screen.sanctions ? (
                <div className="screen-row">
                  <span>UN list</span>
                  <span className={pillClass(view.screen.sanctions.matched ? "WATCH" : "CLEAR")}>
                    {view.screen.sanctions.matched ? "HIT" : "CLEAR"}
                  </span>
                </div>
              ) : null}
              {pre?.headlines?.map((h) => (
                <div className="alert" key={h}>
                  <span className="pill pill-mid">NEWS</span>
                  <span>{h}</span>
                </div>
              ))}
              {alerts.map((a) => (
                <div className="alert" key={a.type + a.text}>
                  <span className="pill pill-mid">{a.type}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "prov" ? (
            <div>
              {view ? (
                <div className="dpp-card">
                  <div className="k">EU Digital Product Passport</div>
                  <div className="hash" style={{ marginTop: 6 }}>
                    {view.provenance.dppId}
                  </div>
                  <div className="hash">GS1 {view.provenance.gs1}</div>
                  <div className="hash">Circulor {view.provenance.circulorLot}</div>
                  <div className="hash">Minespider {view.provenance.minespiderBatch}</div>
                </div>
              ) : null}
              <div className="tier-map">
                {tiers.map((t) => (
                  <div className="tier" key={`${t.tier}-${t.name}`}>
                    <div className="idx">T{t.tier}</div>
                    <div>
                      <div className="who">{t.name}</div>
                      <div className="meta">
                        {t.role} · {t.evidence}
                      </div>
                      <div className="geo-line">
                        {t.lat.toFixed(3)}, {t.lng.toFixed(3)}
                      </div>
                    </div>
                    <div className="cc">{t.country}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "seal" ? (
            <div>
              {view ? (
                <>
                  <div className="inspect-kicker">
                    {view.seal.quorum} · {view.seal.finality} · primary {view.seal.pbft.primary}
                  </div>
                  <div className="pbft-grid" title="27 validator commits">
                    {(
                      cluster ||
                      view.seal.pbft.commits.map((v) => ({
                        node: v.node,
                        iata: v.node.slice(0, 3).toUpperCase(),
                        status: v.accepted ? "COMMITTED" : "BYZANTINE",
                      }))
                    ).map((n) => (
                      <div
                        key={n.node}
                        className={`pbft-node ${n.status === "BYZANTINE" ? "byz" : n.status === "LAG" ? "lag" : ""}`}
                        title={`${n.node} ${n.status}`}
                      >
                        {n.iata}
                      </div>
                    ))}
                  </div>
                  <div className="screen-row">
                    <span>Prepare</span>
                    <span className="mono">
                      {view.seal.pbft.prepareOk}/{view.seal.pbft.n}
                    </span>
                  </div>
                  <div className="screen-row">
                    <span>Commit</span>
                    <span className="mono">
                      {view.seal.pbft.commitOk}/{view.seal.pbft.n}
                    </span>
                  </div>
                  <div className="screen-row">
                    <span>Byzantine</span>
                    <span className="mono">{view.seal.pbft.byzantine.join(" · ") || "none"}</span>
                  </div>
                  <div className="hash" style={{ marginTop: 12 }}>
                    {view.seal.hash}
                  </div>
                  <div className="hash">merkle {view.merkle.root}</div>
                  <div className="hash">MAC {view.seal.pbft.prePrepare.mac.slice(0, 24)}</div>
                  <div className="hash">iss {view.auth.issuer}</div>
                </>
              ) : (
                <p className="vx-copy">Verify to run the 27-node PBFT round across Hamburg → Luxembourg.</p>
              )}
            </div>
          ) : null}

          {tab === "core" ? (
            <div>
              <div className="screen-row">
                <span>Repo</span>
                <span className="mono">verityx-local-core</span>
              </div>
              <div className="screen-row">
                <span>Version</span>
                <span className="mono">{view?.ledger.version || live?.core?.version || "1.6.0"}</span>
              </div>
              <div className="screen-row">
                <span>Git SHA</span>
                <span className="mono">{(live?.core?.sha || "319af22").slice(0, 7)}</span>
              </div>
              <div className="screen-row">
                <span>Doctor</span>
                <span className={pillClass(live?.core?.doctor?.overall === "ok" || view?.ledger.intact ? "PASS" : "WATCH")}>
                  {live?.core?.doctor?.overall === "ok" || view?.ledger.intact ? "OK" : "PENDING"}
                </span>
              </div>
              <div className="screen-row">
                <span>HMAC chain</span>
                <span className={pillClass(view?.ledger.intact || live?.core?.ok ? "PASS" : "WATCH")}>
                  {view?.ledger.intact || live?.core?.ok ? "INTACT" : "PENDING"}
                </span>
              </div>
              <div className="screen-row">
                <span>Leaves</span>
                <span className="mono">{view?.ledger.depth ?? live?.core?.leaf_count ?? 0}</span>
              </div>
              <div className="hash" style={{ marginTop: 10 }}>
                root {view?.ledger.merkleRoot || live?.core?.merkle_root || "—"}
              </div>
              <p className="hint">HMAC-SHA256 over canonical JSON · Merkle H(0x00‖leaf) / H(0x01‖L‖R) — bit-identical to Python merkle.py.</p>
              {view?.merkle.inclusion && "proof" in view.merkle.inclusion && view.merkle.inclusion.ok ? (
                <>
                  <div className="vx-label">Inclusion proof</div>
                  <div className="screen-row">
                    <span>Index</span>
                    <span className="mono">{view.merkle.inclusion.index}</span>
                  </div>
                  <div className="hash">leaf {view.merkle.inclusion.leaf}</div>
                  {view.merkle.inclusion.proof.map((p, i) => (
                    <div className="hash" key={i}>
                      {p.side} {p.sibling.slice(0, 24)}
                    </div>
                  ))}
                </>
              ) : (
                <p className="hint">Verify a PO to append an HMAC-signed artifact and emit a Merkle proof.</p>
              )}
              {(view?.ledger.events || live?.core?.events || []).slice(-5).map((e) => (
                <div className="obs" key={e.id}>
                  <span>{e.type}</span>
                  <span>{e.hash.slice(0, 12)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <footer className="vx-status">
        <span>
          LME <strong>{live?.health.lme || "…"}</strong>
        </span>
        <span>
          Argus <strong>{live?.health.argus || "…"}</strong>
        </span>
        <span>
          SAP <strong>{live?.health.sap || "LIVE"}</strong>
        </span>
        <span>
          GLEIF <strong>{live?.health.gleif || "…"}</strong>
        </span>
        <span>
          UN <strong>{live?.health.sanctions || "…"}</strong>
        </span>
        <span>
          FX <strong>{live?.health.fx || "…"}</strong>
        </span>
        <span>
          PBFT <strong>27 / quorum 19</strong>
        </span>
        <span>
          Core <strong>{live?.core?.ok ? "HMAC 1.6.0" : "…"}</strong>
        </span>
        <span>
          Okta <strong>RS256</strong>
        </span>
      </footer>

      <div className={`drawer ${drawer ? "open" : ""}`} onClick={() => setDrawer(false)}>
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Evidence packet">
          <div className="vx-card-h" style={{ paddingLeft: 0 }}>
            Evidence packet
            <button className="vx-btn vx-btn-ghost" type="button" onClick={() => setDrawer(false)}>
              Close
            </button>
          </div>
          {view ? (
            <pre className="hash" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
              {JSON.stringify(
                {
                  message: view.message,
                  po: view.scenario.po,
                  verdict: view.consensus.verdict,
                  sap: view.sap?.ReleaseStatus,
                  ariba: view.ariba?.eventId,
                  dpp: view.provenance.dppId,
                  lme: view.oracle.lme,
                  ecovadis: view.screen.ecovadis,
                  prewave: view.screen.prewave,
                  rapid: view.screen.rapid,
                  gleif: view.screen.gleif,
                  seal: view.seal.hash,
                  committed: view.seal.pbft.committed,
                  core: {
                    merkle: view.merkle.root,
                    intact: view.ledger.intact,
                    depth: view.ledger.depth,
                    inclusion: view.merkle.inclusion,
                  },
                  issuer: view.auth.issuer,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <p>Verify a PO to seal a packet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
