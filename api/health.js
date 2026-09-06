const { cors, AGENTS } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  res.status(200).json({
    status: 'healthy',
    product: 'VerityX Sovereign Portal',
    ledger: 'hybrid-pbft',
    agents: AGENTS.map((a) => a.id),
    connectedTo: 'Siemens Gamesa SAP analog + market oracles',
    ts: new Date().toISOString()
  });
};
