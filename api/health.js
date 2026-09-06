module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'healthy',
    product: 'VerityX Sovereign Portal',
    ledger: 'hybrid-pbft',
    agents: ['INGEST', 'CONSENSUS', 'RISK', 'SEAL'],
    connectedTo: 'Siemens Gamesa SAP analog + market oracles',
    ts: new Date().toISOString()
  });
};
