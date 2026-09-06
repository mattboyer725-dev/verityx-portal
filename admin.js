const KEY = 'vx-admin-token';
const $ = (id) => document.getElementById(id);
const state = { token: localStorage.getItem(KEY) || '', data: null, panel: 'command' };
const PANELS = [
  ['command', 'Command'],
  ['seats', 'Seats'],
  ['agents', 'Agents'],
  ['alerts', 'Alerts'],
  ['policies', 'Policies'],
  ['flags', 'Flags'],
  ['audit', 'Audit']
];
const pill = (v) => {
  const s = String(v).toLowerCase();
  if (['active', 'healthy', 'open', 'owner'].includes(s)) return 'pill ok';
  if (['suspended', 'down', 'critical', 'high'].includes(s)) return 'pill bad';
  return 'pill mid';
};

async function api(path, body) {
  const opt = {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-vx-admin': state.token }
  };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(path, opt);
  return res.json();
}

function showApp(on) {
  $('gate').hidden = on;
  $('app').hidden = !on;
}

function render() {
  const d = state.data;
  if (!d) return;
  $('live').textContent = d.frozen ? 'DESK FROZEN' : 'LIVE · COMMAND';
  $('live').className = d.frozen ? 'live hold' : 'live';
  $('side').innerHTML = '<div class="label">Command</div>' + PANELS.map(([id, label]) => {
    const extra = id === 'alerts' ? d.kpis.alertsOpen : id === 'seats' ? d.kpis.seats : '';
    return `<button class="side-btn${state.panel === id ? ' on' : ''}" data-panel="${id}" type="button">${label}<span class="mono">${extra}</span></button>`;
  }).join('');
  $('status').innerHTML = `<span>Owner <strong>${d.owner}</strong></span><span>Seats <strong>${d.kpis.seatsActive}/${d.kpis.seats}</strong></span><span>Alerts <strong>${d.kpis.alertsOpen}</strong></span><span>Agents <strong>${d.kpis.agentsHealthy}</strong></span>`;
  const main = $('main');
  if (state.panel === 'command') {
    main.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="k">Open POs</div><div class="v">${d.kpis.pos}</div><div class="s">Live magnetics book</div></div>
        <div class="kpi"><div class="k">Hold</div><div class="v" style="color:var(--red)">${d.kpis.hold}</div><div class="s">anomaly / export watch</div></div>
        <div class="kpi"><div class="k">Seats</div><div class="v">${d.kpis.seatsActive}</div><div class="s">of ${d.kpis.seats} licensed occupants</div></div>
        <div class="kpi"><div class="k">Alerts</div><div class="v">${d.kpis.alertsOpen}</div><div class="s">open operator queue</div></div>
      </div>
      <section class="card"><div class="card-h">Desk freeze<span>${d.frozen ? 'verifies blocked' : 'desk accepting verifies'}</span></div>
        <div class="pad"><p class="copy">Freeze stops Verify on the live PO desk without taking command offline.</p>
        <button class="btn ${d.frozen ? 'primary' : 'ghost'}" data-act='{"type":"desk.freeze","frozen":${!d.frozen}}'>${d.frozen ? 'Thaw desk' : 'Freeze desk'}</button></div>
      </section>
      <section class="card"><div class="card-h">Live book<span>hold vs release</span></div>
        <table><thead><tr><th>PO</th><th>Commodity</th><th>Buyer</th><th>Gate</th></tr></thead>
        <tbody>${d.book.map((r) => `<tr><td class="mono">${r.po}</td><td>${r.title}</td><td>${r.buyer}</td><td><span class="${pill(r.hold ? 'high' : 'active')}">${r.hold ? 'HOLD' : 'RELEASE'}</span></td></tr>`).join('')}</tbody></table>
      </section>`;
  } else if (state.panel === 'seats') {
    main.innerHTML = `<section class="card"><div class="card-h">Tenant seats<span>${d.kpis.seatsActive} active</span></div>
      <table><thead><tr><th>Seat</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>${d.seats.map((s) => `<tr><td>${s.name}<div class="sub">${s.email}</div></td><td>${s.role}</td><td><span class="${pill(s.status)}">${s.status}</span></td>
        <td><button class="btn ghost sm" data-act='${JSON.stringify({ type: 'seat.status', id: s.id, status: s.status === 'suspended' ? 'active' : 'suspended' })}'>${s.status === 'suspended' ? 'Restore' : 'Suspend'}</button></td></tr>`).join('')}</tbody></table></section>
      <section class="card"><div class="card-h">Invite seat<span>directory occupant</span></div>
        <form class="form" id="invite"><input name="name" required placeholder="Name"/><input name="email" type="email" required placeholder="Email"/>
        <input name="title" required placeholder="Title"/><input name="plant" placeholder="Plant"/>
        <button class="btn primary" type="submit">Invite</button></form></section>`;
  } else if (state.panel === 'agents') {
    main.innerHTML = `<section class="card"><div class="card-h">Agent fleet<span>${d.kpis.agentsHealthy} healthy</span></div>
      ${d.agents.map((a) => `<div class="row"><div><strong>${a.id}</strong><div class="sub">${a.role} · ${a.latencyMs}ms</div></div>
        <span class="${pill(a.status)}">${a.status}</span>
        <button class="btn ghost sm" data-act='{"type":"agent.status","id":"${a.id}","status":"restarted"}'>Restart</button></div>`).join('')}</section>`;
  } else if (state.panel === 'alerts') {
    main.innerHTML = `<section class="card"><div class="card-h">Alerts<span>${d.kpis.alertsOpen} open</span></div>
      ${d.alerts.map((a) => `<div class="row"><span class="${pill(a.severity)}">${a.severity}</span><div><strong>${a.title}</strong><div class="sub">${a.source}</div></div>
        ${a.status === 'open' ? `<button class="btn ghost sm" data-act='{"type":"alert.set","id":"${a.id}","status":"ack"}'>Ack</button>` : `<span class="${pill(a.status)}">${a.status}</span>`}</div>`).join('')}</section>`;
  } else if (state.panel === 'policies') {
    main.innerHTML = `<section class="card"><div class="card-h">Gate policies<span>MAD · CoV · PBFT</span></div>
      ${d.policies.map((p) => `<div class="row"><div><strong>${p.label}</strong></div><div class="mono">${p.value} ${p.unit}</div></div>`).join('')}</section>`;
  } else if (state.panel === 'flags') {
    main.innerHTML = `<section class="card"><div class="card-h">Feature flags<span>runtime gates</span></div>
      ${d.flags.map((f) => `<div class="row"><strong>${f.label}</strong>
        <button class="btn sm ${f.enabled ? 'primary' : 'ghost'}" data-act='{"type":"flag.toggle","key":"${f.key}","enabled":${!f.enabled}}'>${f.enabled ? 'On' : 'Off'}</button></div>`).join('')}</section>`;
  } else if (state.panel === 'audit') {
    main.innerHTML = `<section class="card"><div class="card-h">Audit log<span>append-only</span></div>
      <table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
      <tbody>${d.audit.map((a) => `<tr><td class="mono">${String(a.ts).slice(11, 19)}</td><td>${a.actor}</td><td class="mono">${a.action}</td><td>${a.detail || ''}</td></tr>`).join('')}</tbody></table></section>`;
  }
}

async function refresh() {
  const data = await api('/api/admin');
  if (!data.ok) {
    state.token = '';
    localStorage.removeItem(KEY);
    showApp(false);
    return;
  }
  state.data = data;
  showApp(true);
  render();
}

$('gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('gateErr').textContent = '';
  const out = await api('/api/admin/session', { email: $('email').value });
  if (!out.ok) {
    $('gateErr').textContent = out.error || 'Rejected';
    return;
  }
  state.token = out.token;
  localStorage.setItem(KEY, out.token);
  state.data = out.snapshot;
  showApp(true);
  render();
});

$('leave').addEventListener('click', () => {
  state.token = '';
  localStorage.removeItem(KEY);
  showApp(false);
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-panel]');
  if (btn) {
    state.panel = btn.getAttribute('data-panel');
    render();
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const body = JSON.parse(act.getAttribute('data-act'));
  const next = await api('/api/admin', body);
  if (next.ok) {
    state.data = next;
    render();
  }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'invite') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const next = await api('/api/admin', {
    type: 'seat.invite',
    name: fd.get('name'),
    email: fd.get('email'),
    title: fd.get('title'),
    plant: fd.get('plant')
  });
  if (next.ok) {
    state.data = next;
    render();
  }
});

if (state.token) refresh();
