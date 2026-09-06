const { cors, CHAIN, merkleRoot, merkleInclusion } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  const leaves = CHAIN.map((b) => b.hash);
  const tree = merkleRoot(leaves);
  const leaf = req.query && req.query.leaf;
  const inclusion = leaf ? merkleInclusion(leaf) : null;
  res.status(200).json({ depth: leaves.length, ...tree, inclusion });
};
