const fs = require('fs');
const path = require('path');
const { listValue } = require('../args');
const { DeckImporter } = require('../../decks/DeckImporter');
const { CardHydrator } = require('../../cards/CardHydrator');

async function hydrateCardsCommand(args = {}, context = {}) {
  const root = process.cwd();
  const importer = new DeckImporter();
  const allDeckFiles = listValue(args.deck).length
    ? listValue(args.deck).map((deckPath) => path.resolve(root, deckPath))
    : walkDeckFiles(path.join(root, 'decks'));
  const offset = Number(args.offset || 0);
  const limit = Number(args.limit || allDeckFiles.length);
  const deckFiles = allDeckFiles.slice(offset, offset + limit);

  if (!deckFiles.length) {
    console.log('No deck files found to hydrate.');
    return 0;
  }

  const decks = deckFiles.map((filePath) => importer.importFromFile(filePath));
  const hydrator = new CardHydrator({
    root,
    timeoutMs: Number(args.timeoutMs || 10000),
    retries: Number(args.retries || 2),
    delayMs: Number(args.delayMs || 150),
    logger: context.logger || console
  });

  console.log(`Hydrating card data for ${decks.length} deck(s).`);
  if (!listValue(args.deck).length) {
    console.log(`Batch: ${offset + 1}-${offset + deckFiles.length} of ${allDeckFiles.length} saved deck(s).`);
  }
  const summary = await hydrator.hydrateAllDecks(decks, {
    refreshAll: Boolean(args.refreshAll)
  });

  console.log(`Scryfall checked ${summary.lookedUp} card(s).`);
  console.log(`Found ${summary.found} card(s), including ${summary.fuzzyFound} fuzzy match(es).`);
  console.log(`Skipped ${summary.skippedExisting} card(s) already backed by real data.`);
  console.log(`Deferred ${summary.deferred || 0} lookup(s) because Scryfall was unavailable or rate limited.`);
  console.log(`Left ${summary.placeholders} unresolved placeholder(s).`);

  if (summary.unresolved.length) {
    console.log('');
    console.log('Unresolved cards:');
    for (const name of summary.unresolved.slice(0, 50)) {
      console.log(`- ${name}`);
    }
    if (summary.unresolved.length > 50) {
      console.log(`...and ${summary.unresolved.length - 50} more.`);
    }
  }

  if (summary.lookupFailures && summary.lookupFailures.length) {
    console.log('');
    console.log('Lookup failures that were not normal 404 misses:');
    for (const failure of summary.lookupFailures.slice(0, 20)) {
      console.log(`- ${failure.name} (${failure.mode}): ${failure.reason}`);
    }
  }

  return args.strict && summary.placeholders ? 2 : 0;
}

function walkDeckFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkDeckFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith('.txt')) return [entryPath];
    return [];
  });
}

module.exports = { hydrateCardsCommand };
