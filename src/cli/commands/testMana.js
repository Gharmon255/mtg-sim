const assert = require('assert');
const { canPayCard, buildAvailableManaPool } = require('../../rules/ManaPayment');
const { LandSequencer } = require('../../cards/lands/LandSequencer');
const { MulliganEngine } = require('../../game/MulliganEngine');
const { TurnEngine } = require('../../game/TurnEngine');

function testManaCommand() {
  const tests = [
    ['Counterspell requires blue-blue', () => !canPayCard(fakePlayer([island(), plains()]), spell('Counterspell', '{U}{U}', 2)) && canPayCard(fakePlayer([island(), island()]), spell('Counterspell', '{U}{U}', 2))],
    ['Swords to Plowshares requires white', () => canPayCard(fakePlayer([plains()]), spell('Swords to Plowshares', '{W}', 1)) && !canPayCard(fakePlayer([island()]), spell('Swords to Plowshares', '{W}', 1))],
    ['Cultivate requires green', () => canPayCard(fakePlayer([forest(), forest(), island()]), spell('Cultivate', '{2}{G}', 3)) && !canPayCard(fakePlayer([island(), island(), plains()]), spell('Cultivate', '{2}{G}', 3))],
    ['Command Tower produces commander colors', () => canPayCard(fakePlayer([land('Command Tower', 'Land')], ['W', 'U']), spell('Swords to Plowshares', '{W}', 1))],
    ['Ancient Tomb produces colorless but not colored mana', () => canPayCard(fakePlayer([land('Ancient Tomb', 'Land')]), spell('Mind Stone', '{2}', 2)) && !canPayCard(fakePlayer([land('Ancient Tomb', 'Land')]), spell('Swords to Plowshares', '{W}', 1))],
    ['Sol Ring helps generic costs but not colored costs', () => canPayCard(fakePlayer([artifact('Sol Ring')]), spell('Mind Stone', '{2}', 2)) && !canPayCard(fakePlayer([artifact('Sol Ring')]), spell('Counterspell', '{U}{U}', 2))],
    ['Arcane Signet fixes commander colors', () => canPayCard(fakePlayer([artifact('Arcane Signet'), artifact('Sol Ring')], ['G']), spell('Cultivate', '{2}{G}', 3))],
    ['Fetch land chooses a needed color source', () => fetchChoosesNeededSource()],
    ['Shock land can enter untapped when needed', () => shockCanEnterUntapped()],
    ['Three-color commander mulligans no-source hands', () => noSourceMulligan()],
    ['Color screw stats increase when mana base is bad', () => colorScrewStatsIncrease()],
    ['Fixing enables early colored spells more realistically', () => canPayCard(fakePlayer([land('Command Tower', 'Land'), artifact('Arcane Signet')], ['U']), spell('Counterspell', '{U}{U}', 2))]
  ];

  console.log('Mana Behavior Tests');
  console.log('===================');
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
  console.log(`Passed ${passed}/${tests.length} mana checks.`);
  return 0;
}

function fetchChoosesNeededSource() {
  const player = fakePlayer([], ['W', 'U']);
  player.turnCount = 1;
  player.hand = [land('Flooded Strand', 'Land'), spell('Counterspell', '{U}{U}', 2)];
  player.library = [
    land('Forest', 'Basic Land - Forest'),
    land('Hallowed Fountain', 'Land - Plains Island'),
    land('Plains', 'Basic Land - Plains')
  ];
  const choice = new LandSequencer().chooseLand(player);
  return choice && choice.fetchTarget && choice.fetchTarget.name === 'Hallowed Fountain';
}

function shockCanEnterUntapped() {
  const player = fakePlayer([], ['W', 'U']);
  player.turnCount = 1;
  player.life = 40;
  player.hand = [land('Hallowed Fountain', 'Land - Plains Island'), spell('Counterspell', '{U}{U}', 2)];
  const choice = new LandSequencer().chooseLand(player);
  return choice && choice.card.name === 'Hallowed Fountain' && choice.shockUntapped && !choice.entersTapped;
}

function noSourceMulligan() {
  const player = fakePlayer([], ['W', 'U', 'B']);
  player.strategyProfile = { primaryArchetype: 'control', estimatedBracket: 3 };
  const hand = [
    land('Ancient Tomb', 'Land'),
    land('Wastes', 'Basic Land'),
    land('Reliquary Tower', 'Land'),
    spell('Counterspell', '{U}{U}', 2),
    spell('Swords to Plowshares', '{W}', 1),
    spell('Demonic Tutor', '{1}{B}', 2),
    spell('Sol Ring', '{1}', 1)
  ];
  return new MulliganEngine({ shuffle: (cards) => cards }).assessHand(player, hand).keep === false;
}

function colorScrewStatsIncrease() {
  const player = fakePlayer([mountain(), forest()]);
  player.turnCount = 4;
  player.hand = [spell('Counterspell', '{U}{U}', 2)];
  player.refreshManaPool();
  new TurnEngine({ behaviorRegistry: {}, combatEngine: {}, decisionEngine: {} }).trackManaProblems(player);
  return player.metrics.colorScrewTurns > 0 && player.metrics.uncastableColorCardsSeen > 0;
}

function fakePlayer(battlefield = [], commanderColors = []) {
  const player = {
    battlefield,
    hand: [],
    library: [],
    commandZone: commanderColors.length ? [{ name: 'Test Commander', colorIdentity: commanderColors, colors: commanderColors, manaCost: commanderColors.map((color) => `{${color}}`).join('') }] : [],
    commanderPermanentNames: new Set(),
    rampMana: 0,
    treasures: 0,
    floatingMana: 0,
    manaPool: null,
    availableMana: 0,
    turnCount: 1,
    life: 40,
    strategyProfile: { estimatedBracket: 3, primaryArchetype: 'midrange' },
    metrics: { missingColors: {}, colorScrewTurns: 0, uncastableColorCardsSeen: 0, manaScrewTurns: 0, manaFloodTurns: 0 },
    availableLandMana() {
      return this.battlefield.filter((card) => (card.tags || []).includes('land')).length;
    },
    refreshManaPool() {
      this.manaPool = buildAvailableManaPool(this);
      this.availableMana = this.manaPool.total();
      return this.manaPool;
    },
    canPayCard(card) {
      return canPayCard(this, card);
    },
    missingColorsForCard(card) {
      const { missingColorsForCard } = require('../../rules/ManaPayment');
      return missingColorsForCard(this, card);
    }
  };
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
  return { name, manaCost: '{1}', manaValue: 1, typeLine: 'Artifact', tags: ['ramp', 'fast-mana'] };
}

function plains() { return land('Plains', 'Basic Land - Plains'); }
function island() { return land('Island', 'Basic Land - Island'); }
function swamp() { return land('Swamp', 'Basic Land - Swamp'); }
function mountain() { return land('Mountain', 'Basic Land - Mountain'); }
function forest() { return land('Forest', 'Basic Land - Forest'); }

module.exports = { testManaCommand };
