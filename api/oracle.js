const { oracleRefreshAgent } = require('./lib/agents');
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = (req.body && req.body.scenarioId) || (req.query && req.query.id) || 'SG-4782';
  res.status(200).json(oracleRefreshAgent(id));
};
