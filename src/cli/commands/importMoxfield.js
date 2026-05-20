const { MoxfieldImporter } = require('../../importers/MoxfieldImporter');

async function importMoxfieldCommand(args) {
  const importer = new MoxfieldImporter();
  let deck;
  if (args.url) {
    deck = await importer.importUrl(args.url, {
      timeoutMs: args.timeoutMs,
      includeBoards: args.includeBoards === true || args.includeBoards === 'true'
    });
  } else if (args.input) {
    deck = importer.parseFile(args.input, {
      includeBoards: args.includeBoards === true || args.includeBoards === 'true'
    });
  } else {
    throw new Error('Missing --url or --input for Moxfield import.');
  }

  if (deck.errors.length) {
    console.log('Moxfield import warnings:');
    for (const error of deck.errors) console.log(`- ${error}`);
  }
  const output = importer.save(deck, args.output);
  console.log(`Imported ${deck.name} (${deck.totalCards} cards) to ${output}`);
  return 0;
}

module.exports = { importMoxfieldCommand };
