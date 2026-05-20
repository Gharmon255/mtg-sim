const assert = require('assert');
const { InteractionEngine } = require('../../game/InteractionEngine');
const { InteractionWindow, createInteractionWindow } = require('../../game/InteractionWindow');

function testInteractionWindowsCommand() {
  const tests = [
    ['Interaction window model normalizes window types', windowModelNormalizes],
    ['Counterspell-like interaction stops high-impact spell', counterStopsHighImpactSpell],
    ['Removal-like interaction stops combo creature or engine', removalStopsComboEngine],
    ['Protection-like interaction defends important board wipe', protectionDefendsBoardWipe],
    ['Lethal combat window can still be stopped', lethalCombatWindowStops],
    ['Combo attempt stopping still works', comboAttemptStoppingStillWorks]
  ];

  console.log('Interaction Window Tests');
  console.log('========================');
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
  console.log(`Passed ${passed}/${tests.length} interaction window checks.`);
  return 0;
}

function windowModelNormalizes() {
  const player = fixturePlayer('A');
  const spell = createInteractionWindow(player, { kind: 'boardwipe', label: 'Toxic Deluge' });
  const activated = new InteractionWindow({ windowType: 'activated-ability', kind: 'combo', label: 'Kiki-Jiki activation' });
  const triggered = createInteractionWindow(player, { windowType: 'triggered-ability', kind: 'high-impact', label: 'Smothering Tithe trigger' });
  return spell.windowType === 'board-wipe'
    && spell.canBeCountered
    && activated.windowType === 'activated-ability'
    && activated.canBeRemoved
    && !activated.canBeCountered
    && triggered.windowType === 'triggered-ability'
    && triggered.actionType === 'high-impact';
}

function counterStopsHighImpactSpell() {
  const acting = fixturePlayer('Value Deck');
  const control = fixturePlayer('Control Deck', {
    primaryArchetype: 'control',
    controlPriority: 90,
    estimatedBracket: 4
  });
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = mockGame([acting, control]);
  const result = new InteractionEngine().attemptToStop(gameState, acting, {
    windowType: 'spell-cast',
    kind: 'high-impact',
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80,
    reason: 'early draw engine may snowball'
  });
  return result.stopped
    && result.card === 'Counterspell'
    && control.metrics.counterspellsUsed === 1
    && debugIncludes(gameState, 'Interaction window opens [spell-cast/high-impact]');
}

function removalStopsComboEngine() {
  const combo = fixturePlayer('Combo Deck', { primaryArchetype: 'combo', comboPriority: 90, estimatedBracket: 4 });
  const midrange = fixturePlayer('Midrange Deck', { primaryArchetype: 'midrange', removalPriority: 70 });
  midrange.hand.push(spell('Swords to Plowshares', ['removal', 'single-target-removal'], 1));
  const gameState = mockGame([combo, midrange]);
  const result = new InteractionEngine().attemptToStop(gameState, combo, {
    windowType: 'activated-ability',
    kind: 'combo',
    label: 'Kiki-Jiki activation',
    sourceCard: creature('Kiki-Jiki, Mirror Breaker', ['combo-piece']),
    canBeCountered: false,
    canBeRemoved: true,
    impactScore: 95,
    reason: 'combo engine activation can win the game'
  });
  return result.stopped && result.card === 'Swords to Plowshares' && midrange.metrics.removalUsed === 1;
}

function protectionDefendsBoardWipe() {
  const sweeper = fixturePlayer('Sweeper Deck');
  sweeper.hand.push(spell('Heroic Intervention', ['protection'], 2));
  const tokens = fixturePlayer('Tokens Deck', { primaryArchetype: 'tokens', controlPriority: 20, estimatedBracket: 3 });
  tokens.boardScore = 15;
  tokens.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = mockGame([sweeper, tokens]);
  const result = new InteractionEngine().attemptToStop(gameState, sweeper, {
    windowType: 'board-wipe',
    kind: 'boardwipe',
    label: 'Toxic Deluge',
    sourceCard: spell('Toxic Deluge', ['boardwipe', 'high-impact'], 3),
    impactScore: 90,
    reason: 'board wipe would reset a large board'
  });
  return !result.stopped
    && tokens.metrics.counterspellsUsed === 1
    && sweeper.metrics.protectionUsed === 1
    && debugIncludes(gameState, 'protects Toxic Deluge');
}

function lethalCombatWindowStops() {
  const aggro = fixturePlayer('Aggro Deck', { primaryArchetype: 'aggro', aggressionLevel: 85 });
  const defender = fixturePlayer('Defender', { primaryArchetype: 'control', removalPriority: 80 });
  defender.hand.push(spell('Path to Exile', ['removal', 'single-target-removal'], 1));
  const gameState = mockGame([aggro, defender]);
  const result = new InteractionEngine().attemptToStop(gameState, aggro, {
    windowType: 'combat',
    kind: 'lethal',
    label: 'lethal attack',
    targetPlayer: defender,
    canBeCountered: false,
    canBeRemoved: true,
    impactScore: 92,
    reason: 'combat damage would eliminate the defender'
  });
  return result.stopped && result.card === 'Path to Exile' && defender.metrics.lethalAttacksStopped === 1;
}

function comboAttemptStoppingStillWorks() {
  const combo = fixturePlayer('Thoracle Combo', { primaryArchetype: 'combo', comboPriority: 100, estimatedBracket: 5 });
  const control = fixturePlayer('Blue Control', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 5 });
  control.hand.push(spell('Force of Will', ['counterspell', 'free-spell'], 5));
  const gameState = mockGame([combo, control]);
  const result = new InteractionEngine().attemptToStop(gameState, combo, {
    kind: 'combo',
    label: 'Thassa Oracle Consultation',
    impactScore: 100
  });
  return result.stopped && control.metrics.comboAttemptsStopped === 1 && control.metrics.counterspellsUsed === 1;
}

function fixturePlayer(name, profile = {}) {
  return {
    id: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    life: 40,
    boardScore: 0,
    availableMana: 10,
    hand: [],
    graveyard: [],
    eliminated: false,
    strategyProfile: {
      primaryArchetype: 'midrange',
      controlPriority: 50,
      removalPriority: 50,
      estimatedBracket: 3,
      ...profile
    },
    metrics: {}
  };
}

function spell(name, tags = [], manaValue = 1) {
  return {
    name,
    tags,
    manaValue,
    manaCost: `{${manaValue}}`,
    typeLine: 'Instant',
    oracleText: ''
  };
}

function creature(name, tags = []) {
  return {
    name,
    tags: tags.concat('creature'),
    manaValue: 5,
    manaCost: '{2}{R}{R}{R}',
    typeLine: 'Legendary Creature',
    oracleText: ''
  };
}

function mockGame(players) {
  return {
    turn: 4,
    debug: true,
    events: [],
    opponentsOf(player) {
      return players.filter((candidate) => candidate.id !== player.id);
    },
    record(message) {
      this.events.push({ turn: this.turn, message });
    },
    recordDebug(message) {
      this.record(message);
    }
  };
}

function debugIncludes(gameState, text) {
  return gameState.events.some((event) => String(event.message).includes(text));
}

module.exports = { testInteractionWindowsCommand };
