const { WizardsDecklistFetcher } = require('../../precons/WizardsDecklistFetcher');

async function importWizardsCommand(args = {}) {
  if (!args.url) throw new Error('Missing --url for Wizards article import.');
  const fetcher = new WizardsDecklistFetcher({
    fetchTimeoutMs: Number(args.timeoutMs || 12000)
  });
  const results = await fetcher.importFromUrl(args.url, {
    limit: args.limit,
    cardLimit: args.cardLimit,
    skipCardCache: Boolean(args.skipCardCache),
    refreshPlaceholders: Boolean(args.refreshPlaceholders)
  });

  console.log('Wizards article import results:');
  for (const result of results) {
    console.log(`  imported ${result.setName} - ${result.title}`);
    console.log(`    ${result.filePath}`);
  }
  return results.length ? 0 : 1;
}

module.exports = { importWizardsCommand };
