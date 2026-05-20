const assert = require('assert');
const { ZoneManager } = require('../../game/ZoneManager');
const { TokenManager } = require('../../game/TokenManager');
const { ManaSourceManager } = require('../../game/ManaSourceManager');
const { buildAvailableManaPool, canPayCard, payCard, missingColorsForCard } = require('../../rules/ManaPayment');

function testManaSourcesCommand() {
  const tests = [
    ['A land cannot be tapped twice in one turn', () => landCannotTapTwice()],
    ['Sol Ring cannot be tapped twice in one turn', () => solRingCannotTapTwice()],
    ['Sol Ring helps generic but not colored mana', () => solRingGenericOnly()],
    ['Ancient Tomb produces colorless/generic but not colored mana', () => ancientTombColorlessOnly()],
    ['Command Tower produces commander colors', () => commandTowerCommanderColors()],
    ['Birds of Paradise cannot tap the turn it enters', () => birdsSummoningSick()],
    ['Birds of Paradise can tap next turn', () => birdsNextTurn()],
    ['Treasure is sacrificed and cannot be reused', () => treasureSacrificed()],
    ['Lotus Petal is sacrificed and cannot be reused', () => lotusPetalSacrificed()],
    ['Jeweled Lotus can pay commander but not non-commander spells', () => jeweledLotusCommanderOnly()],
    ['Mox Amber works only when condition is met', () => moxAmberCondition()],
    ['Mox Opal works only with metalcraft', () => moxOpalCondition()],
    ['Mana sources reset on the next turn', () => sourcesUntapNextTurn()],
    ['Counterspell cannot be cast from one Island plus Sol Ring', () => !payable([island(), artifact('Sol Ring')], spell('Counterspell', '{U}{U}', 2), ['U'])],
    ['Counterspell can be cast from two blue-producing lands', () => payable([island(), land('Command Tower', 'Land')], spell('Counterspell', '{U}{U}', 2), ['U'])],
    ['Multiple spells cannot reuse tapped sources', () => multipleSpellsCannotReuse()],
    ['Interaction cannot be cast if needed sources are tapped', () => interactionNeedsUntappedSources()],
    ['Treasures can fix missing colors', () => treasureFixesColor()],
    ['Payment result exposes source usage for debug logs', () => paymentDebugSourceUsage()],
    ['Old mana basics still behave', () => payable([forest(), forest(), island()], spell('Cultivate', '{2}{G}', 3), ['G'])]
  ];

  console.log('Source-Level Mana Tests');
  console.log('=======================');
  let passed = 0;
  for (const [name, fn] of tests) {
    try {
      assert.strictEqual(Boolean(fn()), true);
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.log(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Passed ${passed}/${tests.length} source mana checks.`);
  return 0;
}

function landCannotTapTwice() {
  const player = testPlayer(['U']);
  player.addPermanent(island());
  return player.payCard(spell('Opt', '{U}', 1))
    && !player.payCard(spell('Opt', '{U}', 1))
    && player.metrics.doubleSpendPreventionEvents > 0;
}

function solRingCannotTapTwice() {
  const player = testPlayer([]);
  player.addPermanent(artifact('Sol Ring'));
  return player.payCard(spell('Mind Stone', '{2}', 2)) && !player.payCard(spell('Mind Stone', '{2}', 2));
}

function solRingGenericOnly() {
  return payable([artifact('Sol Ring')], spell('Mind Stone', '{2}', 2), [])
    && !payable([artifact('Sol Ring')], spell('Swords to Plowshares', '{W}', 1), ['W']);
}

function ancientTombColorlessOnly() {
  return payable([land('Ancient Tomb', 'Land')], spell('Mind Stone', '{2}', 2), [])
    && !payable([land('Ancient Tomb', 'Land')], spell('Swords to Plowshares', '{W}', 1), ['W']);
}

function commandTowerCommanderColors() {
  return payable([land('Command Tower', 'Land')], spell('Swords to Plowshares', '{W}', 1), ['W', 'U']);
}

function birdsSummoningSick() {
  const player = testPlayer(['G']);
  player.addPermanent(creature('Birds of Paradise'), { enteredTurn: 1, summoningSick: true });
  const result = player.manaSourceManager.canPayCard(spell('Llanowar Elves', '{G}', 1));
  return !result.success && result.unusableSources.some((entry) => entry.reason === 'summoning sickness');
}

function birdsNextTurn() {
  const player = testPlayer(['G']);
  player.addPermanent(creature('Birds of Paradise'), { enteredTurn: 1, summoningSick: true });
  player.turnCount = 2;
  player.zoneManager.untapStep(2);
  player.refreshManaPool();
  return player.payCard(spell('Llanowar Elves', '{G}', 1));
}

function treasureSacrificed() {
  const player = testPlayer(['W']);
  player.createTreasures(1, 'Test');
  return player.payCard(spell('Swords to Plowshares', '{W}', 1))
    && player.tokenManager.treasureCount() === 0
    && !player.payCard(spell('Swords to Plowshares', '{W}', 1));
}

function lotusPetalSacrificed() {
  const player = testPlayer(['W']);
  player.addPermanent(artifact('Lotus Petal'));
  return player.payCard(spell('Swords to Plowshares', '{W}', 1))
    && player.graveyard.some((card) => card.name === 'Lotus Petal')
    && !player.payCard(spell('Swords to Plowshares', '{W}', 1));
}

function jeweledLotusCommanderOnly() {
  const player = testPlayer(['G']);
  player.addPermanent(artifact('Jeweled Lotus'));
  const nonCommander = player.canPayCard(spell('Cultivate', '{G}', 1));
  const commander = player.canPayCard({ ...spell('Commander', '{G}', 1), isCommander: true });
  return !nonCommander && commander;
}

function moxAmberCondition() {
  const player = testPlayer(['U']);
  player.addPermanent(artifact('Mox Amber'));
  const noLegend = player.canPayCard(spell('Opt', '{U}', 1));
  player.commanderPermanentNames.add('Test Commander');
  player.refreshManaPool();
  return !noLegend && player.payCard(spell('Opt', '{U}', 1));
}

function moxOpalCondition() {
  const player = testPlayer(['U']);
  player.addPermanent(artifact('Mox Opal'));
  const noMetalcraft = player.canPayCard(spell('Opt', '{U}', 1));
  player.addPermanent(artifact('Sol Ring'));
  player.addPermanent(artifact('Arcane Signet'));
  player.refreshManaPool();
  return !noMetalcraft && player.payCard(spell('Opt', '{U}', 1));
}

function sourcesUntapNextTurn() {
  const player = testPlayer(['U']);
  player.addPermanent(island());
  const first = player.payCard(spell('Opt', '{U}', 1));
  const second = player.payCard(spell('Opt', '{U}', 1));
  player.turnCount = 2;
  player.zoneManager.untapStep(2);
  player.refreshManaPool();
  return first && !second && player.payCard(spell('Opt', '{U}', 1));
}

function multipleSpellsCannotReuse() {
  const player = testPlayer(['W']);
  player.addPermanent(plains());
  return player.payCard(spell('Swords to Plowshares', '{W}', 1))
    && !player.payCard(spell('Path to Exile', '{W}', 1));
}

function interactionNeedsUntappedSources() {
  const player = testPlayer(['U']);
  player.addPermanent(island());
  player.addPermanent(artifact('Sol Ring'));
  player.payCard(spell('Opt', '{U}', 1));
  return !player.canPayCard(spell('Counterspell', '{U}{U}', 2));
}

function treasureFixesColor() {
  const player = testPlayer(['W']);
  player.addPermanent(island());
  player.createTreasures(1, 'Test');
  return player.payCard(spell('Swords to Plowshares', '{W}', 1))
    && player.metrics.treasureFixingEvents >= 1;
}

function paymentDebugSourceUsage() {
  const player = testPlayer(['U']);
  player.addPermanent(island());
  const success = player.payCard(spell('Opt', '{U}', 1));
  return success && player.lastManaPayment.sourcesUsed.includes('Island');
}

function payable(permanents, card, commanderColors) {
  const player = testPlayer(commanderColors);
  for (const permanent of permanents) player.addPermanent(permanent, { summoningSick: false });
  return player.canPayCard(card);
}

function testPlayer(commanderColors = []) {
  const player = {
    id: 'p1',
    turnCount: 1,
    life: 40,
    battlefield: [],
    graveyard: [],
    exile: [],
    commandZone: commanderColors.length ? [{ name: 'Test Commander', colors: commanderColors, colorIdentity: commanderColors, manaCost: commanderColors.map((color) => `{${color}}`).join('') }] : [],
    commanderPermanentNames: new Set(),
    rampMana: 0,
    treasures: 0,
    floatingMana: 0,
    metrics: { missingColors: {}, paymentFailureReasons: {} },
    addPermanent(card, options = {}) { return this.zoneManager.addToBattlefield(card, options); },
    createTreasures(count, sourceName) { return this.tokenManager.createTreasure(count, sourceName); },
    refreshManaPool() {
      this.manaPool = buildAvailableManaPool(this);
      this.availableMana = this.manaPool.total();
      return this.manaPool;
    },
    canPayCard(card, options = {}) { return canPayCard(this, card, options); },
    payCard(card, options = {}) { return payCard(this, card, options); },
    missingColorsForCard(card) { return missingColorsForCard(this, card); }
  };
  player.zoneManager = new ZoneManager(player);
  player.tokenManager = new TokenManager(player);
  player.manaSourceManager = new ManaSourceManager(player);
  player.refreshManaPool();
  return player;
}

function spell(name, manaCost, manaValue) {
  return { name, manaCost, manaValue, typeLine: 'Instant', tags: [] };
}

function land(name, typeLine) {
  return { name, manaCost: '', manaValue: 0, typeLine, tags: ['land'], oracleText: '' };
}

function artifact(name) {
  return { name, manaCost: '{1}', manaValue: 1, typeLine: 'Artifact', tags: ['artifact', 'ramp'] };
}

function creature(name) {
  return { name, manaCost: '{G}', manaValue: 1, typeLine: 'Creature - Druid', tags: ['creature', 'ramp'] };
}

function island() { return land('Island', 'Basic Land - Island'); }
function plains() { return land('Plains', 'Basic Land - Plains'); }
function forest() { return land('Forest', 'Basic Land - Forest'); }

module.exports = { testManaSourcesCommand };
