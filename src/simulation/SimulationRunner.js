const { GameEngine } = require('../game/GameEngine');
const { SimulationResult } = require('./SimulationResult');
const { StrategyProfileBuilder } = require('../ai/StrategyProfileBuilder');

class SimulationRunner {
  constructor({ cardDatabase, logger }) {
    this.cardDatabase = cardDatabase;
    this.logger = logger;
  }

  run(decks, options = {}) {
    const games = Number(options.games || 1);
    const result = new SimulationResult(decks.map((deck) => deck.name));
    const profileBuilder = new StrategyProfileBuilder(this.cardDatabase);
    const strategyProfiles = decks.map((deck) => profileBuilder.build(deck));
    result.strategyProfiles = strategyProfiles;

    for (let i = 0; i < games; i += 1) {
      const seed = options.seed ? `${options.seed}-${i}` : undefined;
      const engine = new GameEngine({
        cardDatabase: this.cardDatabase,
        seed,
        maxTurns: options.maxTurns,
        logger: this.logger,
        strategyProfiles,
        debug: Boolean(options.debug)
      });
      result.addGame(engine.run(decks));
    }

    return result;
  }
}

module.exports = { SimulationRunner };
