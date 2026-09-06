const { cors, evidencePacket } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  const id = (req.query && req.query.id) || 'SG-4782';
  res.status(200).json(evidencePacket(id));
};
