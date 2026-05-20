const { listValue } = require('../args');
const { CardCache } = require('../../cards/CardCache');
const { ScryfallService } = require('../../cards/ScryfallService');

async function hydrateCommand(args, context) {
  const deckPaths = [args.deck].concat(listValue(args.opponents)).filter(Boolean);
  if (!deckPaths.length) throw new Error('Missing --deck path.');
  const decks = deckPaths.map((deckPath) => context.importer.importFromFile(deckPath));
  const cache = new CardCache().load();
  const service = new ScryfallService({
    timeoutMs: Number(args.timeoutMs || 10000),
    delayMs: Number(args.delayMs || 150),
    logger: context.logger || console
  });
  const names = uniqueCardNames(decks);
  const summary = { total: names.length, cached: 0, fetched: 0, failed: [] };

  console.log(`Hydrating ${names.length} unique card name(s) into data/cards.cache.json.`);
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    if (cache.has(name) && !args.refresh) {
      summary.cached += 1;
      continue;
    }
    console.log(`Scryfall ${index + 1}/${names.length}: ${name}`);
    const card = await service.fetchCard(name);
    if (card) {
      cache.set(name, card);
      summary.fetched += 1;
    } else {
      summary.failed.push(name);
    }
    await service.throttle();
  }
  cache.save();
  console.log(`Hydration complete. Cached ${summary.cached}, fetched ${summary.fetched}, failed ${summary.failed.length}.`);
  if (summary.failed.length) {
    console.log('Failed lookups:');
    for (const name of summary.failed.slice(0, 40)) console.log(`- ${name}`);
  }
  return 0;
}

function uniqueCardNames(decks) {
  return Array.from(new Set(decks.flatMap((deck) => deck.cards.map((entry) => entry.name)))).sort();
}

module.exports = { hydrateCommand };
