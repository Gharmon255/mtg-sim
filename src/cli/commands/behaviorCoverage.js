const { createDefaultBehaviorRegistry } = require('../../cards/CardBehavior');
const { CardTagger } = require('../../cards/CardTagger');
const { MoxfieldImporter } = require('../../importers/MoxfieldImporter');
const { LandBehaviorRegistry } = require('../../cards/lands/LandBehaviorRegistry');
const { isLand, landColors } = require('../../cards/lands/LandProduction');
const { MANA_ARTIFACTS, MANA_CREATURES, producedColors } = require('../../rules/ManaProduction');

async function behaviorCoverageCommand(args, context) {
  const deckPath = args.moxfield ? await importMoxfieldToFile(args) : args.deck;
  if (!deckPath) throw new Error('Missing --deck path.');
  const deck = context.importer.importFromFile(deckPath);
  const report = behaviorCoverageForDeck(deck, context.cardDatabase);
  printCoverage(deck, report);
  return 0;
}

function behaviorCoverageForDeck(deck, cardDatabase) {
  const engine = createDefaultBehaviorRegistry();
  const tagger = new CardTagger();
  const cards = [];
  const missing = new Map();
  const roleFallback = new Map();
  const tagFallback = new Map();
  const manaCoverage = {
    exactLands: 0,
    producedManaLands: 0,
    genericLands: 0,
    exactRocks: 0,
    exactDorks: 0,
    unknownManaCards: 0
  };
  const landRegistry = new LandBehaviorRegistry();

  for (const entry of deck.cards || []) {
    const source = cardDatabase.get(entry.name) || { name: entry.name, tags: [] };
    const tags = Array.from(new Set((source.tags || []).concat(tagger.tagsFor(source))));
    const card = { ...source, name: entry.name, tags };
    for (let index = 0; index < entry.quantity; index += 1) cards.push(card);
    const behavior = engine.get(card);
    if (behavior.source === 'role') roleFallback.set(card.name, (roleFallback.get(card.name) || 0) + entry.quantity);
    if (behavior.source === 'tag') tagFallback.set(card.name, (tagFallback.get(card.name) || 0) + entry.quantity);
    if (behavior.source === 'generic') missing.set(card.name, (missing.get(card.name) || 0) + entry.quantity);
    addManaCoverage(manaCoverage, landRegistry, card, entry.quantity);
  }

  const coverage = engine.coverageForCards(cards);
  return {
    ...coverage,
    roleFallback,
    tagFallback,
    missing,
    manaCoverage,
    coveragePercent: coverage.totalCards ? coverage.specific / coverage.totalCards : 0
  };
}

async function importMoxfieldToFile(args) {
  const importer = new MoxfieldImporter();
  const deck = await importer.importUrl(args.moxfield, { timeoutMs: args.timeoutMs });
  return importer.save(deck);
}

function printCoverage(deck, report) {
  console.log('Card Behavior Coverage');
  console.log('======================');
  console.log(`Deck: ${deck.name}`);
  console.log(`Total cards: ${report.totalCards}`);
  console.log(`Specific behavior modules: ${report.specific}`);
  console.log(`Role metadata fallback: ${report.role}`);
  console.log(`Generic tag fallback: ${report.tag}`);
  console.log(`No useful metadata: ${report.generic}`);
  console.log(`Specific behavior coverage: ${(report.coveragePercent * 100).toFixed(1)}%`);
  console.log('');
  console.log('Mana Behavior Coverage');
  console.log(`Exact land behavior: ${report.manaCoverage.exactLands}`);
  console.log(`Scryfall produced_mana lands: ${report.manaCoverage.producedManaLands}`);
  console.log(`Generic land fallback: ${report.manaCoverage.genericLands}`);
  console.log(`Exact mana rocks: ${report.manaCoverage.exactRocks}`);
  console.log(`Exact mana dorks: ${report.manaCoverage.exactDorks}`);
  console.log(`Unknown mana behavior: ${report.manaCoverage.unknownManaCards}`);
  console.log(`Source-level exact coverage: ${report.manaCoverage.exactLands + report.manaCoverage.exactRocks + report.manaCoverage.exactDorks}`);
  console.log(`Source-level fallback coverage: ${report.manaCoverage.producedManaLands + report.manaCoverage.genericLands + report.manaCoverage.unknownManaCards}`);
  printTop('Top role fallback cards needing exact behavior', report.roleFallback);
  printTop('Top tag fallback cards needing exact behavior', report.tagFallback);
  printTop('Cards with no useful metadata', report.missing);
}

function addManaCoverage(report, landRegistry, card, quantity) {
  const tags = new Set(card.tags || []);
  if (isLand(card)) {
    if (landRegistry.hasExactBehavior(card)) report.exactLands += quantity;
    else if ((card.producedMana || card.produced_mana || []).length || landColors(card).length) report.producedManaLands += quantity;
    else report.genericLands += quantity;
    return;
  }
  if (MANA_ARTIFACTS[card.name]) {
    report.exactRocks += quantity;
    return;
  }
  if (MANA_CREATURES[card.name]) {
    report.exactDorks += quantity;
    return;
  }
  if (tags.has('ramp') || tags.has('fast-mana') || tags.has('mana-rock') || producedColors(card).length) {
    report.unknownManaCards += quantity;
  }
}

function printTop(label, map) {
  const items = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!items.length) return;
  console.log('');
  console.log(`${label}:`);
  for (const [name, count] of items) console.log(`- ${name} (${count})`);
}

module.exports = { behaviorCoverageCommand, behaviorCoverageForDeck };
