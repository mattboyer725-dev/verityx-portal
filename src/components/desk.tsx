import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AGENTS,
  BUYER,
  SCENARIOS,
  consensusAgent,
  money,
  type PipelineResult,
  type Scenario,
} from "@/lib/engine";
import { getDeskControls, recordDeskEvent } from "@/lib/desk-ops";
import { CORE_SHA, CORE_VERSION } from "@/lib/core-meta";
import { DeskTour, tourSeen } from "@/components/desk-tour";
import { ShouldCostPanel } from "@/components/should-cost-panel";
import { DriftBanner, PriceHistoryPanel } from "@/components/price-history-panel";
import { postSapWriteback, runLiveVerify } from "@/lib/live-api";
import { deskKeys, useDeskTape } from "@/lib/desk-live";
import { useQueryClient } from "@tanstack/react-query";
import { issueDeskToken } from "@/lib/oidc";
import { sapPatchPo, seatFromOidc } from "@/lib/desk-adapters";
import type { LiveBundle } from "@/lib/feeds";
import { scaleByReference } from "@/lib/feeds";
import { VxMark } from "@/components/vx-mark";
import { Spark } from "@/components/spark";
import { SiteNav } from "@/components/site-nav";
import { SurfaceLoop } from "@/components/surface-loop";
import { SESSION_KEY, type DeskSession } from "@/lib/session";
import { openCommandPalette } from "@/lib/nav";
import { deskTabForProve, proveLabel, type DeskTab } from "@/lib/competition";

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

/**
 * A figure is shown only when its own source reports LIVE (same-day, e.g. ECB
 * FX) or REFERENCE (a dated, licensed average shown with its period). A
 * fallback constant is never presented as a print.
 */
function feedLive(snap: { health?: Record<string, string> } | null | undefined, k: string) {
  const h = snap?.health?.[k];
  return h === "LIVE" || h === "REFERENCE";
}

