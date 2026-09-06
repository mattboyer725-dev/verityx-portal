const { dualSourceAgent } = require('./lib/agents');
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const id = (req.query && req.query.id) || 'SG-4782';
  res.status(200).json(dualSourceAgent(id));
};
