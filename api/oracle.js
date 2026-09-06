const { cors, oracleRefreshAgent } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = (req.body && req.body.scenarioId) || (req.query && req.query.id) || 'SG-4782';
  res.status(200).json(oracleRefreshAgent(id));
};
