const EMAIL = 'elena.hartmann@siemensgamesa.com';
const PASS = 'demo2026';
const KEY = 'vx-desk-session';
const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const pill = (v) => {
  if (['VERIFIED','CLEAR','LOW','PASS','RELEASE_PO','RELEASE'].includes(v)) return 'pill ok';
  if (['DISPUTED','HIGH','CRITICAL','HOLD_PO','HOLD','WATCH'].includes(v)) return 'pill bad';
  return 'pill mid';
};

const state = { rows: [], selected: null, packet: null, desk: 'all', flag: 'all', agents: [], notes: [] };

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function hasSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}').email === EMAIL; } catch { return false; }
}

function showLogin() {
  $('app').hidden = true;
  $('login').hidden = false;
}
function showDesk() {
  $('login').hidden = true;
  $('app').hidden = false;
  boot();
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim().toLowerCase();
  const password = $('password').value;
  try {
    const out = await api('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!out.ok) throw new Error('bad');
    localStorage.setItem(KEY, JSON.stringify({ email, at: Date.now() }));
    showDesk();
  } catch {
    if (email === EMAIL && password === PASS) {
      localStorage.setItem(KEY, JSON.stringify({ email, at: Date.now() }));
      showDesk();
      return;
    }
    $('loginErr').textContent = 'Credentials rejected. Use the Siemens Gamesa demo seat.';
  }
});

$('signOut').addEventListener('click', () => { localStorage.removeItem(KEY); showLogin(); });
$('closeDrawer').addEventListener('click', () => $('drawer').classList.remove('open'));
$('drawer').addEventListener('click', (e) => { if (e.target === $('drawer')) $('drawer').classList.remove('open'); });
$('btnPacket').addEventListener('click', () => { if (state.packet) $('drawer').classList.add('open'); });
$('btnExport').addEventListener('click', exportPacket);
$('btnVerify').addEventListener('click', () => verify(state.selected));
$('btnHold').addEventListener('click', () => writeback('HOLD'));
$('btnRelease').addEventListener('click', () => writeback('RELEASE'));

document.querySelectorAll('[data-desk]').forEach((b) => b.addEventListener('click', () => {
  state.desk = b.dataset.desk; state.flag = 'all';
  document.querySelectorAll('[data-desk],[data-flag]').forEach((x) => x.classList.remove('on'));
  b.classList.add('on');
  renderTable();
}));
document.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => {
  state.flag = b.dataset.flag; state.desk = 'all';
  document.querySelectorAll('[data-desk],[data-flag]').forEach((x) => x.classList.remove('on'));
  b.classList.add('on');
  renderTable();
}));

async function boot() {
  const [rows, agents, notes, health] = await Promise.all([
    api('/api/scenarios'),
    api('/api/agents').catch(() => []),
    api('/api/competition').catch(() => []),
    api('/api/health').catch(() => ({ status: 'local' })),
  ]);
  state.rows = rows;
  state.agents = agents;
  state.notes = notes;
  state.selected = rows[0]?.id;
  $('stApi').textContent = health.status || 'ok';
  renderAll();
}

function filtered() {
  return state.rows.filter((r) => {
    if (state.desk !== 'all' && r.desk !== state.desk) return false;
    const hold = r.action === 'HOLD_PO';
    if (state.flag === 'hold' && !hold) return false;
    if (state.flag === 'clear' && hold) return false;
    return true;
  });
}

function renderTable() {
  const rows = filtered();
  $('poBody').innerHTML = rows.map((r) => `
    <tr data-id="${r.id}" class="${r.id === state.selected ? 'sel' : ''}">
      <td class="mono">${r.po}</td>
      <td>${r.title}<div style="color:var(--muted);font-size:.7rem">${r.id}</div></td>
      <td class="hide-sm">${r.supplier}</td>
      <td class="mono">${money(r.proposed)}</td>
      <td class="mono">${money(r.market)}</td>
      <td class="mono">${Number(r.confidence).toFixed(3)}</td>
      <td><span class="${pill(r.action)}">${r.action === 'HOLD_PO' ? 'HOLD' : 'RELEASE'}</span></td>
    </tr>`).join('');
  $('poBody').querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => {
    state.selected = tr.dataset.id;
    state.packet = state.packet && state.packet.scenario.id === state.selected ? state.packet : null;
    renderAll();
  }));
}