function asOfUtc(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toISOString().slice(11, 16)} UTC`;
}

function chg(n: number) {
  const sign = n >= 0 ? "+" : "";
  return (
    <span className={n >= 0 ? "up" : "dn"}>
      {sign}
      {n.toFixed(2)}%
    </span>
  );
}

export function LoginGate({ onEnter, prove }: { onEnter: () => void; prove?: string }) {
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
  }, []);

  async function enterSeat() {
    if (maintenance) {
      setErr("Desk is in maintenance. Platform command is still available.");
      return;
    }
    setBusy(true);
    setErr("");
    const remote = await seatFromOidc(BUYER.email, BUYER.password).catch(() => null);
    const local = remote || (await issueDeskToken(BUYER.email, BUYER.password));
    if (!local) {
      setBusy(false);
      setErr("Seat could not be signed. Try again.");
      return;
    }
    const session: DeskSession = {
      email: BUYER.email,
      at: Date.now(),
      access_token: local.access_token,
      iss: String(local.claims.iss || ""),
      sub: String(local.claims.sub || ""),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    void recordDeskEvent({
      data: { kind: "desk.login", target: "desk", detail: "Elena Hartmann opened the magnetics desk." },
    }).catch(() => undefined);
    onEnter();
  }

  return (
    <div className="gate">
      <div className="gate-nav">
        <SiteNav tone="linen" />
        <SurfaceLoop className="mt-3" />
      </div>
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
            Siemens Gamesa magnetics. Licensed reference prices (World Bank, USGS) and ECB FX, an SAP OData analog tenant, GLEIF and UN
            screens, a lot custody ledger — each packet sealed by a 27-voter PBFT round and an HMAC-signed Local Core
            ledger.
          </p>
          <div className="gate-tape" aria-label="Market tape">
            {feedLive(tape, "metals") && tape?.metals ? (
              <>
                <span className="tape-chip" title={tape.metals.source}>
                  Cu {tape.metals.copperUsdMt.toFixed(0)} USD/t · World Bank {tape.metals.periodLabel}
                </span>
                <span className="tape-chip" title={tape.metals.source}>
                  Al {tape.metals.aluminiumUsdMt.toFixed(0)} USD/t
                </span>
              </>
            ) : null}
            {feedLive(tape, "rareEarths") && tape?.rareEarths ? (
              <span className="tape-chip" title={tape.rareEarths.source}>
                NdPr oxide {tape.rareEarths.ndprUsdKg.toFixed(0)} USD/kg · USGS {tape.rareEarths.periodLabel}
              </span>
            ) : null}
            {feedLive(tape, "fx") && tape?.fx ? (
              <span className="tape-chip" title={`${tape.fx.source} Reference rate ${tape.fx.date}.`}>
                EUR/USD {tape.fx.eurUsd.toFixed(4)} · ECB {tape.fx.date}
              </span>
            ) : null}
            {tape?.core ? (
              <span className="tape-chip">
                Core {tape.core.ok ? "HMAC ok" : "break"} · {tape.core.leaf_count} leaves
              </span>
            ) : null}
            {(() => {
              const down = [
                !feedLive(tape, "metals") && "Cu/Al",
                !feedLive(tape, "rareEarths") && "NdPr",
                !feedLive(tape, "fx") && "ECB",
              ].filter(Boolean);
              return down.length ? <span className="tape-chip tape-chip-standby">{down.join(" · ")} standby</span> : null;
            })()}
            {tape?.health?.fx === "LIVE" ? (
              <span className="tape-chip tape-chip-live">FX live · {asOfUtc(tape.fetchedAt)}</span>
            ) : null}
            <a className="tape-chip" href="/sources">
              Sources &amp; licences
            </a>
          </div>
        </div>
        <p className="hint">SAP OData · Ariba · World Bank · USGS · ECB · GLEIF · UN · Lot custody · PBFT 27 · Local Core HMAC · OIDC</p>
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
          <h2>{prove ? "Prove it on the tape" : "Continue as Elena"}</h2>
          <p>
            {prove
              ? `${proveLabel(prove) || "The analog"} is live on this host. One click as Elena opens that tab on the magnetics PO.`
              : "Head of Magnetics Procurement. One click issues an RS256 seat token and opens the live PO tape."}
          </p>
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
            <Link to="/">Hub</Link>
            {" · "}
            <Link to="/field">Field</Link>
            {" · "}
            <Link to="/work">Customer Zero OS</Link>
            {" · "}
            <Link to="/core">Local Core</Link>
            {" · "}
            <Link to="/admin">Owner command</Link>
          </p>
        </div>
      </section>
      <section className="gate-more" aria-labelledby="pilot-h">
        <div className="gate-pilot">
          <div className="vx-label">Pilot</div>
          <h2 id="pilot-h">
            $2,500 · 72 hours
            <span>one live PO file</span>
          </h2>
          <p>
            Send one magnetics, wind or rare-earth purchase order. Within 72 hours you get a sealed evidence packet and an
            advisory decision on it — and nothing changes in your systems unless a person approves it.
          </p>
          <Link className="vx-btn vx-btn-primary" to="/pilot">
            Start a pilot
          </Link>
        </div>
        <ol className="gate-steps">
          <li>
            <span className="n">01</span>
            <strong>Ingest</strong>
            <span>The PO and its RFQ from SAP OData and Ariba, priced against licensed reference averages (World Bank, USGS), ECB FX, and your own benchmark when you add it.</span>
          </li>
          <li>
            <span className="n">02</span>
            <strong>Consensus</strong>
            <span>Outlier prints dropped (MAD); agreement scored by coefficient of variation. VERIFIED at 0.80 or better. Quoted price compared with a low / mid / high should-cost band.</span>
          </li>
          <li>
            <span className="n">03</span>
            <strong>Screen</strong>
            <span>Supplier checked against GLEIF and the UN Security Council consolidated list; lots traced on the custody ledger.</span>
          </li>
          <li>
            <span className="n">04</span>
            <strong>Seal</strong>
            <span>A 27-voter PBFT round (quorum 19) commits the packet; Local Core chains it with a server-held HMAC key and issues an Ed25519-signed receipt.</span>
          </li>
          <li>
            <span className="n">05</span>
            <strong>Decide</strong>
            <span>An advisory HOLD or RELEASE. A BLOCK never auto-applies — SAP changes only when a person approves.</span>
          </li>
          <li>
            <span className="n">06</span>
            <strong>Prove</strong>
            <span>
              Anyone can check the receipt at <Link className="underline underline-offset-2" to="/verify">/verify</Link> — no account, no trust in us. Quick price
              check on any PO at <Link className="underline underline-offset-2" to="/check">/check</Link>.
            </span>
          </li>
        </ol>
      </section>
    </div>
  );
}

export function Desk({ onLeave, prove }: { onLeave: () => void; prove?: string }) {
  const [desk, setDesk] = useState<"all" | Scenario["desk"]>("all");
  const [flag, setFlag] = useState<"all" | "hold" | "clear">("all");
  const [selected, setSelected] = useState(SCENARIOS[0].id);
  const [running, setRunning] = useState(false);
  const [packet, setPacket] = useState<PipelineResult | null>(null);
  const [note, setNote] = useState(prove ? `Field · ${proveLabel(prove) || prove}` : "Select a PO and verify");
  const [wb, setWb] = useState("");
  const [frozen, setFrozen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  // First visit to the desk opens the tour once; a deep link from the field (prove) does not.
  useEffect(() => {
    if (prove || tourSeen()) return;
    const t = window.setTimeout(() => setTourOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [prove]);
  const tapeQ = useDeskTape();
  const live = (tapeQ.data as LiveSnap | undefined) ?? null;
  const qc = useQueryClient();
  const [tab, setTab] = useState<DeskTab>(() => deskTabForProve(prove));
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!prove) return;
    setTab(deskTabForProve(prove));
    setNote(`Field · ${proveLabel(prove) || prove}`);
  }, [prove]);

  useEffect(() => {
    getDeskControls()
      .then((c) => {
        setFrozen(c.frozen);
        setAnnounce(c.announce);
      })
      .catch(() => setFrozen(false));
  }, []);

  const sapMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of live?.sap || []) m[p.PurchaseOrder] = p.ReleaseStatus;
    return m;
  }, [live]);

  const previews = useMemo(
    () =>
      SCENARIOS.map((s) => {
        const scaled = s.observations.map((v) => scaleByReference(v, s.refSeries, s.refBaseline));
        const proposed = scaleByReference(s.proposed, s.refSeries, s.refBaseline);
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
      const http = await sapPatchPo(current.s.po, action).catch(() => null);
      const rec = http
        ? http.writeback
        : (await postSapWriteback({ data: { id: current.s.id, action } })).rec;
      setWb(`${rec.action} · ${rec.doc}`);
      setNote(`SAP OData PATCH ${rec.action} on ${rec.po}`);
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
    setNote("INGEST · SAP OData + Ariba + reference prices…");
    try {
      const result = await clientBudget(runLiveVerify({ data: { id } }), 12000);
      setPacket(result);
      setNote(result.message);
      void qc.invalidateQueries({ queryKey: deskKeys.tape });
      void recordDeskEvent({
        data: { kind: "desk.verify", target: id, detail: result.message.slice(0, 280) },
      }).catch(() => undefined);
    } catch (err) {
      // No client-side fallback: the seal is signed by the server key only.
      setRunning(false);
      const msg = err instanceof Error ? err.message : "";
      setNote(
        msg === "timeout"
          ? "VERIFY · the server did not answer in 12s — nothing was sealed. Retry."
          : `VERIFY · not sealed: ${msg.slice(0, 160) || "the server refused"}. Nothing was recorded.`,
      );
      return;
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
            shouldCost: packet.shouldCost,
            receipt: (() => {
              const j = (packet as PipelineResult & { receiptJson?: string | null }).receiptJson;
              return j ? JSON.parse(j) : null;
            })(),
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
  const eco = view?.screen.ecovadis || live?.ecovadis?.[current.s.supplier];
  const pre = view?.screen.prewave || live?.prewave?.[current.s.supplier];
  const rapid = view?.screen.rapid || live?.rapid?.[current.s.supplier];
  const sap = view?.sap;
  const ariba = view?.ariba;
  const cluster = view?.seal.cluster;
  const cuHist = live?.metals?.copperHistory?.map((p) => p.value).slice(-18) || [];
  const ndprHist = live?.rareEarths?.spark || [];

  return (
    <div className="vx-shell">
      <DeskTour open={tourOpen} onClose={() => setTourOpen(false)} />
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
          <span className="idp-chip">OIDC RS256</span>
          <div className="vx-avatar">EH</div>
          <div>
            {BUYER.name}
            <small>{BUYER.title}</small>
          </div>
          <Link className="vx-btn vx-btn-ghost" to="/">
            Hub
          </Link>
          <Link className="vx-btn vx-btn-ghost" to="/field">
            Field
          </Link>
          <Link className="vx-btn vx-btn-ghost" to="/core">
            Core
          </Link>
          <button className="vx-btn vx-btn-ghost" type="button" onClick={() => setTourOpen(true)}>
            Tour
          </button>
          <button className="vx-btn vx-btn-ghost" type="button" onClick={() => openCommandPalette()}>
            Menu
          </button>
          <button className="vx-btn vx-btn-ghost" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="ticker" aria-label="Live tape" data-tour="tape">
        {feedLive(live, "metals") && live?.metals ? (
          <span title={live.metals.source}>
            Cu <b>{live.metals.copperUsdMt.toFixed(0)}</b> USD/t {chg(live.metals.copperChangePct)} · World Bank {live.metals.periodLabel}
          </span>
        ) : (
          <span>Cu/Al reference standby</span>
        )}
        {feedLive(live, "metals") && live?.metals ? (
          <span title={live.metals.source}>
            Al <b>{live.metals.aluminiumUsdMt.toFixed(0)}</b> USD/t {chg(live.metals.aluminiumChangePct)}
          </span>
        ) : null}
        {feedLive(live, "rareEarths") && live?.rareEarths ? (
          <span title={`${live.rareEarths.source} Context only — enter your licensed benchmark on a check for a verdict.`}>
            NdPr oxide <b>{live.rareEarths.ndprUsdKg.toFixed(0)}</b> USD/kg · USGS {live.rareEarths.periodLabel}
          </span>
        ) : (
          <span>NdPr reference standby</span>
        )}
        {feedLive(live, "rareEarths") && live?.rareEarths ? (
          <span title={live.rareEarths.source}>
            Dy oxide <b>{live.rareEarths.dyUsdKg.toFixed(0)}</b> USD/kg · USGS {live.rareEarths.periodLabel}
          </span>
        ) : null}
        {live?.health?.fx === "LIVE" && live?.fx ? (
          <span title={`${live.fx.source} Reference rate ${live.fx.date}.`}>
            EUR/USD <b>{live.fx.eurUsd.toFixed(4)}</b> · ECB {live.fx.date}
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
          <DriftBanner />
          <div className="vx-kpis" style={{ marginBottom: "0.9rem" }} data-tour="kpis">
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

          <section className="vx-card" data-tour="pos">
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
          <div className="inspect-stats" data-tour="stats">
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
            <button className="vx-btn vx-btn-primary" type="button" data-tour="verify" disabled={running || frozen} onClick={() => verify(current.s.id)}>
              {frozen ? "Frozen" : running ? "Sealing…" : "Verify PO"}
            </button>
            <button className="vx-btn vx-btn-ghost" type="button" data-tour="sap" onClick={() => writeback("HOLD")}>
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

          <div className="chip-row" data-tour="evidence">
            {(
              [
                ["pipe", "Pipeline"],
                ["sap", "SAP / Ariba"],
                ["mkt", "Prices"],
                ["cost", "Should-cost"],
                ["screen", "Screens"],
                ["prov", "Custody"],
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
                  ["02", "ORACLE", view?.oracle.metals ? "Reference + ECB" : `${current.s.observations.length} prints`],
                  ["03", "CONSENSUS", view ? view.consensus.verdict : current.c.verdict],
                  ["04", "RISK", view ? view.risk.action : current.hold ? "HOLD_PO" : "RELEASE_PO"],
                  ["05", "PROVENANCE", `${tiers.length}-tier DPP`],
                  ["06", "SCREEN", view ? `${view.screen.alerts.length} alerts` : "pre-screen"],
                  ["07", "COMPLIANCE", view ? view.compliance.gate : "awaiting"],
                  ["08", "SEAL", view ? `${view.seal.pbft.commitOk}/27` : "awaiting"],
                  ["09", "LEDGER", view ? `HMAC ${view.ledger.depth}` : live?.core ? `HMAC ${live.core.leaf_count}` : "GENESIS"],
                  ["10", "EVIDENCE", view ? "ready" : "awaiting"],
                  ["11", "AUTH", "OIDC RS256"],
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
                <span className="mono">/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV</span>
              </div>
              <div className="screen-row">
                <span>GET</span>
                <span className="mono">A_PurchaseOrder('{sap?.PurchaseOrder || current.s.po}')</span>
              </div>
              <div className="screen-row">
                <span>CSRF / ETag</span>
                <span className="mono">X-CSRF-Token · If-Match</span>
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

          {tab === "cost" ? (
            <ShouldCostPanel
              key={current.s.id}
              commodity={current.s.commodity}
              quoteTotal={(view?.scenario ?? current.s).proposed}
              quoteCurrency={current.s.currency}
              tape={live}
            />
          ) : null}
          {tab === "mkt" ? (
            <div>
              <PriceHistoryPanel />
              <div className="mkt-hero">
                <div className="score-card">
                  <div className="k">Copper · World Bank</div>
                  <div className="v">{feedLive(live, "metals") && live?.metals ? live.metals.copperUsdMt.toFixed(0) : "standby"}</div>
                  <div className="s">USD/t · {live?.metals?.periodLabel || "monthly avg"}</div>
                  <Spark values={cuHist} />
                </div>
                <div className="score-card">
                  <div className="k">NdPr oxide · USGS</div>
                  <div className="v">{feedLive(live, "rareEarths") && live?.rareEarths ? live.rareEarths.ndprUsdKg.toFixed(0) : "standby"}</div>
                  <div className="s">USD/kg · {live?.rareEarths?.periodLabel || "annual avg"} · context only</div>
                  <Spark values={ndprHist} />
                </div>
              </div>
              {view?.oracle.prints.map((p) => (
                <div className={`obs ${p.outlier ? "out" : ""}`} key={p.source + p.value}>
                  <span>{p.source}</span>
                  <span>{money(p.value)}</span>
                </div>
              ))}
              {feedLive(live, "metals") && live?.metals ? (
                <>
                  <div className="screen-row">
                    <span>Aluminium · World Bank</span>
                    <span className="mono">{live.metals.aluminiumUsdMt.toFixed(0)} USD/t · {live.metals.periodLabel}</span>
                  </div>
                  <div className="screen-row">
                    <span>Dy oxide · USGS</span>
                    <span className="mono">
                      {live.rareEarths.dyUsdKg.toFixed(0)} USD/kg · {live.rareEarths.periodLabel}
                    </span>
                  </div>
                </>
              ) : null}
              {live?.health?.fx === "LIVE" && live?.fx ? (
                <div className="screen-row">
                  <span>ECB reference rate</span>
                  <span className="mono">EUR/USD {live.fx.eurUsd.toFixed(4)} · {live.fx.date}</span>
                </div>
              ) : null}
              <p className="mkt-attrib">
                {live?.metals?.source} {live?.rareEarths?.source} {live?.fx?.source} Averages, not spot quotes. Rare-earth
                averages are context only — enter your own licensed benchmark on a check for a verdict.{" "}
                <a href="/sources">Sources &amp; licences</a>
              </p>
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
              <div className="screen-row">
                <span>ESG scorecard</span>
                <span className="mono">/ecovadis/api/v2/scorecards</span>
              </div>
              <div className="screen-row">
                <span>Media risk</span>
                <span className="mono">/prewave/api/v1/risks</span>
              </div>
              <div className="score-grid">
                <div className="score-card">
                  <div className="k">ESG</div>
                  <div className="v">{eco ? `${eco.score}` : "—"}</div>
                  <div className="s">{eco ? `${eco.medal} medal · NACE 27` : "Verify to score"}</div>
                </div>
                <div className="score-card">
                  <div className="k">Media</div>
                  <div className="v">{pre ? pre.heat ?? pre.risk : "—"}</div>
                  <div className="s">{pre ? `${pre.level} heat on the PO` : "live news RSS"}</div>
                </div>
                <div className="score-card">
                  <div className="k">Fin. health</div>
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
              {pre ? (
                <div className="theme-bar">
                  <span>heat</span>
                  <div className="track">
                    <div className="fill" style={{ width: `${pre.heat ?? pre.risk}%` }} />
                  </div>
                  <span className="mono">{pre.level}</span>
                </div>
              ) : null}
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
              {(pre?.incidents?.length
                ? pre.incidents.map((i) => ({ key: i.url || i.title, cat: i.category, text: i.title }))
                : (pre?.headlines || []).map((h) => ({ key: h, cat: "NEWS" as const, text: h }))
              ).map((row) => (
                <div className="alert" key={row.key}>
                  <span className="pill pill-mid">{row.cat}</span>
                  <span>{row.text}</span>
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
                  <div className="hash">Lot {view.provenance.circulorLot}</div>
                  <div className="hash">Batch passport {view.provenance.minespiderBatch}</div>
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
                <span className="mono">{view?.ledger.version || live?.core?.version || CORE_VERSION}</span>
              </div>
              <div className="screen-row">
                <span>Git SHA</span>
                <span className="mono">{(live?.core?.sha || CORE_SHA).slice(0, 7)}</span>
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
          Cu/Al <strong>{live?.health.metals || "…"}</strong>
        </span>
        <span>
          NdPr/Dy <strong>{live?.health.rareEarths || "…"}</strong>
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
          Core <strong>{live?.core?.ok ? `HMAC ${CORE_VERSION}` : "…"}</strong>
        </span>
        <span>
          OIDC <strong>RS256</strong>
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
                  prices: { metals: view.oracle.metals, rareEarths: view.oracle.rareEarths, fx: view.oracle.fx },
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
