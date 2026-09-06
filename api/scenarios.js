const { SCENARIOS, consensusAgent } = require('./lib/agents');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const rows = SCENARIOS.map((s) => {
    const c = consensusAgent(s.observations);
    return {
      ...s,
      market: Math.round(c.market),
      confidence: Number(c.confidence.toFixed(3)),
      verdict: c.verdict
    };
  });
  res.status(200).json(rows);
};