function current() { return state.rows.find((r) => r.id === state.selected) || state.rows[0]; }

function renderKpis() {
  const hold = state.rows.filter((r) => r.action === 'HOLD_PO').length;
  const savings = state.rows.reduce((a, r) => a + Math.max(0, r.proposed - r.market), 0);
  const conf = state.rows.reduce((a, r) => a + r.confidence, 0) / (state.rows.length || 1);
  $('kpiN').textContent = state.rows.length;
  $('kpiHold').textContent = hold;
  $('kpiSave').textContent = money(savings);
  $('kpiCov').textContent = conf.toFixed(3);
  $('cAll').textContent = state.rows.length;
  $('cMetals').textContent = state.rows.filter((r) => r.desk === 'metals').length;
  $('cEnergy').textContent = state.rows.filter((r) => r.desk === 'energy').length;
  $('cComp').textContent = state.rows.filter((r) => r.desk === 'composites').length;
  $('cHold').textContent = hold;
  $('cClear').textContent = state.rows.length - hold;
}

function renderAgents() {
  $('agentList').innerHTML = (state.agents.length ? state.agents : [
    {id:'INGEST',role:'Pull SAP / Ariba / quote'},{id:'ORACLE',role:'Attach market prints'},{id:'CONSENSUS',role:'CoV + MAD filter'},{id:'RISK',role:'Anomaly vs proposed'},{id:'PROVENANCE',role:'N-tier mineral passport'},{id:'SCREEN',role:'ESG / export / financial'},{id:'COMPLIANCE',role:'CBAM / dual-use gate'},{id:'SEAL',role:'PBFT + hash chain'},{id:'LEDGER',role:'Append-only tip'},{id:'EVIDENCE',role:'Exportable packet'}
  ]).map((a) => `<div class="side-btn"><span>${a.id}<small style="display:block;color:var(--faint);font-size:.68rem">${a.role}</small></span><span class="pill cyan">built</span></div>`).join('');
}

function renderNotes() {
  $('notes').innerHTML = (state.notes.length ? state.notes : []).map((c) => `<div style="padding:.7rem .85rem;border-top:1px solid var(--line)"><div style="font-weight:600;font-size:.8rem">${c.name}</div><div style="color:var(--muted);font-size:.75rem;margin-top:4px">${c.take}</div></div>`).join('');
}

function renderPipe() {
  const c = current(); if (!c) return;
  const p = state.packet;
  $('pipeTitle').innerHTML = `Verify ${c.id}<div style="font-weight:400;color:var(--muted);font-size:.75rem">${c.plant} · due ${c.due} · buyer ${c.buyer}</div>`;
  const steps = [
    ['01','INGEST', p ? p.ingest.po : c.po],
    ['02','ORACLE', p ? p.oracle.prints.length + ' prints' : c.observations.length + ' prints'],
    ['03','CONSENSUS', p ? p.consensus.verdict : c.verdict],
    ['04','RISK', p ? p.risk.action : c.action],
    ['05','SEAL', p ? p.seal.block : 'awaiting'],
  ];
  $('pipe').innerHTML = steps.map(([n,t,d]) => `<div class="step ${p ? 'on' : ''}"><div class="n">${n}</div><div class="t">${t}</div><div class="d">${d}</div></div>`).join('');
  if (p) {
    $('detail').hidden = false;
    $('oracles').innerHTML = p.oracle.prints.map((x) => `<div class="obs ${x.outlier ? 'out' : ''}"><span>${x.source}</span><span>${money(x.value)}</span></div>`).join('');
    $('sealBody').innerHTML = `<div>Market ${money(p.consensus.market)} vs proposed ${money(p.scenario.proposed)}</div>
      <div style="margin-top:6px">Anomaly ${p.risk.anomalyPct}% · savings ${money(p.risk.savings)} · ${p.risk.level}</div>
      <div class="hash" style="margin-top:8px">${p.seal.hash}</div>
      <div class="hash">merkle ${p.seal.merkle}</div>
      <div class="hash">prev ${p.seal.prev}</div>`;
    $('dropN').textContent = `dropped ${p.consensus.dropped} · n=${p.consensus.n}`;
    $('packetPre').textContent = JSON.stringify({ message: p.message, po: p.scenario.po, verdict: p.consensus.verdict, confidence: Number(p.consensus.confidence.toFixed(4)), market: Math.round(p.consensus.market), proposed: p.scenario.proposed, risk: p.risk, compliance: p.compliance, seal: p.seal, provenance: p.provenance.custody }, null, 2);
  } else $('detail').hidden = true;
  $('btnPacket').disabled = !p;
  $('btnExport').disabled = !p;
}

