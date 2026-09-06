const { SCENARIOS, screenAgent } = require('./lib/agents');
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const alerts = SCENARIOS.flatMap((s) => screenAgent(s).alerts.map((a) => ({ id: s.id, title: s.title, ...a })));
  res.status(200).json(alerts);
};
