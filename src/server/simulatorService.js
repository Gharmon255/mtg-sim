const fs = require('fs');
const path = require('path');
const { CardDatabase } = require('../cards/CardDatabase');
const { DeckImporter } = require('../decks/DeckImporter');
const { serializeDeck } = require('../decks/DeckSerializer');
const { DeckValidator } = require('../decks/DeckValidator');
const { DeckAnalyzer } = require('../decks/DeckAnalyzer');
const { SimulationRunner } = require('../simulation/SimulationRunner');
const { ReportGenerator } = require('../simulation/ReportGenerator');
const { createLogger } = require('../utils/logger');
const { CardHydrator } = require('../cards/CardHydrator');
const { PreconCatalog } = require('../precons/PreconCatalog');
const { WizardsDecklistFetcher } = require('../precons/WizardsDecklistFetcher');
const { WizardsDeckSearch } = require('../precons/WizardsDeckSearch');
const { slugify } = require('../precons/PreconCatalog');

const ROOT = process.cwd();
const DECKS_DIR = path.join(ROOT, 'decks');

function createSimulatorService() {
  const cardDatabase = new CardDatabase({ filePath: path.join(ROOT, 'data/cards.starter.json') }).load();
  const importer = new DeckImporter();
  const logger = createLogger('silent');

  function listDecks() {
    cardDatabase.load();
    return walkDeckFiles(DECKS_DIR).map((filePath) => {
      const id = path.relative(DECKS_DIR, filePath).replace(/\\/g, '/');
      const deck = importer.importFromFile(filePath);
      const commanderName = deck.commanders[0] && deck.commanders[0].name;
      const commanderCard = commanderName ? cardDatabase.get(commanderName) : null;
      return {
        id,
        name: path.basename(filePath, '.txt'),
        group: id.includes('/') ? id.split('/')[0] : 'samples',
        commanderName,
        commanderImage: commanderCard && commanderCard.imageUris ? commanderCard.imageUris.artCrop || commanderCard.imageUris.normal || commanderCard.imageUris.small : null,
        content: fs.readFileSync(filePath, 'utf8')
      };
    });
  }

  async function importDeckText(input) {
    const name = input.name || 'Imported Deck';
    const text = input.text || '';
    const deck = importer.importFromText(text, { name, source: 'pasted-list' });
    if (deck.errors.length) {
      return { deck, saved: false, errors: deck.errors };
    }
    const outputDir = path.join(DECKS_DIR, 'imported');
    fs.mkdirSync(outputDir, { recursive: true });
    const fileName = `${slugify(name)}.txt`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, serializeDeck(deck), 'utf8');
    const hydrator = new CardHydrator({
      root: ROOT,
      timeoutMs: Number(input.timeoutMs || 10000),
      retries: Number(input.retries || 2),
      delayMs: Number(input.delayMs || 150),
      logger
    });
    const hydration = await hydrator.hydrateDeck(deck, {
      refreshAll: Boolean(input.refreshAll)
    });
    cardDatabase.load();
    return {
      deck,
      saved: true,
      deckId: `imported/${fileName}`,
      filePath,
      hydration
    };
  }

  function deleteDeck(input) {
    const deckId = String(input.deckId || '');
    const filePath = resolveDeckPath(deckId);
    fs.unlinkSync(filePath);
    return { deleted: true, deckId };
  }

  function loadDeck(input, fallbackName) {
    if (!input) {
      throw new Error('Missing deck input.');
    }

    if (input.text) {
      return importer.importFromText(input.text, {
        name: input.name || fallbackName || 'Custom Deck',
        source: 'web-input'
      });
    }

    const filePath = resolveDeckPath(String(input.id || input.name || input));
    return importer.importFromFile(filePath);
  }

  function listPrecons() {
    const catalog = new PreconCatalog();
    const importedDecks = new Set(listDecks().map((deck) => deck.id));
    return {
      updatedAt: catalog.load().updatedAt,
      precons: catalog.listDecks().map((precon) => ({
        ...precon,
        deckId: `precons/${precon.slug}.txt`,
        imported: importedDecks.has(`precons/${precon.slug}.txt`)
      }))
    };
  }

  async function importPrecons() {
    const fetcher = new WizardsDecklistFetcher();
    return { results: await fetcher.importLatest({ refreshPlaceholders: false }) };
  }

  async function searchWizards(query) {
    const search = new WizardsDeckSearch();
    return { results: await search.search(query, { limit: 8 }) };
  }

  async function importWizards(input) {
    const fetcher = new WizardsDecklistFetcher();
    const results = await fetcher.importFromUrl(input.url, {
      limit: input.limit,
      cardLimit: input.cardLimit || 10,
      skipCardCache: Boolean(input.skipCardCache),
      refreshPlaceholders: false
    });
    cardDatabase.load();
    return { results };
  }

  async function hydrateCards(input = {}) {
    const deckFiles = input.deck
      ? [resolveDeckPath(String(input.deck.id || input.deck.name || input.deck))]
      : walkDeckFiles(DECKS_DIR);
    const decks = deckFiles.map((filePath) => importer.importFromFile(filePath));
    const hydrator = new CardHydrator({
      root: ROOT,
      timeoutMs: Number(input.timeoutMs || 10000),
      retries: Number(input.retries || 2),
      delayMs: Number(input.delayMs || 150),
      logger
    });
    const hydration = await hydrator.hydrateAllDecks(decks, {
      refreshAll: Boolean(input.refreshAll)
    });
    cardDatabase.load();
    return { hydration };
  }

  function validate(input) {
    cardDatabase.load();
    const deck = loadDeck(input.deck || input, 'Deck');
    const validator = new DeckValidator(cardDatabase);
    return {
      deck,
      result: validator.validate(deck)
    };
  }

  function analyze(input) {
    cardDatabase.load();
    const deck = loadDeck(input.deck || input, 'Deck');
    const analyzer = new DeckAnalyzer(cardDatabase);
    return {
      deck,
      analysis: analyzer.analyze(deck)
    };
  }

  function simulate(input) {
    cardDatabase.load();
    const primary = loadDeck(input.deck, 'Primary Deck');
    const opponents = (input.opponents || []).map((opponent, index) => loadDeck(opponent, `Opponent ${index + 1}`));
    const decks = [primary].concat(opponents);
    const runner = new SimulationRunner({ cardDatabase, logger });
    const result = runner.run(decks, {
      games: Number(input.games || 25),
      seed: input.seed || undefined,
      maxTurns: Number(input.maxTurns || 14)
    });
    const reporter = new ReportGenerator({ cardDatabase, decks });
    const report = reporter.generate(result);
    return {
      report,
      text: reporter.toText(report)
    };
  }

  return {
    listDecks,
    importDeckText,
    deleteDeck,
    listPrecons,
    importPrecons,
    searchWizards,
    importWizards,
    hydrateCards,
    validate,
    analyze,
    simulate
  };
}

function resolveDeckPath(deckId) {
  const fileName = deckId.endsWith('.txt') ? deckId : `${deckId}.txt`;
  const filePath = path.resolve(DECKS_DIR, fileName);
  if (!filePath.startsWith(path.resolve(DECKS_DIR)) || !fs.existsSync(filePath)) {
    throw new Error(`Deck not found: ${deckId}`);
  }
  return filePath;
}

function walkDeckFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkDeckFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith('.txt')) return [entryPath];
      return [];
    })
    .sort();
}

module.exports = { createSimulatorService };
