const { CardDatabase } = require('../cards/CardDatabase');
const { DeckImporter } = require('../decks/DeckImporter');
const { createLogger } = require('../utils/logger');

function createContext(args) {
  const logger = createLogger(args.logLevel || args.log || process.env.LOG_LEVEL);
  const cardDatabase = new CardDatabase({ filePath: args.cards }).load();
  const importer = new DeckImporter();
  return { logger, cardDatabase, importer };
}

module.exports = { createContext };
