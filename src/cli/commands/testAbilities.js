const assert = require('assert');
const { PlayerState } = require('../../game/PlayerState');
const { AbilityResolver } = require('../../game/AbilityResolver');
const { UpkeepEngine } = require('../../game/UpkeepEngine');
const { TriggeredAbilityEngine } = require('../../game/TriggeredAbilityEngine');

function testAbilitiesCommand() {
  const tests = [
    ['Mana Vault does not untap normally', manaVaultNoNormalUntap],
    ['Mana Vault can untap by paying {4}', manaVaultPaidUntap],
    ['Mana Vault deals upkeep damage if tapped', manaVaultUpkeepDamage],
    ['Grim Monolith does not untap normally', grimNoNormalUntap],
    ['Grim Monolith can untap by paying {4}', grimPaidUntap],
    ['Basalt Monolith can untap by paying {3}', basaltPaidUntap],
    ['Lion\'s Eye Diamond sacrifices and discards hand when used', ledSacrificesAndDiscards],
    ['LED is not used casually without combo reason', ledHeldWithoutCombo],
    ['Lotus Petal sacrifices itself when used', lotusPetalSacrifice],
    ['Jeweled Lotus only casts commander', jeweledLotusCommanderOnly],
    ['Chrome Mox requires imprint', chromeMoxRequiresImprint],
    ['Mox Diamond requires discarding a land', moxDiamondRequiresLand],
    ['Mox Opal requires metalcraft', moxOpalRequiresMetalcraft],
    ['Mox Amber requires legendary permanent', moxAmberRequiresLegend],
    ['Fetch land pays life, taps, sacrifices, and finds target', fetchActivationWorks],
    ['Fetch land fails cleanly if no target exists', fetchFailsCleanly],
    ['Shock land can enter untapped with 2 life paid', shockUntappedCostsLife],
    ['Boseiju can be held as interaction instead of played as land', boseijuHeldAsInteraction],
    ['Ancient Tomb pays 2 life when used', ancientTombLifePaid],
    ['Treasures created by Dockside are tracked by source', docksideTreasureSourceTracked],
    ['Smothering Tithe creates treasures over time', smotheringTitheTriggers],
    ['Treasure cannot be reused after sacrifice', treasureCannotReuse],
    ['Phyrexian Tower sacrifices a creature to produce black', phyrexianTowerSacrificeMana],
    ['Nykthos produces more mana when devotion is high', nykthosDevotionMana],
    ['Old mana source basics still pass', oldManaBasicsStillPass]
  ];

  console.log('Activated Ability Tests');
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
  console.log(`Passed ${passed}/${tests.length} activated ability checks.`);
  return 0;
}

function manaVaultNoNormalUntap() {
  const player = testPlayer([]);
  const vault = player.addPermanent(artifact('Mana Vault'));
  player.payCard(spell('Big Spell', '{3}', 3));
  player.turnCount = 2;
  player.zoneManager.untapStep(2);
  return vault.tapped === true;
}

function manaVaultPaidUntap() {
  const player = testPlayer([]);
  const vault = player.addPermanent(artifact('Mana Vault'));
  vault.tapped = true;
  addLands(player, 'Wastes', 4);
  const result = new AbilityResolver().activate(player, vault, 'untap', { turn: 2 });
  return result.success && vault.tapped === false && player.metrics.untapAbilitiesActivated === 1;
}

function manaVaultUpkeepDamage() {
  const player = testPlayer([]);
  const vault = player.addPermanent(artifact('Mana Vault'));
  vault.tapped = true;
  const gameState = mockGame([player]);
  new UpkeepEngine().run(gameState, player);
  return player.metrics.manaVaultDamage === 1 && player.life === 39;
}

function grimNoNormalUntap() {
  const player = testPlayer([]);
  const monolith = player.addPermanent(artifact('Grim Monolith'));
  player.payCard(spell('Big Spell', '{3}', 3));
  player.turnCount = 2;
  player.zoneManager.untapStep(2);
  return monolith.tapped === true;
}

function grimPaidUntap() {
  const player = testPlayer([]);
  const monolith = player.addPermanent(artifact('Grim Monolith'));
  monolith.tapped = true;
  addLands(player, 'Wastes', 4);
  return new AbilityResolver().activate(player, monolith, 'untap', { turn: 2 }).success && !monolith.tapped;
}

function basaltPaidUntap() {
  const player = testPlayer([]);
  const monolith = player.addPermanent(artifact('Basalt Monolith'));
  monolith.tapped = true;
  addLands(player, 'Wastes', 3);
  return new AbilityResolver().activate(player, monolith, 'untap', { turn: 2 }).success && !monolith.tapped;
}

