const assert = require('assert');
const { CombatEngine } = require('../../game/CombatEngine');
const { GameState } = require('../../game/GameState');
const { InteractionEngine } = require('../../game/InteractionEngine');
const { ACTION_TYPES, WINDOW_TYPES, InteractionWindow, createInteractionWindow } = require('../../game/InteractionWindow');
const { StackObject } = require('../../game/StackObject');
const { StackManager } = require('../../game/StackManager');
const { TurnEngine } = require('../../game/TurnEngine');

function testInteractionWindowsCommand() {
  const tests = [
    ['Interaction window model normalizes window types', windowModelNormalizes],
    ['StackObject can be created from an InteractionWindow', stackObjectFromWindow],
    ['StackObject handles missing interaction windows safely', stackObjectMissingWindowGuard],
    ['StackManager push peek pop and size work', stackManagerBasics],
    ['StackManager resolves malformed stack objects safely', stackManagerMalformedObjectGuard],
    ['Counterspell-like interaction stops high-impact spell', counterStopsHighImpactSpell],
    ['Removal-like interaction stops combo creature or engine', removalStopsComboEngine],
    ['Protection-like interaction defends important board wipe', protectionDefendsBoardWipe],
    ['Lethal combat window can still be stopped', lethalCombatWindowStops],
    ['Counterspell-like interaction can stop lethal combat by policy', counterStopsLethalCombatPolicy],
    ['Combo attempt stopping still works', comboAttemptStoppingStillWorks],
    ['StackManager resolves high-impact spell through interaction', stackManagerResolvesHighImpactStop],
    ['StackManager resolves lethal combat with current counter heuristic', stackManagerResolvesLethalCounter],
    ['Stack history records stopped and resolved objects', stackHistoryRecordsOutcomes],
    ['Real CombatEngine path opens lethal combat interaction window', realCombatEngineOpensLethalWindow],
    ['Real TurnEngine path opens spell interaction window and stack history', realTurnEngineOpensSpellStackWindow],
    ['Unanswered lethal combat resolves without false interaction metrics', unansweredLethalCombatResolves]
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

function stackObjectFromWindow() {
  const player = fixturePlayer('Stack Player');
  const window = createInteractionWindow(player, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  const object = StackObject.fromWindow(window, { turn: 3 });
  return object.sourcePlayer === player
    && object.sourceCard.name === 'Rhystic Study'
    && object.windowType === WINDOW_TYPES.SPELL_CAST
    && object.actionType === ACTION_TYPES.HIGH_IMPACT
    && object.impactScore === 80
    && object.createdAtTurn === 3
    && object.resolved === false;
}

function stackObjectMissingWindowGuard() {
  const object = StackObject.fromWindow(null, { turn: 2 });
  return object
    && !object.isValid()
    && object.createdAtTurn === 2
    && object.debug.invalidWindow === true
    && object.label() === object.id;
}

function stackManagerBasics() {
  const manager = new StackManager();
  const first = new StackObject({ actionType: ACTION_TYPES.HIGH_IMPACT, windowType: WINDOW_TYPES.SPELL_CAST });
  const second = new StackObject({ actionType: ACTION_TYPES.COMBO, windowType: WINDOW_TYPES.COMBO_ATTEMPT });
  manager.push(first);
  manager.push(second);
  const okBeforePop = manager.size() === 2 && manager.peek() === second;
  const popped = manager.pop();
  const okAfterPop = popped === second && manager.size() === 1 && manager.peek() === first;
  manager.clear();
  return okBeforePop && okAfterPop && manager.size() === 0;
}

function stackManagerMalformedObjectGuard() {
  const gameState = new GameState([fixturePlayer('A'), fixturePlayer('B')], { debug: true });
  const manager = gameState.stackManager;
  manager.push(StackObject.fromWindow(null, gameState));
  const result = manager.resolvePending(gameState, new InteractionEngine());
  const history = manager.history[0];
  return !result.stopped
    && result.reason === 'invalid_stack_object'
    && manager.size() === 0
    && history
    && history.resolved
    && !history.stopped
    && debugIncludes(gameState, 'Stack object invalid');
}

function windowModelNormalizes() {
  const player = fixturePlayer('A');
  const spell = createInteractionWindow(player, { actionType: ACTION_TYPES.BOARDWIPE, label: 'Toxic Deluge' });
  const activated = new InteractionWindow({ windowType: WINDOW_TYPES.ACTIVATED_ABILITY, actionType: ACTION_TYPES.COMBO, label: 'Kiki-Jiki activation' });
  const triggered = createInteractionWindow(player, { windowType: WINDOW_TYPES.TRIGGERED_ABILITY, actionType: ACTION_TYPES.HIGH_IMPACT, label: 'Smothering Tithe trigger' });
  return spell.windowType === WINDOW_TYPES.BOARD_WIPE
    && spell.canBeCountered
    && activated.windowType === WINDOW_TYPES.ACTIVATED_ABILITY
    && activated.canBeRemoved
    && !activated.canBeCountered
    && triggered.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && triggered.actionType === ACTION_TYPES.HIGH_IMPACT;
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
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
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

function stackManagerResolvesHighImpactStop() {
  const acting = fixturePlayer('Value Deck');
  const control = fixturePlayer('Control Deck', {
    primaryArchetype: 'control',
    controlPriority: 90,
    estimatedBracket: 4
  });
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([acting, control], { debug: true });
  const window = createInteractionWindow(acting, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80,
    reason: 'early draw engine may snowball'
  });
  gameState.stackManager.push(StackObject.fromWindow(window, gameState));
  const result = gameState.stackManager.resolveTop(gameState, new InteractionEngine());
  const history = gameState.stackManager.history[0];
  return result.stopped
    && result.card === 'Counterspell'
    && gameState.stackManager.size() === 0
    && history
    && history.resolved
    && history.stopped
    && history.result.card === 'Counterspell'
    && debugIncludes(gameState, 'Stack object resolving');
}

function stackManagerResolvesLethalCounter() {
  const aggro = fixturePlayer('Aggro Deck');
  const defender = fixturePlayer('Defender', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  defender.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([aggro, defender], { debug: true });
  const window = createInteractionWindow(aggro, {
    windowType: WINDOW_TYPES.COMBAT,
    actionType: ACTION_TYPES.LETHAL,
    label: 'lethal attack',
    targetPlayer: defender,
    impactScore: 92,
    canBeCountered: true,
    canBeRemoved: true,
    canBeProtected: true,
    reason: 'combat damage would eliminate the defender'
  });
  gameState.stackManager.push(StackObject.fromWindow(window, gameState));
  const result = gameState.stackManager.resolveTop(gameState, new InteractionEngine());
  return result.stopped
    && result.card === 'Counterspell'
    && defender.metrics.counterspellsUsed === 1
    && gameState.stackManager.history[0].actionType === ACTION_TYPES.LETHAL;
}

function stackHistoryRecordsOutcomes() {
  const acting = fixturePlayer('Actor');
  const responder = fixturePlayer('Responder', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  responder.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([acting, responder], { debug: true });
  const engine = new InteractionEngine();
  engine.attemptToStop(gameState, acting, createInteractionWindow(acting, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  }));
  engine.attemptToStop(gameState, acting, createInteractionWindow(acting, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Esper Sentinel',
    sourceCard: spell('Esper Sentinel', ['draw', 'high-impact'], 1),
    impactScore: 70
  }));
  return gameState.stackManager.history.length === 2
    && gameState.stackManager.history[0].stopped
    && !gameState.stackManager.history[1].stopped
    && gameState.stackManager.history.every((object) => object.resolved)
    && gameState.stackManager.size() === 0;
}

function removalStopsComboEngine() {
  const combo = fixturePlayer('Combo Deck', { primaryArchetype: 'combo', comboPriority: 90, estimatedBracket: 4 });
  const midrange = fixturePlayer('Midrange Deck', { primaryArchetype: 'midrange', removalPriority: 70 });
  midrange.hand.push(spell('Swords to Plowshares', ['removal', 'single-target-removal'], 1));
  const gameState = mockGame([combo, midrange]);
  const result = new InteractionEngine().attemptToStop(gameState, combo, {
    windowType: WINDOW_TYPES.ACTIVATED_ABILITY,
    actionType: ACTION_TYPES.COMBO,
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
    windowType: WINDOW_TYPES.BOARD_WIPE,
    actionType: ACTION_TYPES.BOARDWIPE,
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
    windowType: WINDOW_TYPES.COMBAT,
    actionType: ACTION_TYPES.LETHAL,
    label: 'lethal attack',
    targetPlayer: defender,
    canBeCountered: false,
    canBeRemoved: true,
    impactScore: 92,
    reason: 'combat damage would eliminate the defender'
  });
  return result.stopped && result.card === 'Path to Exile' && defender.metrics.lethalAttacksStopped === 1;
}

function counterStopsLethalCombatPolicy() {
  const aggro = fixturePlayer('Aggro Deck', { primaryArchetype: 'aggro', aggressionLevel: 85 });
  const defender = fixturePlayer('Defender', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  defender.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = mockGame([aggro, defender]);
  const result = new InteractionEngine().attemptToStop(gameState, aggro, createInteractionWindow(aggro, {
    windowType: WINDOW_TYPES.COMBAT,
    actionType: ACTION_TYPES.LETHAL,
    label: 'lethal attack',
    targetPlayer: defender,
    impactScore: 92,
    canBeCountered: true,
    canBeRemoved: true,
    canBeProtected: true,
    reason: 'combat damage would eliminate the defender'
  }));
  return result.stopped && result.card === 'Counterspell' && defender.metrics.counterspellsUsed === 1;
}

function comboAttemptStoppingStillWorks() {
  const combo = fixturePlayer('Thoracle Combo', { primaryArchetype: 'combo', comboPriority: 100, estimatedBracket: 5 });
  const control = fixturePlayer('Blue Control', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 5 });
  control.hand.push(spell('Force of Will', ['counterspell', 'free-spell'], 5));
  const gameState = mockGame([combo, control]);
  const result = new InteractionEngine().attemptToStop(gameState, combo, {
    actionType: ACTION_TYPES.COMBO,
    windowType: WINDOW_TYPES.COMBO_ATTEMPT,
    label: 'Thassa Oracle Consultation',
    impactScore: 100
  });
  return result.stopped && control.metrics.comboAttemptsStopped === 1 && control.metrics.counterspellsUsed === 1;
}

function realCombatEngineOpensLethalWindow() {
  const attacker = fixturePlayer('Attacker', { primaryArchetype: 'aggro' });
  const defender = fixturePlayer('Defender', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  attacker.boardScore = 10;
  attacker.damageDealt = 0;
  attacker.commanderPermanentNames = new Set();
  attacker.commanderCombatPower = new Map();
  defender.life = 4;
  defender.interactionShield = 0;
  defender.commanderDamageShield = 0;
  defender.commanderDamage = new Map();
  defender.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([attacker, defender], { debug: true });
  gameState.turn = 4;
  const combat = new CombatEngine({ interactionEngine: new InteractionEngine() });
  combat.attack(gameState, attacker, { combatTarget: () => defender });
  return defender.life === 4
    && defender.metrics.counterspellsUsed === 1
    && gameState.stackManager.history.length === 1
    && gameState.stackManager.history[0].stopped
    && gameState.stackManager.history[0].actionType === ACTION_TYPES.LETHAL
    && debugIncludes(gameState, `Interaction window opens [${WINDOW_TYPES.COMBAT}/${ACTION_TYPES.LETHAL}]`);
}

function realTurnEngineOpensSpellStackWindow() {
  const caster = fixturePlayer('Value Deck', { primaryArchetype: 'midrange' });
  const control = fixturePlayer('Blue Control', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  const rhysticStudy = spell('Rhystic Study', ['draw', 'high-impact'], 3);
  caster.hand.push(rhysticStudy);
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([caster, control], { debug: true });
  gameState.turn = 2;
  const turnEngine = new TurnEngine({
    behaviorRegistry: { get: () => ({ cast: () => ({ message: 'generic cast' }) }) },
    combatEngine: new CombatEngine(),
    decisionEngine: null,
    interactionEngine: new InteractionEngine()
  });
  turnEngine.castAction(gameState, caster, {
    highestThreatOpponent: () => control
  }, { type: 'cast_draw', card: rhysticStudy }, rhysticStudy);
  const history = gameState.stackManager.history[0];
  return history
    && history.actionType === ACTION_TYPES.HIGH_IMPACT
    && history.windowType === WINDOW_TYPES.SPELL_CAST
    && history.stopped
    && control.metrics.counterspellsUsed === 1
    && caster.metrics.highImpactSpellsStoppedAgainst === 1
    && debugIncludes(gameState, 'Stack object pushed')
    && debugIncludes(gameState, `Interaction window opens [${WINDOW_TYPES.SPELL_CAST}/${ACTION_TYPES.HIGH_IMPACT}]`);
}

function unansweredLethalCombatResolves() {
  const attacker = fixturePlayer('Attacker', { primaryArchetype: 'aggro' });
  const defender = fixturePlayer('Defender', { primaryArchetype: 'midrange' });
  attacker.boardScore = 10;
  attacker.damageDealt = 0;
  attacker.commanderPermanentNames = new Set();
  attacker.commanderCombatPower = new Map();
  defender.life = 4;
  defender.interactionShield = 0;
  defender.commanderDamageShield = 0;
  defender.commanderDamage = new Map();
  defender.hand.push(spell('Llanowar Elves', ['creature'], 1));
  const gameState = new GameState([attacker, defender], { debug: true });
  gameState.turn = 4;
  const combat = new CombatEngine({ interactionEngine: new InteractionEngine() });
  combat.attack(gameState, attacker, { combatTarget: () => defender });
  const history = gameState.stackManager.history[0];
  return defender.life === -1
    && attacker.damageDealt === 5
    && history
    && history.actionType === ACTION_TYPES.LETHAL
    && !history.stopped
    && !defender.metrics.counterspellsUsed
    && !defender.metrics.removalUsed
    && !defender.metrics.lethalAttacksStopped
    && debugIncludes(gameState, 'Interaction window closes: lethal attack resolves');
}

function fixturePlayer(name, profile = {}) {
  const player = {
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
    metrics: { spellsCast: 0 },
    canPayCard(card) {
      if ((card.tags || []).includes('free-spell')) return true;
      return this.availableMana >= (card.manaValue || 0);
    },
    payCard(card) {
      if ((card.tags || []).includes('free-spell')) return true;
      if (!this.canPayCard(card)) return false;
      this.availableMana -= card.manaValue || 0;
      this.lastManaPayment = {
        success: true,
        paidCost: card.manaCost || `{${card.manaValue || 0}}`,
        sourcesUsed: ['test mana']
      };
      return true;
    },
    removeFromHand(card) {
      const index = this.hand.indexOf(card);
      if (index >= 0) this.hand.splice(index, 1);
    }
  };
  return player;
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
