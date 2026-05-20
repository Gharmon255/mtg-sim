const { SimulationRunner } = require('../../simulation/SimulationRunner');

function testStrategiesCommand(args, context) {
  const games = Number(args.games || 12);
  const runner = new SimulationRunner({ cardDatabase: context.cardDatabase, logger: context.logger });
  const checks = [];

  checks.push(comparePair('control uses more interaction than aggro', runner, games, controlDeck(), aggroDeck(), (a, b) => stat(a, 'interactionUsed') + stat(a, 'heldInteractionTurns') >= stat(b, 'interactionUsed')));
  checks.push(comparePair('aggro deals more early combat damage than control', runner, games, aggroDeck(), controlDeck(), (a, b) => stat(a, 'earlyCombatDamage') >= stat(b, 'earlyCombatDamage')));
  checks.push(comparePair('ramp casts more ramp than aggro', runner, games, rampDeck(), aggroDeck(), (a, b) => stat(a, 'rampPlayed') > stat(b, 'rampPlayed')));
  checks.push(comparePair('voltron casts commander earlier than control', runner, games, voltronDeck(), controlDeck(), (a, b) => avgCommanderTurn(a) <= avgCommanderTurn(b)));
  checks.push(comparePair('combo attempts more combos than midrange', runner, games, comboDeck(), midrangeDeck(), (a, b) => stat(a, 'comboAttempts') > stat(b, 'comboAttempts')));
  checks.push(comparePair('tokens builds more board than control', runner, games, tokensDeck(), controlDeck(), (a, b) => stat(a, 'boardScore') >= stat(b, 'boardScore')));
  checks.push(comparePair('aristocrats uses sacrifice/value actions more than aggro', runner, games, aristocratsDeck(), aggroDeck(), (a, b) => stat(a, 'sacrificeActions') >= stat(b, 'sacrificeActions')));
  checks.push(comparePair('reanimator uses graveyard/reanimation actions more than control', runner, games, reanimatorDeck(), controlDeck(), (a, b) => stat(a, 'graveyardSetupActions') + stat(a, 'reanimationActions') >= stat(b, 'graveyardSetupActions') + stat(b, 'reanimationActions')));
  checks.push(comparePair('stax casts more stax pieces than ramp', runner, games, staxDeck(), rampDeck(), (a, b) => stat(a, 'staxPiecesCast') > stat(b, 'staxPiecesCast')));
  checks.push(comparePair('combo tutors high-value targets', runner, games, comboDeck(), midrangeDeck(), (a) => stat(a, 'highValueTutorTargets') >= 1 || stat(a, 'tutorEfficiencyTotal') >= 70));
  checks.push(comparePair('control counters high-priority plays more than it wastes counters', runner, games, controlDeck(), comboDeck(), (a) => stat(a, 'highPriorityCounters') >= stat(a, 'wastedCounters') && stat(a, 'counterspellsUsed') > 0));
  checks.push(comparePair('protection is not mostly wasted', runner, games, voltronDeck(), aggroDeck(), (a) => stat(a, 'successfulProtection') >= stat(a, 'wastedProtection')));
  checks.push(comparePair('voltron protects key plans more than aggro', runner, games, voltronDeck(), aggroDeck(), (a, b) => stat(a, 'protectionUsed') >= stat(b, 'protectionUsed')));
  checks.push(comparePair('sequencing score is recorded for role-aware decks', runner, games, comboDeck(), controlDeck(), (a, b) => stat(a, 'cardSequencingScoreCount') + stat(b, 'cardSequencingScoreCount') > 0));
  checks.push(comparePair('board wipe quality is recorded when control wipes', runner, games, controlDeck(), tokensDeck(), (a) => stat(a, 'boardWipeQualityCount') === 0 || stat(a, 'boardWipeQualityTotal') / stat(a, 'boardWipeQualityCount') >= 35));

  console.log('Strategy Regression Tests');
  console.log('=========================');
  let passed = 0;
  for (const check of checks) {
    if (check.pass) passed += 1;
    console.log(`${check.pass ? 'PASS' : 'WARN'} ${check.name}`);
    console.log(`  ${check.left.name}: ${JSON.stringify(check.left.summary)}`);
    console.log(`  ${check.right.name}: ${JSON.stringify(check.right.summary)}`);
  }
  if (passed < Math.max(10, checks.length - 3)) throw new Error(`Only ${passed}/${checks.length} strategy checks passed.`);
  console.log(`Passed ${passed}/${checks.length} loose strategy checks.`);
  return 0;
}

function comparePair(name, runner, games, leftDeck, rightDeck, predicate) {
  const result = runner.run([leftDeck, rightDeck], { games, seed: `strategy-${leftDeck.name}-${rightDeck.name}`, maxTurns: 12, debug: false });
  const left = summarize(result, leftDeck.name);
  const right = summarize(result, rightDeck.name);
  return { name, pass: Boolean(predicate(left, right)), left, right };
}

