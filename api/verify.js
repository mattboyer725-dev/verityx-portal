const { cors, runPipeline } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const id = (req.body && req.body.scenarioId) || 'SG-4782';
  res.status(200).json(runPipeline(id));
};
