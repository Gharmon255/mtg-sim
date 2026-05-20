const path = require('path');
const { validateCommand } = require('./validate');
const { analyzeCommand } = require('./analyze');
const { simulateCommand } = require('./simulate');

async function testCommand(args, context) {
  const root = process.cwd();
  const primary = path.join(root, 'decks/precons/secrets-of-strixhaven-lorehold-spirit.txt');
  const opponentOne = path.join(root, 'decks/precons/lorwyn-eclipsed-blight-curse.txt');
  const opponentTwo = path.join(root, 'decks/precons/teenage-mutant-ninja-turtles-turtle-power.txt');

  console.log('Test: import + validation');
  const validationCode = validateCommand({ deck: primary }, context);
  if (validationCode !== 0) throw new Error('Validation sample failed.');

  console.log('\nTest: analyze');
  analyzeCommand({ deck: primary }, context);

  console.log('\nTest: 2-player simulation');
  await simulateCommand({ deck: primary, opponents: [opponentOne], games: args.games || 5, seed: args.seed || 'test-2', skipHydrate: true }, context);

  console.log('\nTest: 4-player simulation');
  await simulateCommand({ deck: primary, opponents: [opponentOne, opponentTwo, primary], games: args.games || 5, seed: args.seed || 'test-4', skipHydrate: true }, context);

  return 0;
}

module.exports = { testCommand };
