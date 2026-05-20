const fs = require('fs');
const path = require('path');
const { DeckImporter } = require('../../decks/DeckImporter');
const { CardDatabase } = require('../../cards/CardDatabase');
const { WizardsDecklistFetcher } = require('../../precons/WizardsDecklistFetcher');

async function hydrateCommandersCommand(args = {}) {
  const root = process.cwd();
  const decksDir = path.join(root, 'decks');
  const cachePath = path.join(root, 'data/cards.precons.json');
  const importer = new DeckImporter();
  const cardDatabase = new CardDatabase({ filePath: path.join(root, 'data/cards.starter.json') }).load();
  const fetcher = new WizardsDecklistFetcher({ fetchTimeoutMs: Number(args.timeoutMs || 10000) });
  const existing = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : [];
  const recordsByName = new Map(existing.map((record) => [record.name.toLowerCase(), record]));
  const commanderNames = new Set();

  for (const filePath of walkDeckFiles(decksDir)) {
    const deck = importer.importFromFile(filePath);
    for (const entry of deck.commanders) commanderNames.add(entry.name);
  }

  let lookedUp = 0;
  let updated = 0;
  for (const name of commanderNames) {
    const cached = cardDatabase.get(name) || recordsByName.get(name.toLowerCase());
    if (cached && cached.imageUris && (cached.imageUris.artCrop || cached.imageUris.normal || cached.imageUris.small)) continue;
    lookedUp += 1;
    console.log(`Commander image ${lookedUp}: ${name}`);
    const card = await fetcher.fetchScryfallCard(name);
    if (card) {
      recordsByName.set(card.name.toLowerCase(), card);
      updated += 1;
    }
    await sleep(75);
  }

  const records = Array.from(recordsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(cachePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(`Commander image hydration complete. Looked up ${lookedUp}, updated ${updated}.`);
  return 0;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { hydrateCommandersCommand };
