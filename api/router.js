const crypto = require('crypto');

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

const CHAIN = [];
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

function median(s){const n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;}
function madFilter(values){if(values.length<3)return values;const sorted=[...values].sort((a,b)=>a-b);const med=median(sorted);const mad=median(sorted.map(v=>Math.abs(v-med)).sort((a,b)=>a-b));if(mad===0)return values;const f=values.filter(v=>(0.6745*Math.abs(v-med))/mad<=3.5);return f.length>=2?f:values;}
function stdev(values){const m=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((a,b)=>a+(b-m)**2,0)/(values.length-1));}

function consensusAgent(observations){
  if(!observations||observations.length<2)return{confidence:0,cv:0,verdict:'INSUFFICIENT_DATA',market:0,n:0,dropped:0,kept:[]};
  const filtered=madFilter(observations);
  const market=filtered.reduce((a,b)=>a+b,0)/filtered.length;
  if(Math.abs(market)<0.01)return{confidence:0,cv:0,verdict:'INSUFFICIENT_DATA',market:0,n:0,dropped:0,kept:filtered};
  const cv=stdev(filtered)/Math.abs(market);
  const confidence=Math.max(0,Math.min(1,1-cv));
  return{confidence,cv,verdict:confidence>=0.8?'VERIFIED':'DISPUTED',market,n:filtered.length,dropped:observations.length-filtered.length,kept:filtered};
}
function ingestAgent(scenario){return{agent:'INGEST',sources:['SAP S/4HANA','Ariba','market oracles','supplier quote'],po:scenario.po,observations:scenario.observations,ts:new Date().toISOString()};}
function oracleAgent(scenario,consensus){
  return{agent:'ORACLE',pattern:'Argus / Asian Metal / LME analog — not a live vendor feed',prints:scenario.observations.map((value,i)=>({source:scenario.observationSources[i]||('oracle-'+(i+1)),value,outlier:!consensus.kept.includes(value)}))};
}
function riskAgent(scenario,consensus){
  const savings=Math.max(0,scenario.proposed-consensus.market);
  const anomaly=consensus.market?((scenario.proposed-consensus.market)/consensus.market)*100:0;
  let level='MED';
  if(anomaly>=18||consensus.verdict!=='VERIFIED'||scenario.screens.exportPermit==='WATCH')level='CRITICAL';
  else if(anomaly>=8||scenario.screens.esg==='HIGH')level='HIGH';
  else if(anomaly<5&&consensus.verdict==='VERIFIED')level='LOW';
  return{agent:'RISK',level,anomalyPct:Number(anomaly.toFixed(1)),savings:Math.round(savings),screens:scenario.screens,action:level==='CRITICAL'||level==='HIGH'?'HOLD_PO':'RELEASE_PO'};
}
function provenanceAgent(scenario){return{agent:'PROVENANCE',pattern:'Circulor/Minespider digital passport analog',commodity:scenario.commodity,tiers:scenario.tiers,custody:scenario.tiers.map((t,i)=>({step:i+1,from:t.name,event:t.role+' handoff',evidence:t.evidence,country:t.country}))};}
function screenAgent(scenario){
  const alerts=[
    scenario.screens.exportPermit!=='CLEAR'&&{type:'EXPORT',text:'China rare-earth export permit lag'},
    scenario.screens.esg==='HIGH'&&{type:'ESG',text:'Processing-stage ESG concentration'},
    scenario.screens.esg==='MED'&&{type:'ESG',text:'Feedstock ESG watch'},
    scenario.screens.financial==='HIGH'&&{type:'FIN',text:'Supplier financial opacity'},
    scenario.screens.dualUse!=='CLEAR'&&{type:'DUAL_USE',text:'Dual-use / export-control watch'}
  ].filter(Boolean);
  return{agent:'SCREEN',pattern:'EcoVadis + Prewave + RapidRatings analog',screens:scenario.screens,alerts};
}
function complianceAgent(scenario){
  const cnShare=scenario.tiers.filter(t=>t.country==='CN').length/scenario.tiers.length;
  return{agent:'COMPLIANCE',dualUse:scenario.screens.dualUse,exportPermit:scenario.screens.exportPermit,chinaProcessingShare:Number(cnShare.toFixed(2)),reach:scenario.desk==='composites'?'DOSSIER_ON_FILE':'N/A',cbam:scenario.desk==='metals'?'IN_SCOPE':'OUT_OF_SCOPE',gate:scenario.screens.exportPermit==='WATCH'||scenario.screens.dualUse==='WATCH'?'REVIEW':'PASS'};
}
function sealAgent(scenario,consensus){
  const prev=CHAIN.length?CHAIN[CHAIN.length-1].hash:'GENESIS';
  const payload=JSON.stringify({id:scenario.id,prev,market:Math.round(consensus.market),proposed:scenario.proposed,confidence:Number(consensus.confidence.toFixed(4)),verdict:consensus.verdict});
  const hash=crypto.createHash('sha256').update(payload).digest('hex');
  const merkle=crypto.createHash('sha256').update(hash+':'+scenario.po+':'+consensus.n).digest('hex');
  const block={agent:'SEAL',algorithm:'Hybrid PBFT + CoV + hash chain',block:'VX-BLK-'+hash.slice(0,12).toUpperCase(),hash,prev,nodes:27,quorum:'2f+1=19',finality:'immediate',ts:new Date().toISOString(),merkle};
  CHAIN.push(block);
  return block;
}
function ledgerAgent(){
  return{agent:'LEDGER',pattern:'verityx-local-core append-only hash chain analog',depth:CHAIN.length,intact:CHAIN.every((b,i)=>i===0?b.prev==='GENESIS':b.prev===CHAIN[i-1].hash),tip:CHAIN.length?CHAIN[CHAIN.length-1].hash:'GENESIS',blocks:[...CHAIN]};
}
function evidenceAgent(packet){return{agent:'EVIDENCE',pattern:'Sourcemap exportable evidence packet analog',filename:packet.scenario.id+'-verityx-packet.json'};}
function authAgent(email,password){
  const ok=email==='elena.hartmann@siemensgamesa.com'&&password==='demo2026';
  return{agent:'AUTH',ok,seat:ok?{name:'Elena Hartmann',title:'Head of Magnetics Procurement',tenant:'SIEMENS-GAMESA',email}:null};
}
function runPipeline(scenarioId){
  const scenario=SCENARIOS.find(s=>s.id===scenarioId)||SCENARIOS[0];
  const ingest=ingestAgent(scenario);
  const consensus=consensusAgent(scenario.observations);
  const oracle=oracleAgent(scenario,consensus);
  const risk=riskAgent(scenario,consensus);
  const provenance=provenanceAgent(scenario);
  const screen=screenAgent(scenario);
  const compliance=complianceAgent(scenario);
  const dual=dualSourceAgent(scenario.id);
  const seal=sealAgent(scenario,consensus);
  const ledger=ledgerAgent();
  const merkle=merkleInclusion(seal.hash);
  const auth=authAgent('elena.hartmann@siemensgamesa.com','demo2026');
  const result={scenario,ingest,oracle,consensus,risk,provenance,screen,compliance,dual,seal,ledger,merkle,auth,chainDepth:CHAIN.length,message:'One provable version of reality established.'};
  result.evidence=evidenceAgent(result);
  return result;
}
function competitionNotes(){
  return[
    {name:'SAP Ariba / Coupa / GEP',take:'Embed verify inside the PO path, not a side dashboard.'},
    {name:'EcoVadis / Prewave',take:'Continuous ESG and media-risk screens.'},
    {name:'Resilinc / Everstream / Sayari',take:'N-tier map with evidence.'},
    {name:'Circulor / Minespider / Everledger',take:'Lot-level mineral passport + custody events.'},
    {name:'RapidRatings / D&B',take:'Financial health as a first-class screen.'},
    {name:'Sourcemap / Altana',take:'Exportable evidence packet.'},
    {name:'Hyperledger supply-chain samples',take:'Permissioned events, not public PoW.'},
    {name:'verityx-local-core',take:'Append-only hash chain + Merkle inclusion.'}
  ];
}
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}

