const { cors, intakeAgent } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.status(200).json(intakeAgent(req.body || {}));
};
