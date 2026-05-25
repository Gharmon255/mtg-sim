const assert = require('assert');
const { PlayerState } = require('../../game/PlayerState');
const { AbilityResolver } = require('../../game/AbilityResolver');
const { UpkeepEngine } = require('../../game/UpkeepEngine');
const { TriggeredAbilityEngine } = require('../../game/TriggeredAbilityEngine');
const { GameState } = require('../../game/GameState');
const { InteractionEngine } = require('../../game/InteractionEngine');
const { WINDOW_TYPES } = require('../../game/InteractionWindow');

let nextTestPlayerId = 1;

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
    ['Smothering Tithe tax can be paid to prevent Treasure', smotheringTitheTaxPaidSkipsTreasure],
    ['Smothering Tithe unpaid tax creates Treasure', smotheringTitheTaxUnpaidCreatesTreasure],
    ['Smothering Tithe trigger opens and resolves interaction window', smotheringTitheWindowResolves],
    ['Smothering Tithe trigger can be stopped through interaction window', smotheringTitheWindowStopped],
    ['Basalt Monolith untap ability opens and resolves interaction window', basaltUntapWindowResolves],
    ['Basalt Monolith untap ability can be stopped through interaction window', basaltUntapWindowStopped],
    ['Activated ability counterplay remains one-deep', activatedAbilityCounterplayOneDeep],
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
  return owner.metrics.smotheringTitheTriggers === 2
    && owner.metrics.smotheringTitheTaxesUnpaid === 2
    && owner.metrics.smotheringTitheTreasuresCreated === 2
    && owner.metrics.treasureTriggers === 2
    && owner.tokenManager.treasureCount() === 2;
}

function smotheringTitheTaxPaidSkipsTreasure() {
  const owner = testPlayer(['W'], { estimatedBracket: 3 });
  owner.threatScore = 10;
  const opponent = testPlayer(['U']);
  addLands(opponent, 'Island', 2);
  owner.addPermanent(card('Smothering Tithe', 'Enchantment', '{3}{W}', ['ramp', 'treasure', 'high-impact']));
  const gameState = new GameState([owner, opponent], { debug: true });
  gameState.turn = 3;
  new TriggeredAbilityEngine({ interactionEngine: new InteractionEngine() }).afterDraw(gameState, opponent, 1);
  const history = originalHistory(gameState);
  return owner.metrics.smotheringTitheTriggers === 1
    && owner.metrics.smotheringTitheTaxesPaid === 1
    && !owner.metrics.smotheringTitheTaxesUnpaid
    && !owner.metrics.treasureTriggers
    && owner.tokenManager.treasureCount() === 0
    && history
    && gameState.stackManager.history.length === 1
    && !history.stopped
    && debugIncludes(gameState, 'pays Smothering Tithe heuristic tax')
    && !debugIncludes(gameState, 'Smothering Tithe created');
}

function smotheringTitheTaxUnpaidCreatesTreasure() {
  const owner = testPlayer(['W'], { estimatedBracket: 3 });
  const opponent = testPlayer(['U']);
  owner.addPermanent(card('Smothering Tithe', 'Enchantment', '{3}{W}', ['ramp', 'treasure', 'high-impact']));
  const gameState = new GameState([owner, opponent], { debug: true });
  gameState.turn = 3;
  new TriggeredAbilityEngine({ interactionEngine: new InteractionEngine() }).afterDraw(gameState, opponent, 1);
  const history = originalHistory(gameState);
  return owner.metrics.smotheringTitheTriggers === 1
    && !owner.metrics.smotheringTitheTaxesPaid
    && owner.metrics.smotheringTitheTaxesUnpaid === 1
    && owner.metrics.smotheringTitheTreasuresCreated === 1
    && owner.metrics.treasureTriggers === 1
    && owner.metrics.treasuresBySource['Smothering Tithe'] === 1
    && owner.tokenManager.treasureCount() === 1
    && history
    && gameState.stackManager.history.length === 1
    && !history.stopped
    && debugIncludes(gameState, 'does not pay Smothering Tithe heuristic tax')
    && debugIncludes(gameState, 'Smothering Tithe created 1 Treasure');
}

function smotheringTitheWindowResolves() {
  const owner = testPlayer(['W'], { estimatedBracket: 3 });
  const opponent = testPlayer(['U']);
  owner.addPermanent(card('Smothering Tithe', 'Enchantment', '{3}{W}', ['ramp', 'treasure', 'high-impact']));
  const gameState = new GameState([owner, opponent], { debug: true });
  gameState.turn = 3;
  new TriggeredAbilityEngine({ interactionEngine: new InteractionEngine() }).afterDraw(gameState, opponent, 1);
  const history = gameState.stackManager.history[0];
  return owner.metrics.smotheringTitheTriggers === 1
    && owner.metrics.smotheringTitheTaxesUnpaid === 1
    && owner.metrics.smotheringTitheTreasuresCreated === 1
    && owner.metrics.treasureTriggers === 1
    && owner.tokenManager.treasureCount() === 1
    && owner.metrics.interactionWindowsOpened === 1
    && history
    && history.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && !history.stopped
    && history.priorityResult.reason === 'all_players_passed'
    && debugIncludes(gameState, 'Interaction window opens [triggered-ability/high-impact]');
}

