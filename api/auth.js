const { cors, authAgent } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const email = (req.body && req.body.email) || '';
  const password = (req.body && req.body.password) || '';
  const out = authAgent(email, password);
  res.status(out.ok ? 200 : 401).json(out);
};