function sha(s){return crypto.createHash('sha256').update(s).digest('hex');}
function merkleRoot(leaves){
  if(!leaves.length)return{root:'GENESIS',layers:[]};
  let layer=leaves.map((x)=>x);
  const layers=[layer];
  while(layer.length>1){
    const next=[];
    for(let i=0;i<layer.length;i+=2){
      const a=layer[i];
      const b=layer[i+1]||layer[i];
      next.push(sha(a+b));
    }
    layer=next;
    layers.push(layer);
  }
  return{root:layer[0],layers:layers.length};
}
function merkleInclusion(leaf){
  const leaves=CHAIN.map((b)=>b.hash);
  const idx=leaves.indexOf(leaf);
  if(idx<0)return{ok:false,leaf,error:'leaf not on chain'};
  const proof=[];
  let layer=leaves.slice();
  let i=idx;
  while(layer.length>1){
    const sib=i%2===0?(layer[i+1]||layer[i]):layer[i-1];
    proof.push({position:i%2===0?'right':'left',hash:sib});
    const next=[];
    for(let k=0;k<layer.length;k+=2){
      const a=layer[k];
      const b=layer[k+1]||layer[k];
      next.push(sha(a+b));
    }
    i=Math.floor(i/2);
    layer=next;
  }
  return{ok:true,leaf,index:idx,root:layer[0],proof};
}
function oracleRefreshAgent(id){
  const scenario=SCENARIOS.find(s=>s.id===id)||SCENARIOS[0];
  const consensus=consensusAgent(scenario.observations);
  return{agent:'ORACLE',...oracleAgent(scenario,consensus),refreshedAt:new Date().toISOString(),fake:'not a live Argus/LME socket'};
}
function dualSourceAgent(id){
  const scenario=SCENARIOS.find(s=>s.id===id)||SCENARIOS[0];
  const consensus=consensusAgent(scenario.observations);
  const quote=scenario.proposed;
  const market=consensus.market;
  const spread=market?((quote-market)/market)*100:0;
  return{agent:'DUAL_SOURCE',id:scenario.id,quote,market:Math.round(market),spreadPct:Number(spread.toFixed(1)),verdict:Math.abs(spread)>=8?'SPREAD_ALERT':'ALIGNED',sources:scenario.observationSources};
}
function intakeAgent(body){
  const id=body.id||('SG-INTK-'+Date.now().toString().slice(-6));
  const observations=Array.isArray(body.observations)?body.observations.map(Number):[body.proposed||0];
  const row={id,desk:body.desk||'metals',title:body.title||'Intake PO',supplier:body.supplier||'Unknown',proposed:Number(body.proposed)||0,observations,observationSources:body.observationSources||['intake'],assumptions:body.assumptions||['ingested via desk'],tenant:'SIEMENS-GAMESA',commodity:body.commodity||'unspecified',po:body.po||id,plant:body.plant||'Hamburg, DE',buyer:body.buyer||'Elena Hartmann',currency:'EUR',due:body.due||new Date().toISOString().slice(0,10),tiers:body.tiers||[],screens:body.screens||{exportPermit:'CLEAR',esg:'MED',financial:'MED',dualUse:'CLEAR'}};
  const existing=SCENARIOS.findIndex(s=>s.id===row.id);
  if(existing>=0)SCENARIOS[existing]=row; else SCENARIOS.push(row);
  return{agent:'INTAKE',accepted:true,scenario:row};
}
function evidencePacket(id){
  return runPipeline(id);
}
const WRITEBACKS=[];
function sapWriteback(id,action){
  const scenario=SCENARIOS.find(s=>s.id===id)||SCENARIOS[0];
  const consensus=consensusAgent(scenario.observations);
  const risk=riskAgent(scenario,consensus);
  const resolved=action==='release'||action==='RELEASE_PO'?'RELEASE':action==='hold'||action==='HOLD_PO'||action==='block'?'HOLD':String(action).toUpperCase();
  const rec={agent:'WRITEBACK',fake:'SAP BAPI analog — no live ECC/S4 call',po:scenario.po,id:scenario.id,action:resolved,recommended:risk.action,accepted:resolved==='HOLD'||resolved==='RELEASE',ts:new Date().toISOString(),doc:'VX-WB-'+sha(scenario.po+resolved+Date.now()).slice(0,10).toUpperCase()};
  WRITEBACKS.push(rec);
  return rec;
}

