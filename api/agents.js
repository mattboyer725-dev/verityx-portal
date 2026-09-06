const { cors, AGENTS } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  res.status(200).json(AGENTS.map((a) => ({ ...a, exists: true, built: true })));
};