function renderRail() {
  const c = current(); if (!c) return;
  const p = state.packet;
  const tiers = p ? p.provenance.tiers : c.tiers;
  $('tiers').innerHTML = tiers.map((t) => `<div class="tier"><div class="idx">T${t.tier}</div><div><div class="who">${t.name}</div><div class="meta">${t.role} · ${t.evidence}</div></div><div class="cc">${t.country}</div></div>`).join('');
  const screens = p ? p.screen.screens : c.screens;
  $('screens').innerHTML = ['exportPermit','esg','financial','dualUse'].map((k) => `<div class="screen-row"><span>${k}</span><span class="${pill(screens[k])}">${screens[k]}</span></div>`).join('');
  const alerts = p ? p.screen.alerts : [];
  $('alerts').innerHTML = alerts.map((a) => `<div class="alert"><span class="pill mid">${a.type}</span><span>${a.text}</span></div>`).join('');
  if (p && p.compliance) {
    $('comp').innerHTML = `<div class="screen-row"><span>gate</span><span class="${pill(p.compliance.gate)}">${p.compliance.gate}</span></div>
      <div class="screen-row"><span>CBAM</span><span class="mono">${p.compliance.cbam}</span></div>
      <div class="screen-row"><span>CN share</span><span class="mono">${Math.round(p.compliance.chinaProcessingShare*100)}%</span></div>`;
    $('tip').textContent = p.ledger.tip;
    $('tipMeta').textContent = `depth ${p.ledger.depth} · ${p.ledger.intact === false ? 'BREAK' : 'intact'}`;
  } else {
    $('comp').innerHTML = '';
    $('tip').textContent = 'GENESIS';
    $('tipMeta').textContent = 'depth 0 · intact';
  }
}

function renderAll() {
  renderKpis(); renderAgents(); renderTable(); renderPipe(); renderRail(); renderNotes();
}

async function verify(id) {
  $('note').textContent = 'INGEST · pulling SAP / Ariba / oracles…';
  $('btnVerify').disabled = true;
  try {
    const result = await api('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: id }) });
    state.packet = result;
    $('note').textContent = result.message;
    const rows = await api('/api/scenarios');
    state.rows = rows;
    renderAll();
  } catch (err) {
    $('note').textContent = 'Verify failed · ' + String(err.message || err).slice(0, 80);
  } finally {
    $('btnVerify').disabled = false;
  }
}

function exportPacket() {
  if (!state.packet) return;
  const blob = new Blob([JSON.stringify(state.packet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = state.packet.scenario.id + '-verityx-packet.json'; a.click();
  URL.revokeObjectURL(url);
  $('note').textContent = 'EVIDENCE · packet downloaded';
}

async function writeback(action) {
  try {
    const rec = await api('/api/writeback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: state.selected, action }) });
    $('note').textContent = `WRITEBACK · SAP analog ${rec.action} · ${rec.doc}`;
  } catch (err) {
    $('note').textContent = 'Writeback failed · ' + String(err.message || err).slice(0, 80);
  }
}

if (hasSession()) showDesk(); else showLogin();
