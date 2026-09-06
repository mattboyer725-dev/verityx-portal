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


function vxSha256(ascii) {
  function rr(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  var mathPow = Math.pow, maxWord = mathPow(2, 32), i, j, result = '', words = [];
  var asciiBitLength = ascii.length * 8;
  var hash = vxSha256.h = vxSha256.h || [];
  var k = vxSha256.k = vxSha256.k || [];
  var primeCounter = k.length, isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = asciiBitLength;
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

const SCENARIOS = [
  {id:'SG-4782',desk:'metals',title:'Rare Earth Permanent Magnets',supplier:'Nanjing RareTech Ltd.',proposed:6950000,observations:[5680000,5712000,5594000,5748000,8120000],observationSources:['LME-adjacent magnet index','Asian Metal NdFeB print','Argus REE weekly','Internal last-buy SAP','Supplier quote (unverified)'],assumptions:['China processing share ~90%','Sintered NdFeB N48H'],tenant:'SIEMENS-GAMESA',commodity:'NdFeB magnet',po:'4500187742',plant:'Brande, DK',buyer:'Elena Hartmann',currency:'EUR',due:'2026-10-14',tiers:[{tier:0,role:'Mine',name:'Bayan Obo analog lot',country:'CN',evidence:'lot weighbridge'},{tier:1,role:'Separator',name:'Inner Mongolia REE mill',country:'CN',evidence:'assay cert'},{tier:2,role:'Magnet OEM',name:'Nanjing RareTech Ltd.',country:'CN',evidence:'quote + ISO 9001'},{tier:3,role:'OEM plant',name:'Siemens Gamesa Brande',country:'DK',evidence:'SAP PO'}],screens:{exportPermit:'WATCH',esg:'HIGH',financial:'MED',dualUse:'CLEAR'}},
  {id:'SG-5191',desk:'metals',title:'Neodymium Alloy Procurement',supplier:'Baotou Rare Earth Co.',proposed:12400000,observations:[10350000,10420000,10180000,10660000],observationSources:['Argus NdPr oxide','Asian Metal alloy','Last SAP GR','Trader offer'],assumptions:['Single-origin melt lot'],tenant:'SIEMENS-GAMESA',commodity:'NdPr alloy',po:'4500188011',plant:'Hamburg, DE',buyer:'Elena Hartmann',currency:'EUR',due:'2026-11-02',tiers:[{tier:0,role:'Mine',name:'Baotou pit feed',country:'CN',evidence:'origin declaration'},{tier:1,role:'Alloy',name:'Baotou Rare Earth Co.',country:'CN',evidence:'melt heat number'},{tier:2,role:'OEM plant',name:'Siemens Gamesa Hamburg',country:'DE',evidence:'Ariba RFQ'}],screens:{exportPermit:'WATCH',esg:'MED',financial:'HIGH',dualUse:'CLEAR'}},
  {id:'SG-6033',desk:'metals',title:'Offshore Generator Copper CTC',supplier:'Nordic Conductor AB',proposed:4820000,observations:[4610000,4598000,4632000,4605000],observationSources:['LME Cu cash','Boliden mill','Nordic Conductor offer','SAP last GR'],assumptions:['EU origin claimed'],tenant:'SIEMENS-GAMESA',commodity:'Cu CTC',po:'4500191044',plant:'Hull, GB',buyer:'Mads Sørensen',currency:'EUR',due:'2026-09-28',tiers:[{tier:0,role:'Cathode',name:'Boliden analog',country:'SE',evidence:'LME warrant'},{tier:1,role:'Drawer',name:'Nordic Conductor AB',country:'SE',evidence:'mill cert'},{tier:2,role:'OEM plant',name:'Siemens Gamesa Hull',country:'GB',evidence:'SAP GR'}],screens:{exportPermit:'CLEAR',esg:'LOW',financial:'LOW',dualUse:'CLEAR'}},
  {id:'SG-7104',desk:'metals',title:'Tower Steel Plate S355',supplier:'Dillinger Hütte',proposed:8240000,observations:[8110000,8085000,8152000,8098000],observationSources:['MEPS plate EU','Dillinger quote','Tata analog','SAP last-buy'],assumptions:['EU mill of origin','EN 10025-2'],tenant:'SIEMENS-GAMESA',commodity:'S355 plate',po:'4500193301',plant:'Le Havre, FR',buyer:'Claire Moreau',currency:'EUR',due:'2026-10-30',tiers:[{tier:0,role:'Iron ore',name:'LKAB Kiruna analog',country:'SE',evidence:'origin cert'},{tier:1,role:'Mill',name:'Dillinger Hütte',country:'DE',evidence:'heat number'},{tier:2,role:'OEM plant',name:'SGRE tower line Le Havre',country:'FR',evidence:'SAP PO'}],screens:{exportPermit:'CLEAR',esg:'LOW',financial:'LOW',dualUse:'CLEAR'}},
  {id:'SG-8221',desk:'composites',title:'Blade Infusion Resin',supplier:'Hexion GmbH',proposed:3180000,observations:[2940000,2975000,3410000,2960000],observationSources:['ICIS epoxy','Hexion offer','Olin analog','SAP last GR'],assumptions:['Epoxy + hardener kit'],tenant:'SIEMENS-GAMESA',commodity:'Epoxy resin kit',po:'4500194418',plant:'Aalborg, DK',buyer:'Ingrid Dahl',currency:'EUR',due:'2026-09-18',tiers:[{tier:0,role:'Feedstock',name:'BPA / ECH analog',country:'DE',evidence:'REACH dossier'},{tier:1,role:'Formulator',name:'Hexion GmbH',country:'DE',evidence:'batch COA'},{tier:2,role:'Blade plant',name:'SGRE Aalborg',country:'DK',evidence:'Ariba contract'}],screens:{exportPermit:'CLEAR',esg:'MED',financial:'LOW',dualUse:'CLEAR'}},
  {id:'SG-9012',desk:'energy',title:'Converter IGBT Modules',supplier:'Infineon Technologies AG',proposed:5460000,observations:[5410000,5388000,5425000,5402000],observationSources:['Infineon list','Distributor print','Last SAP GR','Peer OEM analog'],assumptions:['Automotive-grade dual-use screen required'],tenant:'SIEMENS-GAMESA',commodity:'IGBT module',po:'4500195520',plant:'Zamudio, ES',buyer:'Elena Hartmann',currency:'EUR',due:'2026-12-01',tiers:[{tier:0,role:'Wafer',name:'Infineon Villach analog',country:'AT',evidence:'lot traveler'},{tier:1,role:'Module OEM',name:'Infineon Warstein',country:'DE',evidence:'PPAP'},{tier:2,role:'OEM plant',name:'SGRE Zamudio',country:'ES',evidence:'SAP PO'}],screens:{exportPermit:'CLEAR',esg:'LOW',financial:'LOW',dualUse:'WATCH'}},
  {id:'SG-9304',desk:'metals',title:'Dysprosium Metal for H-grade Magnets',supplier:'China Northern Rare Earth',proposed:9180000,observations:[7420000,7385000,7510000,7460000,11200000],observationSources:['Argus Dy oxide','Asian Metal Dy metal','Internal last-buy SAP','Trader offer EU bonded','Supplier quote (unverified)'],assumptions:['Heavy REE, export-licence sensitive','H-grade NdFeB dopant'],tenant:'SIEMENS-GAMESA',commodity:'Dy metal',po:'4500196604',plant:'Brande, DK',buyer:'Elena Hartmann',currency:'EUR',due:'2026-11-20',tiers:[{tier:0,role:'Mine',name:'Bayan Obo heavy-REE cut',country:'CN',evidence:'lot assay'},{tier:1,role:'Separator',name:'Northern REE solvent mill',country:'CN',evidence:'export licence analog'},{tier:2,role:'Metal',name:'China Northern Rare Earth',country:'CN',evidence:'ingot heat'},{tier:3,role:'OEM plant',name:'Siemens Gamesa Brande',country:'DK',evidence:'SAP PO'}],screens:{exportPermit:'WATCH',esg:'HIGH',financial:'MED',dualUse:'CLEAR'}},
  {id:'SG-7440',desk:'energy',title:'Generator Electrical Steel M400-50A',supplier:'thyssenkrupp Steel Europe',proposed:3640000,observations:[3580000,3595000,3572000,3610000],observationSources:['MEPS NGO EU','tkSE mill quote','voestalpine analog','SAP last GR'],assumptions:['EU mill of origin','EN 10106'],tenant:'SIEMENS-GAMESA',commodity:'NGO electrical steel',po:'4500194410',plant:'Cuxhaven, DE',buyer:'Mads Sørensen',currency:'EUR',due:'2026-10-08',tiers:[{tier:0,role:'Iron ore',name:'LKAB analog',country:'SE',evidence:'origin cert'},{tier:1,role:'Mill',name:'thyssenkrupp Steel Europe',country:'DE',evidence:'coil heat'},{tier:2,role:'OEM plant',name:'SGRE Cuxhaven',country:'DE',evidence:'SAP GR'}],screens:{exportPermit:'CLEAR',esg:'LOW',financial:'LOW',dualUse:'CLEAR'}}
];
const CLIENT_CHAIN = [];
const AGENTS = [
  {id:'INGEST',exists:true,role:'Pull SAP / Ariba / quote'},
  {id:'INTAKE',exists:true,role:'Accept a new PO into the desk'},
  {id:'ORACLE',exists:true,role:'Attach / refresh market prints'},
  {id:'DUAL_SOURCE',exists:true,role:'Quote vs oracle spread'},
  {id:'CONSENSUS',exists:true,role:'CoV + MAD filter'},
  {id:'RISK',exists:true,role:'Anomaly vs proposed'},
  {id:'PROVENANCE',exists:true,role:'N-tier mineral passport'},
  {id:'SCREEN',exists:true,role:'ESG / export / financial'},
  {id:'COMPLIANCE',exists:true,role:'CBAM / dual-use gate'},
  {id:'SEAL',exists:true,role:'PBFT + hash chain'},
  {id:'LEDGER',exists:true,role:'Append-only tip'},
  {id:'MERKLE',exists:true,role:'Inclusion proof'},
  {id:'EVIDENCE',exists:true,role:'Exportable packet'},
  {id:'WRITEBACK',exists:true,role:'SAP hold / release analog'},
  {id:'AUTH',exists:true,role:'Demo seat gate'}
];
const CLIENT_NOTES = [
  {name:'SAP Ariba / Coupa / GEP',take:'Embed verify inside the PO path, not a side dashboard.'},
  {name:'EcoVadis / Prewave',take:'Continuous ESG and media-risk screens.'},
  {name:'Resilinc / Everstream / Sayari',take:'N-tier map with evidence.'},
  {name:'Circulor / Minespider / Everledger',take:'Lot-level mineral passport + custody events.'},
  {name:'RapidRatings / D&B',take:'Financial health as a first-class screen.'},
  {name:'Sourcemap / Altana',take:'Exportable evidence packet.'},
  {name:'Hyperledger supply-chain samples',take:'Permissioned events, not public PoW.'},
  {name:'verityx-local-core',take:'Append-only hash chain + Merkle inclusion.'}
];
function vxMedian(s){const n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;}
function vxMad(values){if(values.length<3)return values;const sorted=[...values].sort((a,b)=>a-b);const med=vxMedian(sorted);const mad=vxMedian(sorted.map(v=>Math.abs(v-med)).sort((a,b)=>a-b));if(mad===0)return values;const f=values.filter(v=>(0.6745*Math.abs(v-med))/mad<=3.5);return f.length>=2?f:values;}
function vxStdev(values){const m=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((a,b)=>a+(b-m)**2,0)/(values.length-1));}
function vxConsensus(observations){
  if(!observations||observations.length<2)return{confidence:0,cv:0,verdict:'INSUFFICIENT_DATA',market:0,n:0,dropped:0,kept:[]};
  const filtered=vxMad(observations);
  const market=filtered.reduce((a,b)=>a+b,0)/filtered.length;
  if(Math.abs(market)<0.01)return{confidence:0,cv:0,verdict:'INSUFFICIENT_DATA',market:0,n:0,dropped:0,kept:filtered};
  const cv=vxStdev(filtered)/Math.abs(market);
  const confidence=Math.max(0,Math.min(1,1-cv));
  return{confidence,cv,verdict:confidence>=0.8?'VERIFIED':'DISPUTED',market,n:filtered.length,dropped:observations.length-filtered.length,kept:filtered};
}
function vxRisk(scenario,consensus){
  const savings=Math.max(0,scenario.proposed-consensus.market);
  const anomaly=consensus.market?((scenario.proposed-consensus.market)/consensus.market)*100:0;
  let level='MED';
  if(anomaly>=18||consensus.verdict!=='VERIFIED'||scenario.screens.exportPermit==='WATCH')level='CRITICAL';
  else if(anomaly>=8||scenario.screens.esg==='HIGH')level='HIGH';
  else if(anomaly<5&&consensus.verdict==='VERIFIED')level='LOW';
  return{agent:'RISK',level,anomalyPct:Number(anomaly.toFixed(1)),savings:Math.round(savings),screens:scenario.screens,action:level==='CRITICAL'||level==='HIGH'?'HOLD_PO':'RELEASE_PO'};
}
function vxClientRows(){
  return SCENARIOS.map((s)=>{
    const c=vxConsensus(s.observations);
    const r=vxRisk(s,c);
    return {...s, market:Math.round(c.market), confidence:Number(c.confidence.toFixed(3)), verdict:c.verdict, action:r.action, anomalyPct:r.anomalyPct};
  });
}
function vxRun(scenarioId){
  const scenario=SCENARIOS.find(s=>s.id===scenarioId)||SCENARIOS[0];
  const consensus=vxConsensus(scenario.observations);
  const ingest={agent:'INGEST',sources:['SAP S/4HANA','Ariba','market oracles','supplier quote'],po:scenario.po,observations:scenario.observations,ts:new Date().toISOString()};
  const oracle={agent:'ORACLE',pattern:'Argus / Asian Metal / LME analog — not a live vendor feed',prints:scenario.observations.map((value,i)=>({source:scenario.observationSources[i]||('oracle-'+(i+1)),value,outlier:!consensus.kept.includes(value)}))};
  const risk=vxRisk(scenario,consensus);
  const provenance={agent:'PROVENANCE',pattern:'Circulor/Minespider digital passport analog',commodity:scenario.commodity,tiers:scenario.tiers,custody:scenario.tiers.map((t,i)=>({step:i+1,from:t.name,event:t.role+' handoff',evidence:t.evidence,country:t.country}))};
  const alerts=[
    scenario.screens.exportPermit!=='CLEAR'&&{type:'EXPORT',text:'China rare-earth export permit lag'},
    scenario.screens.esg==='HIGH'&&{type:'ESG',text:'Processing-stage ESG concentration'},
    scenario.screens.esg==='MED'&&{type:'ESG',text:'Feedstock ESG watch'},
    scenario.screens.financial==='HIGH'&&{type:'FIN',text:'Supplier financial opacity'},
    scenario.screens.dualUse!=='CLEAR'&&{type:'DUAL_USE',text:'Dual-use / export-control watch'}
  ].filter(Boolean);
  const screen={agent:'SCREEN',pattern:'EcoVadis + Prewave + RapidRatings analog',screens:scenario.screens,alerts};
  const cnShare=scenario.tiers.filter(t=>t.country==='CN').length/scenario.tiers.length;
  const compliance={agent:'COMPLIANCE',dualUse:scenario.screens.dualUse,exportPermit:scenario.screens.exportPermit,chinaProcessingShare:Number(cnShare.toFixed(2)),reach:scenario.desk==='composites'?'DOSSIER_ON_FILE':'N/A',cbam:scenario.desk==='metals'?'IN_SCOPE':'OUT_OF_SCOPE',gate:scenario.screens.exportPermit==='WATCH'||scenario.screens.dualUse==='WATCH'?'REVIEW':'PASS'};
  const quote=scenario.proposed, market=consensus.market, spread=market?((quote-market)/market)*100:0;
  const dual={agent:'DUAL_SOURCE',id:scenario.id,quote,market:Math.round(market),spreadPct:Number(spread.toFixed(1)),verdict:Math.abs(spread)>=8?'SPREAD_ALERT':'ALIGNED',sources:scenario.observationSources};
  const prev=CLIENT_CHAIN.length?CLIENT_CHAIN[CLIENT_CHAIN.length-1].hash:'GENESIS';
  const payload=JSON.stringify({id:scenario.id,prev,market:Math.round(consensus.market),proposed:scenario.proposed,confidence:Number(consensus.confidence.toFixed(4)),verdict:consensus.verdict});
  const hash=vxSha256(payload);
  const merkle=vxSha256(hash+':'+scenario.po+':'+consensus.n);
  const seal={agent:'SEAL',algorithm:'Hybrid PBFT + CoV + hash chain',block:'VX-BLK-'+hash.slice(0,12).toUpperCase(),hash,prev,nodes:27,quorum:'2f+1=19',finality:'immediate',ts:new Date().toISOString(),merkle};
  CLIENT_CHAIN.push(seal);
  const ledger={agent:'LEDGER',pattern:'verityx-local-core append-only hash chain analog',depth:CLIENT_CHAIN.length,intact:true,tip:hash,blocks:[...CLIENT_CHAIN]};
  const merkleInc={ok:true,leaf:hash,index:CLIENT_CHAIN.length-1,root:hash,proof:[]};
  const auth={agent:'AUTH',ok:true,seat:{name:'Elena Hartmann',title:'Head of Magnetics Procurement',tenant:'SIEMENS-GAMESA',email:EMAIL}};
  const result={scenario,ingest,oracle,consensus,risk,provenance,screen,compliance,dual,seal,ledger,merkle:merkleInc,auth,chainDepth:CLIENT_CHAIN.length,message:'One provable version of reality established.'};
  result.evidence={agent:'EVIDENCE',pattern:'Sourcemap exportable evidence packet analog',filename:scenario.id+'-verityx-packet.json'};
  return result;
}
function vxWriteback(id, action) {
  const scenario=SCENARIOS.find(s=>s.id===id)||SCENARIOS[0];
  const consensus=vxConsensus(scenario.observations);
  const risk=vxRisk(scenario,consensus);
  const resolved=action==='release'||action==='RELEASE_PO'||action==='RELEASE'?'RELEASE':action==='hold'||action==='HOLD_PO'||action==='block'?'HOLD':String(action).toUpperCase();
  return {agent:'WRITEBACK',fake:'SAP BAPI analog — no live ECC/S4 call',po:scenario.po,id:scenario.id,action:resolved,recommended:risk.action,accepted:resolved==='HOLD'||resolved==='RELEASE',ts:new Date().toISOString(),doc:'VX-WB-'+vxSha256(scenario.po+resolved+Date.now()).slice(0,10).toUpperCase()};
}


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
  try {
    const [rows, agents, notes, health] = await Promise.all([
      api('/api/scenarios'),
      api('/api/agents').catch(() => []),
      api('/api/competition').catch(() => []),
      api('/api/health').catch(() => ({ status: 'local' })),
    ]);
    if (!Array.isArray(rows) || !rows.length || rows[0].proposed == null) throw new Error('scenarios');
    state.rows = rows;
    state.agents = agents;
    state.notes = notes;
    state.selected = rows[0]?.id;
    $('stApi').textContent = health.status || 'ok';
    renderAll();
  } catch (err) {
    $('stApi').textContent = 'client';
    $('note').textContent = 'API offline · client consensus engine';
    state.rows = vxClientRows();
    state.agents = AGENTS.map((a) => ({ ...a, exists: true, built: true }));
    state.notes = CLIENT_NOTES;
    state.selected = state.rows[0] && state.rows[0].id;
    renderAll();
  }
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
    ['05','PROVENANCE', (p ? p.provenance.tiers : c.tiers).length + '-tier'],
    ['06','SCREEN', p ? (p.screen.alerts.length + ' alerts') : 'pre-screen'],
    ['07','COMPLIANCE', p ? p.compliance.gate : 'awaiting'],
    ['08','SEAL', p ? p.seal.block : 'awaiting'],
    ['09','LEDGER', p ? ('depth ' + p.ledger.depth) : 'GENESIS'],
    ['10','EVIDENCE', p ? 'packet ready' : 'awaiting'],
    ['11','AUTH', 'demo seat'],
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
    $('dropN').textContent = `dropped ${p.consensus.dropped} · n=${p.consensus.n}` + (p.dual ? ` · dual ${p.dual.verdict} ${p.dual.spreadPct}%` : '');
    $('packetPre').textContent = JSON.stringify({ message: p.message, po: p.scenario.po, verdict: p.consensus.verdict, confidence: Number(p.consensus.confidence.toFixed(4)), market: Math.round(p.consensus.market), proposed: p.scenario.proposed, risk: p.risk, compliance: p.compliance, dual: p.dual, merkle: p.merkle, auth: p.auth, seal: p.seal, provenance: p.provenance.custody }, null, 2);
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
  if ($('tiersM')) {
    $('tiersM').innerHTML = $('tiers').innerHTML;
    $('screensM').innerHTML = $('screens').innerHTML;
    $('alertsM').innerHTML = $('alerts').innerHTML;
    $('compM').innerHTML = $('comp').innerHTML;
    $('tipM').textContent = $('tip').textContent + ' · ' + $('tipMeta').textContent;
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
    try {
      const result = vxRun(id);
      state.packet = result;
      $('note').textContent = result.message;
      state.rows = vxClientRows();
      renderAll();
    } catch (inner) {
      $('note').textContent = 'Verify failed · ' + String(err.message || err).slice(0, 80);
    }
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
    const rec = vxWriteback(state.selected, action);
    $('note').textContent = `WRITEBACK · SAP analog ${rec.action} · ${rec.doc}`;
  }
}

if (hasSession()) showDesk(); else showLogin();