function send(res, code, body) {
  cors(res);
  let payload;
  try { payload = JSON.stringify(body); }
  catch (err) {
    code = 500;
    payload = JSON.stringify({ error: 'serialize', message: String(err && err.message || err) });
  }
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(payload);
}
function pathOf(req) {
  const raw = (req.url || '/').split('?')[0];
  return raw.replace(/\/+$/, '') || '/';
}
function q(req, key, fallback) {
  const u = req.url || '';
  const i = u.indexOf('?');
  if (i < 0) return fallback;
  const sp = new URLSearchParams(u.slice(i + 1));
  return sp.get(key) || fallback;
}
module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const p = pathOf(req);
  const id = (req.body && (req.body.scenarioId || req.body.id)) || q(req, 'id', 'SG-4782');
  try {
    if (p.endsWith('/health') || p === '/api') {
      return send(res, 200, {
        status: 'healthy',
        product: 'VerityX Sovereign Portal',
        ledger: 'hybrid-pbft',
        agents: AGENTS.map((a) => a.id),
        connectedTo: 'Siemens Gamesa SAP analog + market oracles',
        ts: new Date().toISOString()
      });
    }
    if (p.endsWith('/agents')) return send(res, 200, AGENTS.map((a) => ({ ...a, exists: true, built: true })));
    if (p.endsWith('/alerts')) {
      const alerts = SCENARIOS.flatMap((s) => screenAgent(s).alerts.map((a) => ({ id: s.id, title: s.title, ...a })));
      return send(res, 200, alerts);
    }
    if (p.endsWith('/auth')) {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
      const email = (req.body && req.body.email) || '';
      const password = (req.body && req.body.password) || '';
      const out = authAgent(email, password);
      return send(res, out.ok ? 200 : 401, out);
    }
    if (p.endsWith('/competition')) return send(res, 200, competitionNotes());
    if (p.endsWith('/dual-source')) return send(res, 200, dualSourceAgent(id));
    if (p.endsWith('/intake')) return send(res, 200, intakeAgent(req.body || {}));
    if (p.endsWith('/ledger')) return send(res, 200, ledgerAgent());
    if (p.endsWith('/merkle')) {
      const leaves = CHAIN.map((b) => b.hash);
      const tree = merkleRoot(leaves);
      const leaf = q(req, 'leaf');
      const inclusion = leaf ? merkleInclusion(leaf) : null;
      return send(res, 200, { depth: leaves.length, ...tree, inclusion });
    }
    if (p.endsWith('/oracle')) return send(res, 200, oracleRefreshAgent(id));
    if (p.endsWith('/packet')) return send(res, 200, evidencePacket(id));
    if (p.endsWith('/provenance')) {
      const s = SCENARIOS.find((x) => x.id === id) || SCENARIOS[0];
      return send(res, 200, provenanceAgent(s));
    }
    if (p.endsWith('/scenarios')) {
      const rows = SCENARIOS.map((s) => {
        const c = consensusAgent(s.observations);
        const r = riskAgent(s, c);
        return { ...s, market: Math.round(c.market), confidence: Number(c.confidence.toFixed(3)), verdict: c.verdict, action: r.action, anomalyPct: r.anomalyPct };
      });
      return send(res, 200, rows);
    }
    if (p.endsWith('/verify')) {
      return send(res, 200, runPipeline(id));
    }
    if (p.endsWith('/writeback')) {
      const action = (req.body && req.body.action) || 'block';
      return send(res, 200, sapWriteback(id, action));
    }
    return send(res, 200, { status: 'healthy', router: true, path: p, agents: AGENTS.map((a) => a.id) });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
};
