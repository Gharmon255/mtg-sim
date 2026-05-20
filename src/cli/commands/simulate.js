const { listValue } = require('../args');
const { SimulationRunner } = require('../../simulation/SimulationRunner');
const { ReportGenerator } = require('../../simulation/ReportGenerator');
const { hydrateCommand } = require('./hydrate');
const { MoxfieldImporter } = require('../../importers/MoxfieldImporter');

async function simulateCommand(args, context) {
  if (!args.deck && !args.moxfield) throw new Error('Missing --deck path.');
  const moxfieldDeckPath = args.moxfield ? await importMoxfieldToFile(args) : null;
  const primaryPath = moxfieldDeckPath || args.deck;
  const deckPaths = [primaryPath].concat(listValue(args.opponents));
  if (deckPaths.length < 2 || deckPaths.length > 4) {
    throw new Error('Simulation requires 2-4 decks. Use --deck and one to three --opponents.');
  }

  if (args.skipHydrate !== 'true' && args.skipHydrate !== true) {
    await hydrateCommand({ ...args, deck: primaryPath, opponents: listValue(args.opponents) }, context);
    context.cardDatabase.load();
  }

  const decks = deckPaths.map((deckPath) => context.importer.importFromFile(deckPath));
  const runner = new SimulationRunner({ cardDatabase: context.cardDatabase, logger: context.logger });
  const result = runner.run(decks, {
    games: Number(args.games || 1),
    seed: args.seed,
    maxTurns: Number(args.maxTurns || 14),
    debug: Boolean(args.debug)
  });
  const reporter = new ReportGenerator({ cardDatabase: context.cardDatabase, decks });
  const report = reporter.generate(result);
  console.log(reporter.toText(report));
  if (args.debug && result.games.length === 1) {
    console.log('Debug Events');
    console.log('============');
    for (const event of result.games[0].events) {
      console.log(`T${event.turn}: ${event.message}`);
    }
  }
  return 0;
}

async function importMoxfieldToFile(args) {
  const importer = new MoxfieldImporter();
  const deck = await importer.importUrl(args.moxfield, { timeoutMs: args.timeoutMs });
  return importer.save(deck);
}

module.exports = { simulateCommand };
