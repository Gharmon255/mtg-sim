const { WizardsDecklistFetcher } = require('../../precons/WizardsDecklistFetcher');

async function importPreconsCommand(args = {}) {
  const fetcher = new WizardsDecklistFetcher({
    fetchTimeoutMs: Number(args.timeoutMs || 12000)
  });
  const results = await fetcher.importLatest({
    limit: args.limit,
    deckLimit: args.deckLimit,
    cardLimit: args.cardLimit,
    skipCardCache: Boolean(args.skipCardCache),
    refreshPlaceholders: Boolean(args.refreshPlaceholders)
  });

  console.log('Latest precon import results:');
  for (const result of results) {
    if (result.status === 'imported') {
      console.log(`  imported ${result.setName} - ${result.title}`);
      console.log(`    ${result.filePath}`);
    } else {
      console.log(`  missing ${result.setName} - ${result.title}: ${result.message}`);
    }
  }

  const importedCount = results.filter((result) => result.status === 'imported').length;
  return importedCount === 0 ? 1 : 0;
}

module.exports = { importPreconsCommand };
