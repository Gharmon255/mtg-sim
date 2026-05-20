class SimulationResult {
  constructor(deckNames) {
    this.deckNames = deckNames;
    this.games = [];
  }

  addGame(game) {
    this.games.push(game);
  }
}

module.exports = { SimulationResult };