function ledSacrificesAndDiscards() {
  const player = testPlayer(['B'], { primaryArchetype: 'combo' });
  player.addPermanent(artifact("Lion's Eye Diamond"));
  player.graveyard.push(card('Underworld Breach', 'Enchantment', '{1}{R}', ['combo-piece']));
  player.hand.push(spell('Dark Ritual', '{B}', 1), spell('Brain Freeze', '{1}{U}', 2));
  const ok = player.payCard(spell('Combo Spell', '{B}{B}{B}', 3), { comboActive: true });
  return ok && player.graveyard.some((item) => item.name === "Lion's Eye Diamond") && player.hand.length === 0 && player.metrics.ledActivations === 1;
}

function ledHeldWithoutCombo() {
  const player = testPlayer(['B'], { primaryArchetype: 'midrange' });
  player.addPermanent(artifact("Lion's Eye Diamond"));
  player.hand.push(spell('Value Spell', '{B}', 1), spell('Removal', '{B}', 1));
  return !player.canPayCard(spell('Combo Spell', '{B}{B}{B}', 3));
}

function lotusPetalSacrifice() {
  const player = testPlayer(['W']);
  player.addPermanent(artifact('Lotus Petal'));
  return player.payCard(spell('Swords', '{W}', 1)) && player.graveyard.some((item) => item.name === 'Lotus Petal') && !player.payCard(spell('Swords', '{W}', 1));
}

function jeweledLotusCommanderOnly() {
  const player = testPlayer(['G']);
  player.addPermanent(artifact('Jeweled Lotus'));
  return !player.canPayCard(spell('Cultivate', '{G}', 1)) && player.canPayCard({ ...spell('Commander', '{G}', 1), isCommander: true });
}

function chromeMoxRequiresImprint() {
  const empty = testPlayer(['U']);
  const failed = empty.addPermanent(artifact('Chrome Mox'));
  const withImprint = testPlayer(['U']);
  withImprint.hand.push(card('Ponder', 'Sorcery', '{U}', []));
  const mox = withImprint.addPermanent(artifact('Chrome Mox'));
  return !empty.canPayCard(spell('Opt', '{U}', 1)) && failed.disabledMana && mox.metadata.imprintedColor === 'U' && withImprint.canPayCard(spell('Opt', '{U}', 1));
}

function moxDiamondRequiresLand() {
  const empty = testPlayer(['G']);
  const failed = empty.addPermanent(artifact('Mox Diamond'));
  const good = testPlayer(['G']);
  good.hand.push(land('Forest'), land('Island'));
  const diamond = good.addPermanent(artifact('Mox Diamond'));
  return failed.disabledMana && diamond.metadata.discardedLand && good.canPayCard(spell('Birds', '{G}', 1));
}

function moxOpalRequiresMetalcraft() {
  const player = testPlayer(['U']);
  player.addPermanent(artifact('Mox Opal'));
  const before = player.canPayCard(spell('Opt', '{U}', 1));
  player.addPermanent(artifact('Sol Ring'));
  player.addPermanent(artifact('Arcane Signet'));
  return !before && player.canPayCard(spell('Opt', '{U}', 1));
}

function moxAmberRequiresLegend() {
  const player = testPlayer(['U']);
  player.addPermanent(artifact('Mox Amber'));
  const before = player.canPayCard(spell('Opt', '{U}', 1));
  player.commanderPermanentNames.add('Legend');
  return !before && player.canPayCard(spell('Opt', '{U}', 1));
}

function fetchActivationWorks() {
  const player = testPlayer(['W', 'U']);
  player.hand.push(land('Flooded Strand'));
  player.library.push(land('Tundra', 'Land - Plains Island'));
  const result = player.playLand();
  return result.name === 'Tundra'
    && player.life === 39
    && player.metrics.fetchActivations === 1
    && player.graveyard.some((item) => item.name === 'Flooded Strand')
    && player.battlefield.some((item) => item.name === 'Tundra');
}

function fetchFailsCleanly() {
  const player = testPlayer(['W', 'U']);
  const result = player.resolveLandPlay(land('Flooded Strand'), { fetchTarget: land('Hallowed Fountain', 'Land - Plains Island') });
  return result.name === 'Flooded Strand' && player.metrics.failedFetchActivations === 1 && player.graveyard.some((item) => item.name === 'Flooded Strand');
}

function shockUntappedCostsLife() {
  const player = testPlayer(['W', 'U']);
  const target = land('Hallowed Fountain', 'Land - Plains Island');
  player.library.push(target);
  player.resolveLandPlay(land('Flooded Strand'), {
    fetchTarget: target,
    shockUntapped: true,
    targetEntersTapped: false
  });
  return player.life === 37 && player.metrics.shockDamageTaken === 2 && player.metrics.lifePaidToFetches === 1;
}

