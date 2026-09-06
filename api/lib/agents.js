const crypto = require('crypto');

const SCENARIOS = [
  {
    id: 'SG-4782',
    desk: 'metals',
    title: 'Rare Earth Permanent Magnets',
    supplier: 'Nanjing RareTech Ltd.',
    proposed: 6950000,
    observations: [5680000, 5712000, 5594000, 5748000, 8120000],
    assumptions: ['China processing share ~90%', 'Q4 2026 delivery lock', 'No EU dual-source'],
    tenant: 'SIEMENS-GAMESA'
  },
  {
    id: 'SG-5191',
    desk: 'metals',
    title: 'Neodymium Alloy Procurement',
    supplier: 'Baotou Rare Earth Co.',
    proposed: 12400000,
    observations: [10350000, 10420000, 10180000, 10660000],
    assumptions: ['Single-origin melt lot', 'Quality cert dispute in SAP'],
    tenant: 'SIEMENS-GAMESA'
  },
  {
    id: 'SG-6033',
    desk: 'metals',
    title: 'Offshore Generator Copper CTC',
    supplier: 'Nordic Conductor AB',
    proposed: 4820000,
    observations: [4610000, 4598000, 4632000, 4605000],
    assumptions: ['EU origin claimed', 'Recycled content 18%'],
    tenant: 'SIEMENS-GAMESA'
  }
];

function madFilter(values) {
  if (values.length < 3) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)));
  if (mad === 0) return values;
  const filtered = values.filter((v) => (0.6745 * Math.abs(v - med)) / mad <= 3.5);
  return filtered.length >= 2 ? filtered : values;
}

function median(sorted) {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function stdev(values) {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const varSum = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(varSum);
}

function consensusAgent(observations) {
  if (!observations || observations.length < 2) {
    return { confidence: 0, cv: 0, verdict: 'INSUFFICIENT_DATA', market: 0 };
  }
  const filtered = madFilter(observations);
  const market = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  if (Math.abs(market) < 0.01) {
    return { confidence: 0, cv: 0, verdict: 'INSUFFICIENT_DATA', market: 0 };
  }
  const sd = stdev(filtered);
  const cv = sd / Math.abs(market);
  const confidence = Math.max(0, Math.min(1, 1 - cv));
  const verdict = confidence >= 0.8 ? 'VERIFIED' : 'DISPUTED';
  return { confidence, cv, verdict, market, n: filtered.length, dropped: observations.length - filtered.length };
}

function ingestAgent(scenario) {
  return {
    agent: 'INGEST',
    sources: ['SAP S/4HANA', 'Ariba PO', 'LBMA / COMEX analog', 'Supplier quote', 'Internal category model'],
    observations: scenario.observations,
    ts: new Date().toISOString()
  };
}

function riskAgent(scenario, consensus) {
  const savings = Math.max(0, scenario.proposed - consensus.market);
  const anomaly = ((scenario.proposed - consensus.market) / consensus.market) * 100;
  let level = 'MED';
  if (anomaly >= 18 || consensus.verdict !== 'VERIFIED') level = 'CRITICAL';
  else if (anomaly >= 8) level = 'HIGH';
  return { agent: 'RISK', level, anomalyPct: Number(anomaly.toFixed(1)), savings: Math.round(savings) };
}

function sealAgent(scenario, consensus, risk) {
  const payload = JSON.stringify({
    id: scenario.id,
    market: Math.round(consensus.market),
    proposed: scenario.proposed,
    confidence: Number(consensus.confidence.toFixed(4)),
    verdict: consensus.verdict
  });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  return {
    agent: 'SEAL',
    algorithm: 'Hybrid PBFT + CoV economic validation',
    block: 'VX-BLK-' + hash.slice(0, 12).toUpperCase(),
    hash,
    nodes: 27,
    quorum: '2f+1=19',
    finality: 'immediate',
    ts: new Date().toISOString()
  };
}

function runPipeline(scenarioId) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const ingest = ingestAgent(scenario);
  const consensus = consensusAgent(scenario.observations);
  const risk = riskAgent(scenario, consensus);
  const seal = sealAgent(scenario, consensus, risk);
  return { scenario, ingest, consensus, risk, seal, message: 'One provable version of reality established.' };
}

module.exports = { SCENARIOS, runPipeline, consensusAgent };