function summarize(result, name) {
  const players = result.games.flatMap((game) => game.players.filter((player) => player.name === name));
  const summary = {};
  for (const player of players) {
    for (const [key, value] of Object.entries(player.metrics || {})) {
      if (typeof value === 'number') summary[key] = (summary[key] || 0) + value;
    }
    if (typeof player.metrics.commanderCastTurn === 'number') summary.commanderCastTurnCount = (summary.commanderCastTurnCount || 0) + 1;
    summary.boardScore = (summary.boardScore || 0) + player.boardScore;
  }
  return { name, summary };
}

function stat(result, key) {
  return result.summary[key] || 0;
}

function avgCommanderTurn(result) {
  const total = stat(result, 'commanderCastTurn');
  const count = stat(result, 'commanderCastTurnCount');
  return count ? total / count : 99;
}

function deck(name, commander, packageCards, lands = 55) {
  const mainboard = [];
  for (const [cardName, quantity] of packageCards) mainboard.push({ quantity, name: cardName });
  mainboard.push({ quantity: lands, name: 'Command Tower' });
  const total = 1 + mainboard.reduce((sum, entry) => sum + entry.quantity, 0);
  if (total < 100) mainboard.push({ quantity: 100 - total, name: 'Forest' });
  return {
    name,
    source: 'strategy-fixture',
    commanders: [{ quantity: 1, name: commander }],
    mainboard,
    cards: [{ quantity: 1, name: commander }].concat(mainboard),
    metadata: {},
    errors: [],
    totalCards: 100
  };
}

function comboDeck() {
  return deck('fixture-combo', 'Kenrith, the Returned King', [
    ['Sol Ring', 1], ['Mana Vault', 1], ['Arcane Signet', 1], ['Demonic Tutor', 1], ['Mystical Tutor', 1],
    ['Thassa\'s Oracle', 1], ['Tainted Pact', 1], ['Force of Will', 1], ['Swan Song', 1], ['Counterspell', 1]
  ], 50);
}

function controlDeck() {
  return deck('fixture-control', 'Kenrith, the Returned King', [
    ['Counterspell', 4], ['Arcane Denial', 3], ['Swan Song', 2], ['Swords to Plowshares', 3], ['Path to Exile', 2],
    ['Wrath of God', 2], ['Cyclonic Rift', 1], ['Rhystic Study', 1], ['The One Ring', 1]
  ], 55);
}

function aggroDeck() {
  return deck('fixture-aggro', 'Ghalta, Primal Hunger', [
    ['Savannah Lions', 10], ['Goblin Guide', 8], ['Lightning Bolt', 4], ['Giant Growth', 4], ['Craterhoof Behemoth', 1]
  ], 45);
}

function rampDeck() {
  return deck('fixture-ramp', 'Ghalta, Primal Hunger', [
    ['Sol Ring', 1], ['Arcane Signet', 1], ['Cultivate', 4], ['Rampant Growth', 4], ['Kodama\'s Reach', 4], ['Craterhoof Behemoth', 2]
  ], 50);
}

function voltronDeck() {
  return deck('fixture-voltron', 'Kenrith, the Returned King', [
    ['Sol Ring', 1], ['Arcane Signet', 1], ['Lightning Greaves', 4], ['Swiftfoot Boots', 4], ['Heroic Intervention', 3], ['Boros Charm', 3], ['Swords to Plowshares', 2]
  ], 55);
}

function tokensDeck() {
  return deck('fixture-tokens', 'Kenrith, the Returned King', [
    ['Secure the Wastes', 6], ['Anointed Procession', 4], ['Intangible Virtue', 4], ['Skullclamp', 2], ['Heroic Intervention', 2]
  ], 52);
}

function aristocratsDeck() {
  return deck('fixture-aristocrats', 'Kenrith, the Returned King', [
    ['Viscera Seer', 6], ['Blood Artist', 6], ['Skullclamp', 3], ['Reanimate', 2], ['Swords to Plowshares', 2]
  ], 52);
}

function reanimatorDeck() {
  return deck('fixture-reanimator', 'Kenrith, the Returned King', [
    ['Entomb', 5], ['Buried Alive', 4], ['Reanimate', 5], ['Animate Dead', 4], ['Grave Titan', 4], ['Force of Will', 1]
  ], 50);
}

function staxDeck() {
  return deck('fixture-stax', 'Kenrith, the Returned King', [
    ['Sol Ring', 1], ['Winter Orb', 4], ['Static Orb', 4], ['Rule of Law', 4], ['Grand Abolisher', 2], ['Swords to Plowshares', 2]
  ], 54);
}

function midrangeDeck() {
  return deck('fixture-midrange', 'Kenrith, the Returned King', [
    ['Cultivate', 2], ['Swords to Plowshares', 2], ['Beast Within', 2], ['Rhystic Study', 1], ['Grave Titan', 2], ['Craterhoof Behemoth', 1]
  ], 55);
}

module.exports = { testStrategiesCommand };