function smotheringTitheWindowStopped() {
  const owner = testPlayer(['W'], { estimatedBracket: 3 });
  const opponent = testPlayer(['G'], { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  owner.addPermanent(card('Smothering Tithe', 'Enchantment', '{3}{W}', ['ramp', 'treasure', 'high-impact']));
  opponent.addPermanent(land('Forest'));
  opponent.hand.push(card('Nature\'s Claim', 'Instant', '{G}', ['removal']));
  const gameState = new GameState([owner, opponent], { debug: true });
  gameState.turn = 3;
  new TriggeredAbilityEngine({ interactionEngine: new InteractionEngine() }).afterDraw(gameState, opponent, 1);
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  return !owner.metrics.smotheringTitheTriggers
    && !owner.metrics.smotheringTitheTaxesPaid
    && !owner.metrics.smotheringTitheTaxesUnpaid
    && !owner.metrics.smotheringTitheTreasuresCreated
    && !owner.metrics.treasureTriggers
    && owner.tokenManager.treasureCount() === 0
    && original
    && response
    && original.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && original.stopped
    && response.respondsTo === original.id
    && opponent.metrics.removalUsed === 1
    && debugIncludes(gameState, 'Smothering Tithe trigger was stopped');
}

function basaltUntapWindowResolves() {
  const player = testPlayer([]);
  const opponent = testPlayer(['G']);
  const basalt = player.addPermanent(artifact('Basalt Monolith'));
  basalt.tapped = true;
  player.addPermanent(artifact('Rings of Brighthearth'));
  addLands(player, 'Wastes', 3);
  const gameState = new GameState([player, opponent], { debug: true });
  gameState.turn = 4;
  const result = new AbilityResolver({ interactionEngine: new InteractionEngine() }).activate(player, basalt, 'untap', { gameState, turn: 4 });
  const history = gameState.stackManager.history[0];
  return result.success
    && !basalt.tapped
    && player.metrics.untapAbilitiesActivated === 1
    && player.metrics.interactionWindowsOpened === 1
    && history
    && history.windowType === WINDOW_TYPES.ACTIVATED_ABILITY
    && !history.stopped
    && debugIncludes(gameState, 'Interaction window opens [activated-ability/combo]');
}

function basaltUntapWindowStopped() {
  const player = testPlayer([]);
  const opponent = testPlayer(['G'], { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const basalt = player.addPermanent(artifact('Basalt Monolith'));
  basalt.tapped = true;
  player.addPermanent(artifact('Rings of Brighthearth'));
  addLands(player, 'Wastes', 3);
  opponent.addPermanent(land('Forest'));
  opponent.hand.push(card('Nature\'s Claim', 'Instant', '{G}', ['removal']));
  const gameState = new GameState([player, opponent], { debug: true });
  gameState.turn = 4;
  const result = new AbilityResolver({ interactionEngine: new InteractionEngine() }).activate(player, basalt, 'untap', { gameState, turn: 4 });
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  return !result.success
    && result.stopped
    && basalt.tapped
    && !player.metrics.untapAbilitiesActivated
    && original
    && response
    && original.windowType === WINDOW_TYPES.ACTIVATED_ABILITY
    && original.stopped
    && opponent.metrics.removalUsed === 1
    && debugIncludes(gameState, 'Basalt Monolith untap ability was stopped');
}

function activatedAbilityCounterplayOneDeep() {
  const player = testPlayer(['U'], { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const opponent = testPlayer(['G'], { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const basalt = player.addPermanent(artifact('Basalt Monolith'));
  basalt.tapped = true;
  player.addPermanent(artifact('Rings of Brighthearth'));
  addLands(player, 'Wastes', 3);
  player.addPermanent(land('Island'));
  player.hand.push(card('Swan Song', 'Instant', '{U}', ['counterspell']));
  opponent.addPermanent(land('Forest'));
  opponent.hand.push(card('Nature\'s Claim', 'Instant', '{G}', ['removal']));
  opponent.hand.push(card('Force of Will', 'Instant', '{3}{U}{U}', ['counterspell', 'free-spell']));
  const gameState = new GameState([player, opponent], { debug: true });
  gameState.turn = 4;
  const result = new AbilityResolver({ interactionEngine: new InteractionEngine() }).activate(player, basalt, 'untap', { gameState, turn: 4 });
  return result.success
    && !basalt.tapped
    && gameState.stackManager.history.length === 2
    && gameState.stackManager.history.filter((object) => object.isResponse).length === 1
    && gameState.stackManager.history.every((object) => object.responseDepth <= 1)
    && player.metrics.counterspellsUsed === 1
    && opponent.metrics.removalUsed === 1;
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
  const id = profile.id || `p${nextTestPlayerId++}`;
  const player = new PlayerState({
    id,
    name: profile.name || id,
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

function originalHistory(gameState) {
  return gameState.stackManager.history.find((object) => !object.isResponse);
}

function responseHistory(gameState) {
  return gameState.stackManager.history.find((object) => object.isResponse);
}

function debugIncludes(gameState, text) {
  return gameState.events.some((event) => String(event.message).includes(text));
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