function boseijuHeldAsInteraction() {
  const player = testPlayer(['G']);
  player.battlefield.push(land('Forest'), land('Forest'));
  player.hand.push(land('Boseiju, Who Endures', 'Legendary Land'), land('Forest'));
  const choice = player.landSequencer.chooseLand(player);
  return choice.card.name === 'Forest';
}

function ancientTombLifePaid() {
  const player = testPlayer([]);
  player.addPermanent(land('Ancient Tomb'));
  return player.payCard(spell('Mind Stone', '{2}', 2)) && player.life === 38 && player.metrics.lifePaidToAncientTomb === 2;
}

function docksideTreasureSourceTracked() {
  const player = testPlayer(['R']);
  player.createTreasures(3, 'Dockside Extortionist');
  return player.metrics.treasuresCreated === 3 && player.metrics.treasuresBySource['Dockside Extortionist'] === 3;
}

function smotheringTitheTriggers() {
  const owner = testPlayer(['W']);
  const opponent = testPlayer(['U']);
  owner.addPermanent(card('Smothering Tithe', 'Enchantment', '{3}{W}', ['ramp', 'treasure']));
  new TriggeredAbilityEngine().afterDraw(mockGame([owner, opponent]), opponent, 2);
  return owner.metrics.treasureTriggers === 2 && owner.tokenManager.treasureCount() === 2;
}

function treasureCannotReuse() {
  const player = testPlayer(['W']);
  player.createTreasures(1, 'Test');
  return player.payCard(spell('Swords', '{W}', 1)) && !player.payCard(spell('Swords', '{W}', 1));
}

function phyrexianTowerSacrificeMana() {
  const player = testPlayer(['B']);
  player.addPermanent(land('Phyrexian Tower'));
  player.addPermanent(card('Doomed Traveler', 'Creature', '{W}', ['creature']), { summoningSick: false });
  return player.payCard(spell('Black Spell', '{B}{B}', 2)) && player.graveyard.some((item) => item.name === 'Doomed Traveler');
}

function nykthosDevotionMana() {
  const player = testPlayer(['G']);
  player.addPermanent(land('Nykthos, Shrine to Nyx'));
  player.addPermanent(card('Elvish Mystic', 'Creature', '{G}', ['creature']), { summoningSick: false });
  player.addPermanent(card('Llanowar Elves', 'Creature', '{G}', ['creature']), { summoningSick: false });
  return player.payCard(spell('Big Green Spell', '{2}', 2));
}

function oldManaBasicsStillPass() {
  const player = testPlayer(['G']);
  player.addPermanent(land('Forest'));
  player.addPermanent(land('Forest'));
  player.addPermanent(land('Island'));
  return player.payCard(spell('Cultivate', '{2}{G}', 3));
}

function testPlayer(commanderColors = [], profile = {}) {
  const player = new PlayerState({
    id: 'p1',
    name: 'fixture',
    deck: { commanders: [], mainboard: [] },
    cardDatabase: { get: () => null },
    random: { shuffle: (cards) => cards, next: () => 0.25 },
    strategyProfile: { primaryArchetype: 'midrange', estimatedBracket: 2, ...profile }
  });
  player.commandZone = commanderColors.length ? [{ name: 'Test Commander', colorIdentity: commanderColors, colors: commanderColors, manaCost: commanderColors.map((color) => `{${color}}`).join('') }] : [];
  player.refreshManaPool();
  return player;
}

function addLands(player, name, count) {
  for (let index = 0; index < count; index += 1) player.addPermanent(land(name));
}

function mockGame(players) {
  return {
    turn: 2,
    players,
    recordDebug: () => {},
    opponentsOf(player) { return players.filter((candidate) => candidate !== player); }
  };
}

function spell(name, manaCost, manaValue) {
  return { name, manaCost, manaValue, typeLine: 'Instant', tags: [] };
}

function card(name, typeLine, manaCost = '', tags = []) {
  const numeric = Number((manaCost.match(/\d+/) || [0])[0]);
  const manaValue = Math.max(0, numeric + colorFromCost(manaCost).length);
  return { name, manaCost, manaValue, typeLine, tags, colors: colorFromCost(manaCost), colorIdentity: colorFromCost(manaCost) };
}

function artifact(name) {
  return { name, manaCost: '{0}', manaValue: 0, typeLine: 'Artifact', tags: ['artifact', 'ramp', 'mana-rock'] };
}

function land(name, typeLine = 'Land') {
  return { name, manaCost: '', manaValue: 0, typeLine, tags: ['land'], oracleText: '' };
}

function colorFromCost(cost) {
  return ['W', 'U', 'B', 'R', 'G'].filter((color) => cost.includes(`{${color}}`));
}

module.exports = { testAbilitiesCommand };
