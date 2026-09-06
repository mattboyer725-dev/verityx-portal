const { SCENARIOS, provenanceAgent } = require('./lib/agents');
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = (req.query && req.query.id) || 'SG-4782';
  const s = SCENARIOS.find((x) => x.id === id) || SCENARIOS[0];
  res.status(200).json(provenanceAgent(s));
};
