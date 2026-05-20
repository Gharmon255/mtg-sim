#!/usr/bin/env node
const { parseArgs } = require('./args');
const { createContext } = require('./context');
const { validateCommand } = require('./commands/validate');
const { analyzeCommand } = require('./commands/analyze');
const { simulateCommand } = require('./commands/simulate');
const { testCommand } = require('./commands/test');
const { importPreconsCommand } = require('./commands/importPrecons');
const { importWizardsCommand } = require('./commands/importWizards');
const { hydrateCommandersCommand } = require('./commands/hydrateCommanders');
const { hydrateCardsCommand } = require('./commands/hydrateCards');
const { hydrateCommand } = require('./commands/hydrate');
const { bracketCommand, combosCommand, powerCommand, reportCommand } = require('./commands/powerReport');
const { strategyCommand } = require('./commands/strategy');
const { importMoxfieldCommand } = require('./commands/importMoxfield');
const { testStrategiesCommand } = require('./commands/testStrategies');
const { behaviorCoverageCommand } = require('./commands/behaviorCoverage');
const { testBehaviorsCommand } = require('./commands/testBehaviors');
const { testManaCommand } = require('./commands/testMana');
const { testManaSourcesCommand } = require('./commands/testManaSources');
const { testAbilitiesCommand } = require('./commands/testAbilities');
const { testInteractionWindowsCommand } = require('./commands/testInteractionWindows');

const commands = {
  validate: validateCommand,
  analyze: analyzeCommand,
  simulate: simulateCommand,
  'import-precons': importPreconsCommand,
  'import-wizards': importWizardsCommand,
  'hydrate-commanders': hydrateCommandersCommand,
  'hydrate-cards': hydrateCardsCommand,
  hydrate: hydrateCommand,
  'import-moxfield': importMoxfieldCommand,
  bracket: bracketCommand,
  combos: combosCommand,
  power: powerCommand,
  report: reportCommand,
  strategy: strategyCommand,
  'behavior-coverage': behaviorCoverageCommand,
  test: testCommand
  ,
  'test-strategies': testStrategiesCommand,
  'test-behaviors': testBehaviorsCommand,
  'test-mana': testManaCommand,
  'test-mana-sources': testManaSourcesCommand,
  'test-abilities': testAbilitiesCommand,
  'test-interaction-windows': testInteractionWindowsCommand
};

function printHelp() {
  console.log(`mtg-commander-simulator

Commands:
  validate --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt
  analyze  --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt
  simulate --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt --opponents ./decks/precons/lorwyn-eclipsed-blight-curse.txt --games 100 --seed demo
  import-precons --limit 1 --cardLimit 5
  import-wizards --url https://magic.wizards.com/en/news/announcements/final-fantasy-commander-decklists --limit 1
  hydrate-commanders
  hydrate-cards --deck ./decks/imported/bristly-bill.txt
  hydrate-cards --limit 2 --offset 0
  bracket --deck ./decks/green-ramp.txt
  combos --deck ./decks/sample-combo.txt
  power --deck ./decks/sample-combo.txt
  hydrate --deck ./decks/sample-thoracle-combo.txt
  report --deck ./decks/sample-thoracle-combo.txt
  strategy --deck ./decks/sample-thoracle-combo.txt
  behavior-coverage --deck ./decks/sample-thoracle-combo.txt
  import-moxfield --input ./decks/moxfield-export.txt --output ./decks/imported/mydeck.txt
  test-strategies
  test-behaviors
  test-mana
  test-mana-sources
  test-abilities
  test-interaction-windows
  test

Options:
  --deck       Primary deck path
  --opponents One to three opponent deck paths
  --games     Number of games to simulate
  --seed      Deterministic seed
  --maxTurns  Maximum turn cycles per game
  --cards     Card database JSON path
  --logLevel  silent, error, warn, info, debug
  --limit     Import only the first N precon decks
  --offset    Start at deck N when hydrating saved decks
  --cardLimit Hydrate only the first N uncached cards during precon import
  --timeoutMs Network timeout for precon import fetches
  --refreshAll Re-check cards that already have cached Scryfall data
`);
}

function main() {
  const [, , commandName, ...rest] = process.argv;
  if (!commandName || commandName === 'help' || commandName === '--help') {
    printHelp();
    return 0;
  }

  const command = commands[commandName];
  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    printHelp();
    return 1;
  }

  const args = parseArgs(rest);
  const context = createContext(args);
  return command(args, context);
}

Promise.resolve()
  .then(() => main())
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
