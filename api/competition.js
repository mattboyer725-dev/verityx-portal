const { cors, competitionNotes } = require('./lib/agents');
module.exports = (req, res) => {
  cors(res);
  res.status(200).json(competitionNotes());
};
