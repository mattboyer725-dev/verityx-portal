const { cors, SCENARIOS, consensusAgent, riskAgent } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  const rows = SCENARIOS.map((s) => {
    const c = consensusAgent(s.observations);
    const r = riskAgent(s, c);
    return { ...s, market: Math.round(c.market), confidence: Number(c.confidence.toFixed(3)), verdict: c.verdict, action: r.action, anomalyPct: r.anomalyPct };
  });
  res.status(200).json(rows);
};
