const { DeckValidator } = require('../../decks/DeckValidator');
const { formatColorIdentity } = require('../../rules/ColorIdentity');

function validateCommand(args, context) {
  if (!args.deck) throw new Error('Missing --deck path.');
  const deck = context.importer.importFromFile(args.deck);
  const validator = new DeckValidator(context.cardDatabase);
  const result = validator.validate(deck);

  console.log(`Deck: ${deck.name}`);
  console.log(`Cards: ${deck.totalCards}`);
  console.log(`Commander identity: ${formatColorIdentity(result.commanderIdentity)}`);
  console.log(`Status: ${result.valid ? 'valid' : 'invalid'}`);
  printMessages('Errors', result.errors);
  printMessages('Warnings', result.warnings);
  return result.valid ? 0 : 1;
}

function printMessages(label, messages) {
  if (!messages.length) return;
  console.log(`${label}:`);
  for (const message of messages) console.log(`  - ${message}`);
}

module.exports = { validateCommand };
