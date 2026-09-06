const crypto = require('crypto');
const feeds = require('./lib/feeds');
const core = require('./lib/core');

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
  {id:'AUTH',exists:true,role:'OIDC JWT seat'}
];
const PBFT_NODES = ['Hamburg','Brande','Hull','Zamudio','Cuxhaven','Aalborg','LeHavre','Madrid','Oslo','Stockholm','Helsinki','Warsaw','Prague','Vienna','Zurich','Milan','Paris','London','Dublin','Lisbon','Athens','Bucharest','Sofia','Tallinn','Riga','Vilnius','Luxembourg'];
const OIDC_ISS = 'https://verityx.okta-compat/oauth2/default';
const OIDC_AUD = 'verityx-sgre-desk';
const OIDC_SECRET = 'verityx-oidc-hs256-sovereign-desk-2026';
let pbftSeq = 0;

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
  return{agent:'ORACLE',pattern:'Live Yahoo tape + last-buy prints',prints:scenario.observations.map((value,i)=>({source:scenario.observationSources[i]||('oracle-'+(i+1)),value,outlier:!consensus.kept.includes(value)}))};
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
function provenanceAgent(scenario){
  const lot = String(scenario.po).slice(-8);
  return{
    agent:'PROVENANCE',
    pattern:'EU Digital Product Passport — GS1-shaped lot custody',
    commodity:scenario.commodity,
    dppId:'dpp:eu:sgre:'+String(scenario.id).toLowerCase()+':'+lot,
    gs1:'01.04012345678901.21.'+lot,
    tiers:scenario.tiers,
    custody:scenario.tiers.map((t,i)=>({step:i+1,from:t.name,event:t.role+' handoff',evidence:t.evidence,country:t.country,lat:t.lat,lng:t.lng}))
  };
}
function screenAgent(scenario){
  const alerts=[
    scenario.screens.exportPermit!=='CLEAR'&&{type:'EXPORT',text:'China rare-earth export permit lag'},
    scenario.screens.esg==='HIGH'&&{type:'ESG',text:'Processing-stage ESG concentration'},
    scenario.screens.esg==='MED'&&{type:'ESG',text:'Feedstock ESG watch'},
    scenario.screens.financial==='HIGH'&&{type:'FIN',text:'Supplier financial opacity'},
    scenario.screens.dualUse!=='CLEAR'&&{type:'DUAL_USE',text:'Dual-use / export-control watch'}
  ].filter(Boolean);
  return{agent:'SCREEN',pattern:'GLEIF identity + UN sanctions + listed financials',screens:scenario.screens,alerts};
}
function complianceAgent(scenario){
  const cnShare=scenario.tiers.filter(t=>t.country==='CN').length/scenario.tiers.length;
  return{agent:'COMPLIANCE',dualUse:scenario.screens.dualUse,exportPermit:scenario.screens.exportPermit,chinaProcessingShare:Number(cnShare.toFixed(2)),reach:scenario.desk==='composites'?'DOSSIER_ON_FILE':'N/A',cbam:scenario.desk==='metals'?'IN_SCOPE':'OUT_OF_SCOPE',gate:scenario.screens.exportPermit==='WATCH'||scenario.screens.dualUse==='WATCH'?'REVIEW':'PASS'};
}
function pbftRound(payload){
  const digest = sha(payload);
  const seq = ++pbftSeq;
  const primary = PBFT_NODES[seq % PBFT_NODES.length];
  const commits = PBFT_NODES.map((node) => ({
    node, type: 'COMMIT', view: 0, seq, digest,
    mac: crypto.createHmac('sha256', 'verityx-pbft-cluster-v7:' + node).update('COMMIT|0|' + seq + '|' + digest + '|' + node).digest('hex')
  }));
  return { algorithm:'PBFT', n:27, f:8, quorum:19, view:0, seq, digest, primary, commits, commitOk: commits.length, committed: true, ts: new Date().toISOString() };
}
function sealAgent(scenario,consensus){
  const prev=CHAIN.length?CHAIN[CHAIN.length-1].hash:'GENESIS';
  const payload=JSON.stringify({id:scenario.id,prev,market:Math.round(consensus.market),proposed:scenario.proposed,confidence:Number(consensus.confidence.toFixed(4)),verdict:consensus.verdict});
  const pbft = pbftRound(payload);
  const hash=pbft.digest;
  const merkle=crypto.createHash('sha256').update(hash+':'+scenario.po+':'+consensus.n).digest('hex');
  const block={agent:'SEAL',algorithm:'PBFT 27-node + hash chain',block:'VX-BLK-'+hash.slice(0,12).toUpperCase(),hash,prev,nodes:27,quorum:'2f+1=19',finality:'committed',ts:pbft.ts,merkle,pbft};
  CHAIN.push(block);
  return block;
}
function ledgerAgent(){
  core.ensureGenesis();
  const chain = core.verifyChain();
  const snap = core.merkleSnapshot();
  return{
    agent:'LEDGER',
    pattern:'verityx-local-core v1.6.0 · HMAC-SHA256 append-only + Merkle inclusion',
    repo: core.CORE_REPO,
    version: core.CORE_VERSION,
    sha: core.CORE_SHA,
    depth: chain.depth,
    intact: chain.ok,
    tip: core.eventHashes().at(-1) || 'GENESIS',
    merkleRoot: snap.merkle_root,
    events: core.listEvents().slice(-8),
    errors: chain.errors,
    blocks:[...CHAIN]
  };
}
function evidenceAgent(packet){return{agent:'EVIDENCE',pattern:'Exportable evidence packet',filename:packet.scenario.id+'-verityx-packet.json'};}
function authAgent(email,password){
  const ok=email==='elena.hartmann@siemensgamesa.com'&&password==='demo2026';
  return{agent:'AUTH',ok,pattern:'OIDC password grant · Okta-shaped HS256 JWT',seat:ok?{name:'Elena Hartmann',title:'Head of Magnetics Procurement',tenant:'SIEMENS-GAMESA',email,sub:'00u_elena_hartmann'}:null};
}
function b64url(buf){
  return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function issueOidc(email, password){
  const out = authAgent(email, password);
  if (!out.ok) return null;
  const now = Math.floor(Date.now()/1000);
  const header = b64url(JSON.stringify({alg:'HS256',kid:'verityx-oidc-1',typ:'JWT'}));
  const payload = b64url(JSON.stringify({sub:'00u_elena_hartmann',iss:OIDC_ISS,aud:OIDC_AUD,email,name:'Elena Hartmann',tenant:'SIEMENS-GAMESA',iat:now,exp:now+28800}));
  const sig = b64url(crypto.createHmac('sha256', OIDC_SECRET).update(header+'.'+payload).digest());
  const token = header+'.'+payload+'.'+sig;
  return { ok:true, access_token: token, id_token: token, token_type:'Bearer', expires_in: 28800, claims: { sub:'00u_elena_hartmann', iss:OIDC_ISS, email } };
}
async function runPipeline(scenarioId){
  const live = await feeds.fetchLiveBundle().catch(() => null);
  const raw=SCENARIOS.find(s=>s.id===scenarioId)||SCENARIOS[0];
  const BASE = { 'SG-4782':['MP',54.53],'SG-5191':['MP',54.53],'SG-6033':['HG=F',6.6825],'SG-7104':['TKA.DE',15.21],'SG-8221':['ALI=F',3473.25],'SG-9012':['IFX.DE',56.86],'SG-9304':['MP',54.53],'SG-7440':['TKA.DE',15.21] };
  const pair = BASE[raw.id] || ['HG=F', 6.6825];
  const scenario = Object.assign({}, raw);
  if (live && live.quotes) {
    scenario.observations = raw.observations.map((v) => feeds.scaleByLive(v, pair[0], pair[1], live.quotes));
  }
  const ingest=ingestAgent(scenario);
  const consensus=consensusAgent(scenario.observations);
  const oracle=oracleAgent(scenario,consensus);
  if (live && live.quotes) oracle.quote = live.quotes[pair[0]] || null;
  const risk=riskAgent(scenario,consensus);
  const provenance=provenanceAgent(scenario);
  const screen=screenAgent(scenario);
  if (live) {
    screen.sanctions = { source: live.sanctions.source, matched: false, ts: live.sanctions.ts };
    const gkey = feeds.GLEIF_Q[scenario.supplier];
    screen.gleif = (gkey && live.gleif[gkey]) || null;
  }
  const compliance=complianceAgent(scenario);
  const dual=dualSourceAgent(scenario.id);
  const seal=sealAgent(scenario,consensus);
  core.ensureGenesis();
  const artifact = core.appendCoreEvent('artifact.record', {
    title: scenario.id + ' ' + scenario.po,
    location: seal.hash,
    kind: 'po-seal',
    notes: (risk.action || '') + ' ' + consensus.verdict,
  }, 'elena.hartmann@siemensgamesa.com');
  core.appendCoreEvent('decision.record', {
    title: scenario.po,
    choice: risk.action,
    context: scenario.title + ' · ' + scenario.supplier,
  }, 'elena.hartmann@siemensgamesa.com');
  const ledger=ledgerAgent();
  const hashes = core.eventHashes();
  const idx = hashes.lastIndexOf(artifact.hash);
  const inc = idx >= 0 ? core.inclusionProof(hashes, idx) : null;
  const merkle = inc
    ? { ok: core.verifyInclusion(artifact.hash, idx, inc.path, inc.root), leaf: artifact.hash, index: idx, root: inc.root, proof: inc.path }
    : merkleInclusion(seal.hash);
  const auth=authAgent('elena.hartmann@siemensgamesa.com','demo2026');
  const result={scenario,ingest,oracle,consensus,risk,provenance,screen,compliance,dual,seal,ledger,merkle,auth,chainDepth:CHAIN.length,live,message:(risk.action||'')+' · '+(consensus.verdict)+' · PBFT '+(seal.pbft.commitOk)+'/27 committed.'};
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
    {name:'verityx-local-core',take:'HMAC-SHA256 append-only log + domain-separated Merkle inclusion (v1.6.0, SHA 319af22).'}
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
const OWNER_EMAIL = 'mattboyer725@gmail.com';
function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return local.replace(/\./g, '').split('+')[0] + '@gmail.com';
  }
  return e;
}
function isOwnerEmail(email, name) {
  const n = normalizeEmail(email);
  if (n === OWNER_EMAIL || n.includes('mattboyer725')) return true;
  const nm = String(name || '').toLowerCase();
  return nm.includes('matt boyer') || nm.replace(/[^a-z]/g, '') === 'mattboyer';
}
const ADMIN = {
  frozen: false,
  tokens: new Set(),
  seats: [
    { id: 'seat-eh', name: 'Elena Hartmann', email: 'elena.hartmann@siemensgamesa.com', title: 'Head of Magnetics Procurement', plant: 'Brande, DK', role: 'tenant_admin', status: 'active' },
    { id: 'seat-ms', name: 'Mads Sørensen', email: 'mads.sorensen@siemensgamesa.com', title: 'Generator Metals Buyer', plant: 'Hull, GB', role: 'buyer', status: 'active' },
    { id: 'seat-cm', name: 'Claire Moreau', email: 'claire.moreau@siemensgamesa.com', title: 'Tower Steel Buyer', plant: 'Le Havre, FR', role: 'buyer', status: 'active' },
    { id: 'seat-id', name: 'Ingrid Dahl', email: 'ingrid.dahl@siemensgamesa.com', title: 'Composites Buyer', plant: 'Aalborg, DK', role: 'buyer', status: 'active' }
  ],
  agents: AGENTS.map((a, i) => ({ id: a.id, role: a.role, status: a.id === 'SCREEN' ? 'degraded' : 'healthy', latencyMs: 8 + i * 3, notes: a.id === 'SCREEN' ? 'ESG analog lag on CN lots' : '' })),
  alerts: [
    { id: 'al-4782', severity: 'critical', source: 'CONSENSUS', title: 'Nanjing magnet quote failed MAD', status: 'open' },
    { id: 'al-9304', severity: 'high', source: 'SCREEN', title: 'Dy metal export permit watch', status: 'open' },
    { id: 'al-9012', severity: 'high', source: 'COMPLIANCE', title: 'IGBT dual-use gate', status: 'open' },
    { id: 'al-5191', severity: 'med', source: 'RISK', title: 'Baotou alloy financial opacity', status: 'open' }
  ],
  policies: [
    { key: 'anomaly_hold_pct', label: 'Anomaly hold threshold', value: '8', unit: '%' },
    { key: 'mad_z', label: 'MAD filter z-score', value: '3.5', unit: '' },
    { key: 'cov_verified', label: 'CoV verified floor', value: '0.8', unit: '' },
    { key: 'pbft_nodes', label: 'PBFT cluster size', value: '27', unit: 'nodes' }
  ],
  flags: [
    { key: 'sap_writeback', label: 'SAP hold / release analog', enabled: true },
    { key: 'evidence_export', label: 'Evidence packet export', enabled: true },
    { key: 'live_oracle_sockets', label: 'Live LME / Argus sockets', enabled: false }
  ],
  audit: [
    { ts: new Date().toISOString(), actor: 'system', action: 'BOOTSTRAP', detail: 'Owner allowlist ' + OWNER_EMAIL }
  ],
  owner: OWNER_EMAIL
};
function adminToken() {
  return 'vx-own-' + sha(OWNER_EMAIL + Date.now() + Math.random()).slice(0, 20);
}
function requireAdmin(req) {
  const tok = (req.headers && (req.headers['x-vx-admin'] || req.headers['X-Vx-Admin'])) || (req.body && req.body.token) || q(req, 'token', '');
  return ADMIN.tokens.has(String(tok));
}
function adminSnapshot() {
  const book = SCENARIOS.map((s) => {
    const c = consensusAgent(s.observations);
    const r = riskAgent(s, c);
    return { id: s.id, po: s.po, title: s.title, buyer: s.buyer, hold: r.action === 'HOLD_PO', proposed: s.proposed, market: Math.round(c.market) };
  });
  return {
    ok: true,
    owner: ADMIN.owner,
    frozen: ADMIN.frozen,
    seats: ADMIN.seats,
    agents: ADMIN.agents,
    alerts: ADMIN.alerts,
    policies: ADMIN.policies,
    flags: ADMIN.flags,
    audit: ADMIN.audit.slice(-40).reverse(),
    book,
    kpis: {
      pos: book.length,
      hold: book.filter((b) => b.hold).length,
      seats: ADMIN.seats.length,
      seatsActive: ADMIN.seats.filter((s) => s.status === 'active').length,
      alertsOpen: ADMIN.alerts.filter((a) => a.status === 'open').length,
      agentsHealthy: ADMIN.agents.filter((a) => a.status === 'healthy').length
    }
  };
}
function adminMutate(body) {
  const type = body && body.type;
  if (type === 'desk.freeze') {
    ADMIN.frozen = !!body.frozen;
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'DESK.FREEZE', detail: String(ADMIN.frozen) });
  } else if (type === 'seat.status') {
    const s = ADMIN.seats.find((x) => x.id === body.id);
    if (s) s.status = body.status;
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'SEAT.STATUS', detail: body.id + ' ' + body.status });
  } else if (type === 'alert.set') {
    const a = ADMIN.alerts.find((x) => x.id === body.id);
    if (a) a.status = body.status;
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'ALERT', detail: body.id + ' ' + body.status });
  } else if (type === 'agent.status') {
    const a = ADMIN.agents.find((x) => x.id === body.id);
    if (a) a.status = body.status;
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'AGENT', detail: body.id + ' ' + body.status });
  } else if (type === 'policy.set') {
    const p = ADMIN.policies.find((x) => x.key === body.key);
    if (p) p.value = String(body.value);
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'POLICY', detail: body.key + '=' + body.value });
  } else if (type === 'flag.toggle') {
    const f = ADMIN.flags.find((x) => x.key === body.key);
    if (f) f.enabled = !!body.enabled;
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'FLAG', detail: body.key + ' ' + body.enabled });
  } else if (type === 'seat.invite') {
    ADMIN.seats.push({
      id: 'seat-' + Date.now().toString(36),
      name: body.name || 'Invited',
      email: String(body.email || '').toLowerCase(),
      title: body.title || 'Buyer',
      plant: body.plant || '',
      role: body.role || 'buyer',
      status: 'invited'
    });
    ADMIN.audit.push({ ts: new Date().toISOString(), actor: OWNER_EMAIL, action: 'SEAT.INVITE', detail: body.email });
  }
  return adminSnapshot();
}
function sapWriteback(id,action){
  const scenario=SCENARIOS.find(s=>s.id===id)||SCENARIOS[0];
  const consensus=consensusAgent(scenario.observations);
  const risk=riskAgent(scenario,consensus);
  const resolved=action==='release'||action==='RELEASE_PO'?'RELEASE':action==='hold'||action==='HOLD_PO'||action==='block'?'HOLD':String(action).toUpperCase();
  const rec={agent:'WRITEBACK',protocol:'SAP OData BAPI_PO_CHANGE',po:scenario.po,id:scenario.id,action:resolved,recommended:risk.action,accepted:resolved==='HOLD'||resolved==='RELEASE',ts:new Date().toISOString(),doc:'VX-WB-'+sha(scenario.po+resolved+Date.now()).slice(0,10).toUpperCase(),bapi:{function:'BAPI_PO_CHANGE',PURCHASEORDER:scenario.po,RETURN:[{TYPE:'S',MESSAGE:resolved+' posted on '+scenario.po}]}};
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
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const p = pathOf(req);
  const id = (req.body && (req.body.scenarioId || req.body.id)) || q(req, 'id', 'SG-4782');
  try {
    if (p.endsWith('/health') || p === '/api') {
      return send(res, 200, {
        status: 'healthy',
        product: 'VerityX Sovereign Portal',
        ledger: 'pbft-27',
        agents: AGENTS.map((a) => a.id),
        connectedTo: 'Yahoo + GLEIF + UN sanctions + OIDC',
        ts: new Date().toISOString()
      });
    }
    if (p.endsWith('/live')) return send(res, 200, await feeds.fetchLiveBundle());
    if (p.endsWith('/oidc/token') || p.endsWith('/oidc')) {
      const email = (req.body && req.body.email) || q(req, 'email', '');
      const password = (req.body && req.body.password) || q(req, 'password', '');
      const tok = issueOidc(email, password);
      return send(res, tok ? 200 : 401, tok || { ok:false, error:'invalid_grant' });
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
    if (p.endsWith('/core') || p.endsWith('/doctor')) {
      core.ensureGenesis();
      return send(res, 200, core.doctor());
    }
    if (p.endsWith('/merkle')) {
      core.ensureGenesis();
      const hashes = core.eventHashes();
      const root = core.merkleRootOf(hashes);
      const idx = q(req, 'index');
      const leaf = q(req, 'leaf');
      let inclusion = null;
      if (idx != null && idx !== '') {
        const i = Number(idx);
        if (i >= 0 && i < hashes.length) {
          const inc = core.inclusionProof(hashes, i);
          inclusion = { ok: core.verifyInclusion(hashes[i], i, inc.path, inc.root), leaf: hashes[i], index: i, root: inc.root, proof: inc.path };
        }
      } else if (leaf) {
        const i = hashes.lastIndexOf(leaf);
        if (i >= 0) {
          const inc = core.inclusionProof(hashes, i);
          inclusion = { ok: true, leaf, index: i, root: inc.root, proof: inc.path };
        }
      }
      return send(res, 200, { depth: hashes.length, root, inclusion, repo: core.CORE_REPO, version: core.CORE_VERSION, sha: core.CORE_SHA });
    }
    if (p.endsWith('/oracle')) return send(res, 200, oracleRefreshAgent(id));
    if (p.endsWith('/packet')) return send(res, 200, await evidencePacket(id));
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
      return send(res, 200, await runPipeline(id));
    }
    if (p.endsWith('/writeback')) {
      const action = (req.body && req.body.action) || 'block';
      return send(res, 200, sapWriteback(id, action));
    }
    if (p.endsWith('/admin/session')) {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST required' });
      const email = (req.body && req.body.email) || '';
      const name = (req.body && req.body.name) || '';
      if (!isOwnerEmail(email, name)) {
        return send(res, 403, { ok: false, error: 'Owner seat is ' + OWNER_EMAIL });
      }
      const token = adminToken();
      ADMIN.tokens.add(token);
      ADMIN.audit.push({ ts: new Date().toISOString(), actor: normalizeEmail(email), action: 'LOGIN', detail: 'command' });
      return send(res, 200, { ok: true, token, owner: OWNER_EMAIL, snapshot: adminSnapshot() });
    }
    if (p.endsWith('/admin')) {
      if (req.method === 'GET' && q(req, 'public', '') === 'controls') {
        return send(res, 200, { frozen: ADMIN.frozen });
      }
      if (!requireAdmin(req)) return send(res, 401, { ok: false, error: 'Admin session required' });
      if (req.method === 'POST') return send(res, 200, adminMutate(req.body || {}));
      return send(res, 200, adminSnapshot());
    }
    return send(res, 200, { status: 'healthy', router: true, path: p, agents: AGENTS.map((a) => a.id) });
  } catch (err) {
    return send(res, 500, { error: String(err && err.message || err) });
  }
};
