const { sapWriteback } = require('./lib/agents');
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const id = (req.body && req.body.scenarioId) || 'SG-4782';
  const action = (req.body && req.body.action) || 'block';
  res.status(200).json(sapWriteback(id, action));
};
