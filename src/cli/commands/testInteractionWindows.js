const assert = require('assert');
const { CombatEngine } = require('../../game/CombatEngine');
const { GameState } = require('../../game/GameState');
const { InteractionEngine } = require('../../game/InteractionEngine');
const { ACTION_TYPES, WINDOW_TYPES, InteractionWindow, createInteractionWindow } = require('../../game/InteractionWindow');
const { StackObject } = require('../../game/StackObject');
const { StackManager } = require('../../game/StackManager');
const { TurnEngine } = require('../../game/TurnEngine');
const { PlayerState } = require('../../game/PlayerState');

function testInteractionWindowsCommand() {
  const tests = [
    ['Interaction window model normalizes window types', windowModelNormalizes],
    ['StackObject can be created from an InteractionWindow', stackObjectFromWindow],
    ['StackObject handles missing interaction windows safely', stackObjectMissingWindowGuard],
    ['StackManager push peek pop and size work', stackManagerBasics],
    ['StackManager resolves malformed stack objects safely', stackManagerMalformedObjectGuard],
    ['Priority pass order is source then table-order opponents', priorityPassOrderIsSourceThenTableOpponents],
    ['Priority pass resolves when all responders pass', priorityPassAllRespondersPass],
    ['Priority pass stops object when later opponent has response', priorityPassStopsWithLaterOpponentResponse],
    ['One-deep counterplay lets original spell resolve', oneDeepCounterplayLetsOriginalResolve],
    ['No counter-back leaves original stopped', noCounterBackLeavesOriginalStopped],
    ['Nested response history resolves LIFO', nestedResponseHistoryResolvesLifo],
    ['Nested response depth is capped at one response object', nestedResponseDepthIsCapped],
    ['Nested response depth guard refuses response-to-response', nestedResponseDepthGuardRefusesResponseToResponse],
    ['Nested response metrics are not double-counted', nestedResponseMetricsAreNotDoubleCounted],
    ['Legacy skipStackObject path uses same table-order responders', skipStackObjectUsesTableOrderResponders],
    ['Counterspell-like interaction stops high-impact spell', counterStopsHighImpactSpell],
    ['Removal-like interaction stops combo creature or engine', removalStopsComboEngine],
    ['Protection-like interaction defends important board wipe', protectionDefendsBoardWipe],
    ['Board wipe window records priority metadata through production stack', boardWipeUsesPriorityHistory],
    ['Lethal combat window can still be stopped', lethalCombatWindowStops],
    ['Counterspell-like interaction can stop lethal combat by policy', counterStopsLethalCombatPolicy],
    ['Combo attempt stopping still works', comboAttemptStoppingStillWorks],
    ['Combo attempt window records priority metadata through production stack', comboAttemptUsesPriorityHistory],
    ['Production stack path resolves high-impact spell through priority', stackManagerResolvesHighImpactStop],
    ['Production stack path resolves lethal combat with current counter heuristic', stackManagerResolvesLethalCounter],
    ['Stack history records stopped and resolved objects', stackHistoryRecordsOutcomes],
    ['Real CombatEngine path opens lethal combat interaction window', realCombatEngineOpensLethalWindow],
    ['Real TurnEngine path opens spell interaction window and stack history', realTurnEngineOpensSpellStackWindow],
    ['Real TurnEngine draw path opens triggered ability interaction window', realTurnEngineDrawOpensTriggeredWindow],
    ['Real TurnEngine upkeep path gates activated ability interaction window', realTurnEngineUpkeepGatesActivatedWindow],
    ['Rhystic-style opponent-cast trigger opens and resolves', rhysticOpponentCastTriggerResolves],
    ['Rhystic-style opponent-cast trigger can be stopped', rhysticOpponentCastTriggerStopped],
    ['Real TurnEngine cast path opens Rhystic-style trigger window', realTurnEngineCastOpensRhysticWindow],
    ['Stopped original spell does not open Rhystic-style trigger', stoppedOriginalSpellDoesNotOpenRhysticTrigger],
    ['Tutor spell cast can open Rhystic-style trigger window', tutorCastCanOpenRhysticTrigger],
    ['Multiple Rhystic-style controllers open sequential trigger windows', multipleRhysticControllersOpenSequentialWindows],
    ['Mystic Remora-style trigger opens and resolves on noncreature cast', mysticNonCreatureTriggerResolves],
    ['Mystic Remora-style trigger can be stopped', mysticNonCreatureTriggerStopped],
    ['Creature cast does not open Mystic Remora-style trigger', creatureCastDoesNotOpenMysticTrigger],
    ['No Mystic permanent means no Mystic Remora-style trigger', noMysticMeansNoMysticTrigger],
    ['Mystic Remora-style trigger coexists with high-impact spell window', mysticTriggerCoexistsWithHighImpactSpellWindow],
    ['Rhystic and Mystic triggers coexist without double-counting windows', rhysticAndMysticCoexistOnHighImpactNoncreature],
    ['Ambiguous no-type cast does not open Mystic Remora-style trigger', ambiguousNoTypeCastDoesNotOpenMysticTrigger],
    ['Low-MV noncreature triggers Mystic but not Rhystic', lowMvNonCreatureTriggersMysticNotRhystic],
    ['Low-impact opponent cast does not open Rhystic-style trigger window', lowImpactCastDoesNotOpenRhysticWindow],
    ['No Rhystic-style permanent means no opponent-cast trigger window', noRhysticMeansNoOpponentCastTrigger],
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

function priorityPassOrderIsSourceThenTableOpponents() {
  const left = fixturePlayer('Left Seat');
  const source = fixturePlayer('Source Player');
  const right = fixturePlayer('Right Seat');
  const gameState = new GameState([left, source, right], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Esper Sentinel',
    sourceCard: spell('Esper Sentinel', ['draw', 'high-impact'], 1),
    impactScore: 70,
    reason: 'priority order test'
  });
  const priority = gameState.stackManager.history[0].priority;
  return !result.stopped
    && priority.order.join(' > ') === 'Source Player > Left Seat > Right Seat'
    && priority.ordering === 'source-then-table-order'
    && gameState.stackManager.history[0].priorityResult
    && priority.passes.length === 3
    && debugIncludes(gameState, 'Priority pass begins')
    && debugIncludes(gameState, 'Priority order: Source Player -> Left Seat -> Right Seat');
}

function priorityPassAllRespondersPass() {
  const source = fixturePlayer('Source Player');
  const first = fixturePlayer('First Opponent');
  const second = fixturePlayer('Second Opponent');
  first.hand.push(spell('Llanowar Elves', ['creature'], 1));
  second.hand.push(spell('Cultivate', ['ramp'], 3));
  const gameState = new GameState([source, first, second], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  const history = gameState.stackManager.history[0];
  return !result.stopped
    && history.resolved
    && !history.stopped
    && history.priority.passes.length === 3
    && history.priority.responses.length === 0
    && history.priority.result.stopped === false
    && history.priorityResult.reason === 'all_players_passed'
    && source.metrics.stackObjectsProcessed === 1
    && source.metrics.stackObjectsResolved === 1
    && debugIncludes(gameState, 'Priority pass complete: all responders passed');
}

function priorityPassStopsWithLaterOpponentResponse() {
  const source = fixturePlayer('Source Player');
  const first = fixturePlayer('First Opponent');
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  first.hand.push(spell('Llanowar Elves', ['creature'], 1));
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([source, first, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  const history = originalHistory(gameState);
  const responseObject = responseHistory(gameState);
  return result.stopped
    && result.card === 'Counterspell'
    && responseObject
    && responseObject.respondsTo === history.id
    && history.priority.passes.map((pass) => pass.player).join(' > ') === 'Source Player > First Opponent'
    && history.priority.responses.length === 1
    && history.priority.responses[0].player === 'Control Opponent'
    && history.priority.responses[0].stackObjectId === responseObject.id
    && history.priority.result.stopped === true
    && history.priorityResult.stopped === true
    && source.metrics.stackObjectsProcessed === 1
    && !source.metrics.stackObjectsResolved
    && debugIncludes(gameState, 'Priority pass complete: Rhystic Study has a stopping response');
}

function oneDeepCounterplayLetsOriginalResolve() {
  const source = fixturePlayer('Source Player', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  source.hand.push(spell('Swan Song', ['counterspell'], 1));
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([source, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80,
    reason: 'counter war test'
  });
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  return !result.stopped
    && result.reason === 'response_stopped_by_counterplay'
    && response
    && original
    && gameState.stackManager.history[0] === response
    && gameState.stackManager.history[1] === original
    && response.stopped
    && response.result.card === 'Swan Song'
    && response.respondsTo === original.id
    && !original.stopped
    && original.priority.responses[0].counterplay.card === 'Swan Song'
    && source.metrics.counterspellsUsed === 1
    && control.metrics.counterspellsUsed === 1
    && source.metrics.interactionWindowsOpened === 1
    && !control.metrics.interactionWindowsOpened
    && debugIncludes(gameState, 'Nested response object pushed')
    && debugIncludes(gameState, 'Counterplay opportunity')
    && debugIncludes(gameState, 'Nested response resolved first');
}

function noCounterBackLeavesOriginalStopped() {
  const source = fixturePlayer('Source Player');
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([source, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  return result.stopped
    && result.card === 'Counterspell'
    && response
    && original
    && gameState.stackManager.history[0] === response
    && gameState.stackManager.history[1] === original
    && !response.stopped
    && original.stopped
    && response.priority.passes[0].reason === 'no_legal_counterplay'
    && debugIncludes(gameState, 'Counterplay pass');
}

function nestedResponseHistoryResolvesLifo() {
  const source = fixturePlayer('Source Player', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  source.hand.push(spell('Swan Song', ['counterspell'], 1));
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([source, control], { debug: true });
  new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'The One Ring',
    sourceCard: spell('The One Ring', ['draw', 'high-impact'], 4),
    impactScore: 88
  });
  return gameState.stackManager.history.length === 2
    && gameState.stackManager.history[0].isResponse
    && !gameState.stackManager.history[1].isResponse
    && gameState.stackManager.history[0].respondsTo === gameState.stackManager.history[1].id
    && gameState.stackManager.history.every((object) => object.resolved)
    && gameState.stackManager.size() === 0;
}

function nestedResponseDepthIsCapped() {
  const source = fixturePlayer('Source Player', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  source.hand.push(spell('Swan Song', ['counterspell'], 1));
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  control.hand.push(spell('Force of Will', ['counterspell', 'free-spell'], 5));
  const gameState = new GameState([source, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  return !result.stopped
    && gameState.stackManager.history.filter((object) => object.isResponse).length === 1
    && control.hand.length === 1
    && ['Counterspell', 'Force of Will'].includes(control.hand[0].name)
    && gameState.stackManager.history.every((object) => object.responseDepth <= 1);
}

function nestedResponseDepthGuardRefusesResponseToResponse() {
  const source = fixturePlayer('Source Player', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  source.hand.push(spell('Swan Song', ['counterspell'], 1));
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  control.hand.push(spell('Force of Will', ['counterspell', 'free-spell'], 5));
  const gameState = new GameState([source, control], { debug: true });
  const engine = new InteractionEngine();
  const result = engine.attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  const historyLengthBeforeRefusedThird = gameState.stackManager.history.length;
  const sourceWindowsBefore = source.metrics.interactionWindowsOpened || 0;
  const controlWindowsBefore = control.metrics.interactionWindowsOpened || 0;
  const refused = engine.priorityManager.resolveOneDeepResponse(
    gameState,
    response,
    response.sourcePlayer,
    control,
    control.hand[0],
    response.window.toAttempt(),
    engine
  );
  return !result.stopped
    && original
    && response
    && response.isResponse
    && response.respondsTo === original.id
    && refused.result.reason === 'nested_response_depth_limit'
    && refused.responseObject === null
    && gameState.stackManager.history.length === historyLengthBeforeRefusedThird
    && gameState.stackManager.history.length === 2
    && gameState.stackManager.history.filter((object) => object.isResponse).length === 1
    && (source.metrics.interactionWindowsOpened || 0) === sourceWindowsBefore
    && (control.metrics.interactionWindowsOpened || 0) === controlWindowsBefore
    && debugIncludes(gameState, 'nested_response_depth_limit');
}

function nestedResponseMetricsAreNotDoubleCounted() {
  const source = fixturePlayer('Source Player', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const control = fixturePlayer('Control Opponent', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  source.hand.push(spell('Swan Song', ['counterspell'], 1));
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([source, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  return !result.stopped
    && original
    && response
    && source.metrics.interactionWindowsOpened === 1
    && !control.metrics.interactionWindowsOpened
    && source.metrics.stackObjectsProcessed === 1
    && source.metrics.stackObjectsResolved === 1
    && control.metrics.stackObjectsProcessed === 1
    && !control.metrics.stackObjectsResolved
    && source.metrics.counterspellsUsed === 1
    && control.metrics.counterspellsUsed === 1
    && gameState.stackManager.history.length === 2;
}

function skipStackObjectUsesTableOrderResponders() {
  const source = fixturePlayer('Source Player');
  const first = fixturePlayer('First Responder', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const second = fixturePlayer('Second Responder', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  first.hand.push(spell('Counterspell', ['counterspell'], 2));
  second.hand.push(spell('Force of Will', ['counterspell', 'free-spell'], 5));
  const gameState = new GameState([source, first, second], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, source, {
    skipStackObject: true,
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80
  });
  return result.stopped
    && result.by === 'First Responder'
    && first.metrics.counterspellsUsed === 1
    && second.metrics.counterspellsUsed === undefined
    && gameState.stackManager.history.length === 0
    && debugIncludes(gameState, 'Interaction window responders: First Responder, Second Responder');
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
  const history = originalHistory(gameState);
  return result.stopped
    && result.card === 'Counterspell'
    && control.metrics.counterspellsUsed === 1
    && history.priority.responses.length === 1
    && history.priorityResult.stopped === true
    && debugIncludes(gameState, 'Priority pass begins')
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
  const result = new InteractionEngine().attemptToStop(gameState, acting, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: ACTION_TYPES.HIGH_IMPACT,
    label: 'Rhystic Study',
    sourceCard: spell('Rhystic Study', ['draw', 'high-impact'], 3),
    impactScore: 80,
    reason: 'early draw engine may snowball'
  });
  const history = originalHistory(gameState);
  const response = responseHistory(gameState);
  return result.stopped
    && result.card === 'Counterspell'
    && gameState.stackManager.size() === 0
    && history
    && response
    && response.resolved
    && history.resolved
    && history.stopped
    && history.priority
    && history.priorityResult
    && history.result.card === 'Counterspell'
    && debugIncludes(gameState, 'Stack object resolving');
}

function stackManagerResolvesLethalCounter() {
  const aggro = fixturePlayer('Aggro Deck');
  const defender = fixturePlayer('Defender', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  defender.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([aggro, defender], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, aggro, {
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
  const history = originalHistory(gameState);
  const response = responseHistory(gameState);
  return result.stopped
    && result.card === 'Counterspell'
    && defender.metrics.counterspellsUsed === 1
    && response
    && response.respondsTo === history.id
    && history.actionType === ACTION_TYPES.LETHAL
    && history.priority
    && history.priorityResult;
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
  const response = gameState.stackManager.history[0];
  const stoppedOriginal = gameState.stackManager.history[1];
  const resolvedOriginal = gameState.stackManager.history[2];
  return gameState.stackManager.history.length === 3
    && response.isResponse
    && !response.stopped
    && stoppedOriginal.stopped
    && !resolvedOriginal.stopped
    && stoppedOriginal.priority.responses.length === 1
    && gameState.stackManager.history.every((object) => object.priorityResult)
    && resolvedOriginal.priority.passes.length >= 2
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
  const original = originalHistory(gameState);
  const response = responseHistory(gameState);
  return !result.stopped
    && tokens.metrics.counterspellsUsed === 1
    && sweeper.metrics.protectionUsed === 1
    && response.stopped
    && original.priorityResult.reason === 'response_stopped_by_counterplay'
    && debugIncludes(gameState, 'protects Toxic Deluge');
}

function boardWipeUsesPriorityHistory() {
  const sweeper = fixturePlayer('Sweeper Deck');
  const control = fixturePlayer('Control Deck', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  control.boardScore = 15;
  control.hand.push(spell('Counterspell', ['counterspell'], 2));
  const gameState = new GameState([sweeper, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, sweeper, {
    windowType: WINDOW_TYPES.BOARD_WIPE,
    actionType: ACTION_TYPES.BOARDWIPE,
    label: 'Toxic Deluge',
    sourceCard: spell('Toxic Deluge', ['boardwipe', 'high-impact'], 3),
    impactScore: 90,
    reason: 'board wipe would reset a large board'
  });
  const history = originalHistory(gameState);
  const response = responseHistory(gameState);
  return result.stopped
    && history
    && response
    && history.windowType === WINDOW_TYPES.BOARD_WIPE
    && history.actionType === ACTION_TYPES.BOARDWIPE
    && history.priority
    && history.priorityResult.stopped
    && history.priority.responses[0].player === 'Control Deck'
    && debugIncludes(gameState, 'Priority pass begins');
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
  return result.stopped
    && control.metrics.comboAttemptsStopped === 1
    && control.metrics.counterspellsUsed === 1;
}

function comboAttemptUsesPriorityHistory() {
  const combo = fixturePlayer('Thoracle Combo', { primaryArchetype: 'combo', comboPriority: 100, estimatedBracket: 5 });
  const control = fixturePlayer('Blue Control', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 5 });
  control.hand.push(spell('Force of Will', ['counterspell', 'free-spell'], 5));
  const gameState = new GameState([combo, control], { debug: true });
  const result = new InteractionEngine().attemptToStop(gameState, combo, {
    actionType: ACTION_TYPES.COMBO,
    windowType: WINDOW_TYPES.COMBO_ATTEMPT,
    label: 'Thassa Oracle Consultation',
    impactScore: 100,
    reason: 'detected combo attempt may end the game'
  });
  const history = originalHistory(gameState);
  const response = responseHistory(gameState);
  return result.stopped
    && history
    && response
    && history.windowType === WINDOW_TYPES.COMBO_ATTEMPT
    && history.actionType === ACTION_TYPES.COMBO
    && history.priority
    && history.priorityResult.stopped
    && history.priority.responses[0].player === 'Blue Control'
    && debugIncludes(gameState, 'Priority pass begins');
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
  const history = originalHistory(gameState);
  const response = responseHistory(gameState);
  return defender.life === 4
    && defender.metrics.counterspellsUsed === 1
    && gameState.stackManager.history.length === 2
    && response
    && history.stopped
    && history.priority.responses[0].player === 'Defender'
    && history.actionType === ACTION_TYPES.LETHAL
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
  const history = originalHistory(gameState);
  const response = responseHistory(gameState);
  return history
    && response
    && history.actionType === ACTION_TYPES.HIGH_IMPACT
    && history.windowType === WINDOW_TYPES.SPELL_CAST
    && history.stopped
    && control.metrics.counterspellsUsed === 1
    && caster.metrics.highImpactSpellsStoppedAgainst === 1
    && debugIncludes(gameState, 'Stack object pushed')
    && debugIncludes(gameState, `Interaction window opens [${WINDOW_TYPES.SPELL_CAST}/${ACTION_TYPES.HIGH_IMPACT}]`);
}

function realTurnEngineDrawOpensTriggeredWindow() {
  const tithePlayer = realPlayer('Tithe Player', { estimatedBracket: 3 });
  const activePlayer = realPlayer('Drawing Player');
  tithePlayer.addPermanent(realCard('Smothering Tithe', 'Enchantment', '{3}{W}', ['ramp', 'treasure', 'high-impact']));
  activePlayer.library.push(realCard('Drawn Card', 'Sorcery', '{1}', []));
  const gameState = new GameState([activePlayer, tithePlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = new TurnEngine({
    behaviorRegistry: { get: () => ({ canCast: () => false }) },
    combatEngine: { attack: () => {} },
    decisionEngine: idleDecisionEngine(),
    interactionEngine: new InteractionEngine()
  });
  turnEngine.takeTurn(gameState, activePlayer, { highestThreatOpponent: () => tithePlayer });
  const history = originalHistory(gameState, 'Smothering Tithe trigger');
  return activePlayer.hand.some((card) => card.name === 'Drawn Card')
    && tithePlayer.metrics.treasureTriggers === 1
    && tithePlayer.tokenManager.treasureCount() === 1
    && history
    && history.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && history.priorityResult.reason === 'all_players_passed'
    && tithePlayer.metrics.interactionWindowsOpened === 1
    && debugIncludes(gameState, `Interaction window opens [${WINDOW_TYPES.TRIGGERED_ABILITY}/${ACTION_TYPES.HIGH_IMPACT}]`)
    && debugIncludes(gameState, 'Smothering Tithe created 1 Treasure');
}

function realTurnEngineUpkeepGatesActivatedWindow() {
  const quietPlayer = realPlayer('Quiet Monolith');
  const quietBasalt = quietPlayer.addPermanent(realCard('Basalt Monolith', 'Artifact', '{3}', ['artifact', 'ramp', 'mana-rock']));
  quietBasalt.tapped = true;
  addRealLands(quietPlayer, 'Wastes', 3);
  const quietOpponent = realPlayer('Quiet Opponent');
  const quietGame = new GameState([quietPlayer, quietOpponent], { debug: true });
  quietGame.turn = 4;
  const quietTurn = new TurnEngine({
    behaviorRegistry: { get: () => ({ canCast: () => false }) },
    combatEngine: { attack: () => {} },
    decisionEngine: idleDecisionEngine(),
    interactionEngine: new InteractionEngine()
  });
  quietTurn.takeTurn(quietGame, quietPlayer, { highestThreatOpponent: () => quietOpponent });

  const comboPlayer = realPlayer('Combo Monolith');
  const comboBasalt = comboPlayer.addPermanent(realCard('Basalt Monolith', 'Artifact', '{3}', ['artifact', 'ramp', 'mana-rock']));
  comboBasalt.tapped = true;
  comboPlayer.addPermanent(realCard('Rings of Brighthearth', 'Artifact', '{3}', ['artifact', 'combo-piece']));
  addRealLands(comboPlayer, 'Wastes', 3);
  const comboOpponent = realPlayer('Combo Opponent');
  const comboGame = new GameState([comboPlayer, comboOpponent], { debug: true });
  comboGame.turn = 4;
  const comboTurn = new TurnEngine({
    behaviorRegistry: { get: () => ({ canCast: () => false }) },
    combatEngine: { attack: () => {} },
    decisionEngine: idleDecisionEngine(),
    interactionEngine: new InteractionEngine()
  });
  comboTurn.takeTurn(comboGame, comboPlayer, { highestThreatOpponent: () => comboOpponent });
  const history = originalHistory(comboGame, 'Basalt Monolith untap ability');

  return quietGame.stackManager.history.length === 0
    && quietBasalt.tapped
    && !quietPlayer.metrics.interactionWindowsOpened
    && history
    && history.windowType === WINDOW_TYPES.ACTIVATED_ABILITY
    && history.actionType === ACTION_TYPES.COMBO
    && history.priorityResult.reason === 'all_players_passed'
    && !comboBasalt.tapped
    && comboPlayer.metrics.untapAbilitiesActivated === 1
    && comboPlayer.metrics.interactionWindowsOpened === 1
    && debugIncludes(comboGame, `Interaction window opens [${WINDOW_TYPES.ACTIVATED_ABILITY}/${ACTION_TYPES.COMBO}]`);
}

function rhysticOpponentCastTriggerResolves() {
  const studyPlayer = realPlayer('Study Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  studyPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyPlayer.library.push(realCard('Drawn From Rhystic', 'Instant', '{U}', []));
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  const gameState = new GameState([caster, studyPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => studyPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const spellWindow = originalHistory(gameState, 'The One Ring');
  const triggerWindow = originalHistory(gameState, 'Rhystic Study trigger');
  return spellWindow
    && triggerWindow
    && triggerWindow.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && triggerWindow.priorityResult.reason === 'all_players_passed'
    && studyPlayer.cardsDrawn === 1
    && studyPlayer.hand.some((card) => card.name === 'Drawn From Rhystic')
    && studyPlayer.metrics.rhysticStudyDraws === 1
    && studyPlayer.metrics.interactionWindowsOpened === 1
    && caster.metrics.interactionWindowsOpened === 1
    && debugIncludes(gameState, 'Rhystic Study drew 1 card for Study Player');
}

function rhysticOpponentCastTriggerStopped() {
  const studyPlayer = realPlayer('Study Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  studyPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyPlayer.library.push(realCard('Would Have Drawn', 'Instant', '{U}', []));
  caster.addPermanent(realCard('Forest', 'Land', '', ['land']), { summoningSick: false });
  caster.hand.push(realCard('Nature\'s Claim', 'Instant', '{G}', ['removal']));
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  const gameState = new GameState([caster, studyPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => studyPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const triggerWindow = originalHistory(gameState, 'Rhystic Study trigger');
  const response = responseHistory(gameState);
  return triggerWindow
    && response
    && triggerWindow.stopped
    && response.respondsTo === triggerWindow.id
    && studyPlayer.cardsDrawn === 0
    && !studyPlayer.metrics.rhysticStudyDraws
    && caster.metrics.removalUsed === 1
    && debugIncludes(gameState, 'Rhystic Study trigger was stopped before Study Player drew a card');
}

function realTurnEngineCastOpensRhysticWindow() {
  const studyPlayer = realPlayer('Study Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  studyPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyPlayer.library.push(realCard('TurnEngine Rhystic Draw', 'Instant', '{U}', []));
  caster.hand.push(castCard);
  const gameState = new GameState([caster, studyPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine(scriptedDecisionEngine({ type: 'cast_draw', card: castCard }));
  turnEngine.takeTurn(gameState, caster, { highestThreatOpponent: () => studyPlayer });
  const spellWindow = originalHistory(gameState, 'The One Ring');
  const triggerWindow = originalHistory(gameState, 'Rhystic Study trigger');
  return spellWindow
    && triggerWindow
    && triggerWindow.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && triggerWindow.priority
    && triggerWindow.priorityResult
    && studyPlayer.cardsDrawn === 1
    && debugIncludes(gameState, `Interaction window opens [${WINDOW_TYPES.TRIGGERED_ABILITY}/${ACTION_TYPES.HIGH_IMPACT}]`);
}

function stoppedOriginalSpellDoesNotOpenRhysticTrigger() {
  const studyPlayer = realPlayer('Study Player', { primaryArchetype: 'control', controlPriority: 95, estimatedBracket: 4 });
  const caster = realPlayer('Caster');
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  studyPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyPlayer.library.push(realCard('Should Not Draw', 'Instant', '{U}', []));
  addRealLands(studyPlayer, 'Island', 2);
  studyPlayer.hand.push(realCard('Counterspell', 'Instant', '{U}{U}', ['counterspell']));
  const gameState = new GameState([caster, studyPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => studyPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const spellWindow = originalHistory(gameState, 'The One Ring');
  return spellWindow
    && spellWindow.stopped
    && responseHistory(gameState)
    && !originalHistory(gameState, 'Rhystic Study trigger')
    && studyPlayer.cardsDrawn === 0
    && !studyPlayer.metrics.rhysticStudyDraws
    && studyPlayer.metrics.counterspellsUsed === 1
    && !studyPlayer.metrics.interactionWindowsOpened
    && caster.metrics.interactionWindowsOpened === 1
    && debugIncludes(gameState, 'Counterspell used to stop The One Ring');
}

function tutorCastCanOpenRhysticTrigger() {
  const studyPlayer = realPlayer('Study Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const tutor = realCard('Diabolic Tutor', 'Sorcery', '{2}{B}{B}', ['tutor', 'high-impact']);
  studyPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyPlayer.library.push(realCard('Tutor Tax Draw', 'Instant', '{U}', []));
  addRealLands(caster, 'Swamp', 4);
  caster.hand.push(tutor);
  const gameState = new GameState([caster, studyPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine({
    chooseCastAction: () => null,
    shouldAttemptCombo: () => null,
    tutorResolver: {
      resolveTutor: () => ({ message: 'Tutor resolved.' })
    }
  });
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => studyPlayer }, { type: 'cast_tutor', card: tutor }, tutor);
  const triggerWindow = originalHistory(gameState, 'Rhystic Study trigger');
  return triggerWindow
    && triggerWindow.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && triggerWindow.priorityResult.reason === 'all_players_passed'
    && triggerWindow.debug.castActionType === 'cast_tutor'
    && studyPlayer.cardsDrawn === 1
    && studyPlayer.hand.some((card) => card.name === 'Tutor Tax Draw')
    && studyPlayer.metrics.rhysticStudyDraws === 1;
}

function multipleRhysticControllersOpenSequentialWindows() {
  const caster = realPlayer('Caster');
  const studyA = realPlayer('Study A', { estimatedBracket: 3 });
  const studyB = realPlayer('Study B', { estimatedBracket: 3 });
  const observer = realPlayer('Observer');
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  studyA.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyB.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyA.library.push(realCard('Study A Draw', 'Instant', '{U}', []));
  studyB.library.push(realCard('Study B Draw', 'Instant', '{U}', []));
  const gameState = new GameState([caster, studyA, studyB, observer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => observer }, { type: 'cast_draw', card: castCard }, castCard);
  const rhysticWindows = gameState.stackManager.history.filter((object) => !object.isResponse && object.label() === 'Rhystic Study trigger');
  return originalHistory(gameState, 'The One Ring')
    && rhysticWindows.length === 2
    && rhysticWindows.every((object) => object.windowType === WINDOW_TYPES.TRIGGERED_ABILITY)
    && rhysticWindows.every((object) => object.priorityResult.reason === 'all_players_passed')
    && studyA.cardsDrawn === 1
    && studyB.cardsDrawn === 1
    && studyA.metrics.interactionWindowsOpened === 1
    && studyB.metrics.interactionWindowsOpened === 1
    && caster.metrics.interactionWindowsOpened === 1;
}

function mysticNonCreatureTriggerResolves() {
  const remoraPlayer = realPlayer('Remora Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('Ponder', ['draw'], 1);
  remoraPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  remoraPlayer.library.push(realCard('Drawn From Remora', 'Instant', '{U}', []));
  const gameState = new GameState([caster, remoraPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => remoraPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const triggerWindow = originalHistory(gameState, 'Mystic Remora trigger');
  return triggerWindow
    && triggerWindow.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && triggerWindow.priorityResult.reason === 'all_players_passed'
    && triggerWindow.debug.castCard === 'Ponder'
    && remoraPlayer.cardsDrawn === 1
    && remoraPlayer.hand.some((card) => card.name === 'Drawn From Remora')
    && remoraPlayer.metrics.mysticRemoraDraws === 1
    && remoraPlayer.metrics.interactionWindowsOpened === 1
    && !caster.metrics.interactionWindowsOpened
    && debugIncludes(gameState, 'Mystic Remora drew 1 card for Remora Player');
}

function mysticNonCreatureTriggerStopped() {
  const remoraPlayer = realPlayer('Remora Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster', { primaryArchetype: 'control', controlPriority: 90, estimatedBracket: 4 });
  const castCard = spell('Ponder', ['draw'], 1);
  remoraPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  remoraPlayer.library.push(realCard('Would Have Drawn', 'Instant', '{U}', []));
  caster.addPermanent(realCard('Forest', 'Land', '', ['land']), { summoningSick: false });
  caster.hand.push(realCard('Nature\'s Claim', 'Instant', '{G}', ['removal']));
  const gameState = new GameState([caster, remoraPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => remoraPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const triggerWindow = originalHistory(gameState, 'Mystic Remora trigger');
  const response = responseHistory(gameState);
  return triggerWindow
    && response
    && triggerWindow.stopped
    && response.respondsTo === triggerWindow.id
    && gameState.stackManager.history.filter((object) => object.isResponse).length === 1
    && gameState.stackManager.history.length === 2
    && remoraPlayer.cardsDrawn === 0
    && !remoraPlayer.metrics.mysticRemoraDraws
    && caster.metrics.removalUsed === 1
    && debugIncludes(gameState, 'Mystic Remora trigger was stopped before Remora Player drew a card');
}

function creatureCastDoesNotOpenMysticTrigger() {
  const remoraPlayer = realPlayer('Remora Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = creature('Llanowar Elves', []);
  remoraPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  remoraPlayer.library.push(realCard('Should Stay Put', 'Instant', '{U}', []));
  const gameState = new GameState([caster, remoraPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => remoraPlayer }, { type: 'cast_creature', card: castCard }, castCard);
  return !originalHistory(gameState, 'Mystic Remora trigger')
    && gameState.stackManager.history.length === 0
    && remoraPlayer.cardsDrawn === 0
    && !remoraPlayer.metrics.interactionWindowsOpened;
}

function noMysticMeansNoMysticTrigger() {
  const observer = realPlayer('Observer', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('Ponder', ['draw'], 1);
  observer.library.push(realCard('Should Not Draw', 'Instant', '{U}', []));
  const gameState = new GameState([caster, observer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => observer }, { type: 'cast_draw', card: castCard }, castCard);
  return !originalHistory(gameState, 'Mystic Remora trigger')
    && gameState.stackManager.history.length === 0
    && observer.cardsDrawn === 0
    && !observer.metrics.interactionWindowsOpened
    && !caster.metrics.interactionWindowsOpened;
}

function mysticTriggerCoexistsWithHighImpactSpellWindow() {
  const remoraPlayer = realPlayer('Remora Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  remoraPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  remoraPlayer.library.push(realCard('Remora High Impact Draw', 'Instant', '{U}', []));
  const gameState = new GameState([caster, remoraPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => remoraPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const spellWindow = originalHistory(gameState, 'The One Ring');
  const triggerWindow = originalHistory(gameState, 'Mystic Remora trigger');
  return spellWindow
    && triggerWindow
    && spellWindow.windowType === WINDOW_TYPES.SPELL_CAST
    && triggerWindow.windowType === WINDOW_TYPES.TRIGGERED_ABILITY
    && gameState.stackManager.history.filter((object) => object.isResponse).length === 0
    && gameState.stackManager.history.length === 2
    && remoraPlayer.cardsDrawn === 1
    && caster.metrics.interactionWindowsOpened === 1
    && remoraPlayer.metrics.interactionWindowsOpened === 1;
}

function rhysticAndMysticCoexistOnHighImpactNoncreature() {
  const taxPlayer = realPlayer('Tax Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  taxPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  taxPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  taxPlayer.library.push(realCard('Rhystic Draw', 'Instant', '{U}', []));
  taxPlayer.library.push(realCard('Mystic Draw', 'Instant', '{U}', []));
  const gameState = new GameState([caster, taxPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => taxPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const spellWindow = originalHistory(gameState, 'The One Ring');
  const rhysticWindow = originalHistory(gameState, 'Rhystic Study trigger');
  const mysticWindow = originalHistory(gameState, 'Mystic Remora trigger');
  const originalWindows = gameState.stackManager.history.filter((object) => !object.isResponse);
  return spellWindow
    && rhysticWindow
    && mysticWindow
    && originalWindows.length === 3
    && gameState.stackManager.history.filter((object) => object.isResponse).length === 0
    && caster.metrics.interactionWindowsOpened === 1
    && taxPlayer.metrics.interactionWindowsOpened === 2
    && taxPlayer.metrics.rhysticStudyDraws === 1
    && taxPlayer.metrics.mysticRemoraDraws === 1
    && taxPlayer.cardsDrawn === 2
    && rhysticWindow.priorityResult.reason === 'all_players_passed'
    && mysticWindow.priorityResult.reason === 'all_players_passed';
}

function ambiguousNoTypeCastDoesNotOpenMysticTrigger() {
  const remoraPlayer = realPlayer('Remora Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = {
    name: 'Ambiguous Card',
    tags: [],
    manaValue: 1,
    manaCost: '{1}',
    oracleText: ''
  };
  remoraPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  remoraPlayer.library.push(realCard('Should Stay Put', 'Instant', '{U}', []));
  const gameState = new GameState([caster, remoraPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => remoraPlayer }, { type: 'cast_unknown', card: castCard }, castCard);
  return !originalHistory(gameState, 'Mystic Remora trigger')
    && gameState.stackManager.history.length === 0
    && remoraPlayer.cardsDrawn === 0
    && !remoraPlayer.metrics.mysticRemoraDraws
    && !remoraPlayer.metrics.interactionWindowsOpened;
}

function lowMvNonCreatureTriggersMysticNotRhystic() {
  const taxPlayer = realPlayer('Tax Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('Ponder', ['draw'], 1);
  taxPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  taxPlayer.addPermanent(realCard('Mystic Remora', 'Enchantment', '{U}', ['draw', 'high-impact']));
  taxPlayer.library.push(realCard('Mystic Low MV Draw', 'Instant', '{U}', []));
  const gameState = new GameState([caster, taxPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => taxPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  const mysticWindow = originalHistory(gameState, 'Mystic Remora trigger');
  return mysticWindow
    && !originalHistory(gameState, 'Rhystic Study trigger')
    && gameState.stackManager.history.length === 1
    && taxPlayer.cardsDrawn === 1
    && taxPlayer.metrics.mysticRemoraDraws === 1
    && !taxPlayer.metrics.rhysticStudyDraws
    && taxPlayer.metrics.interactionWindowsOpened === 1
    && !caster.metrics.interactionWindowsOpened;
}

function lowImpactCastDoesNotOpenRhysticWindow() {
  const studyPlayer = realPlayer('Study Player', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('Ponder', ['draw'], 1);
  studyPlayer.addPermanent(realCard('Rhystic Study', 'Enchantment', '{2}{U}', ['draw', 'high-impact']));
  studyPlayer.library.push(realCard('Should Stay Put', 'Instant', '{U}', []));
  const gameState = new GameState([caster, studyPlayer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => studyPlayer }, { type: 'cast_draw', card: castCard }, castCard);
  return !originalHistory(gameState, 'Rhystic Study trigger')
    && gameState.stackManager.history.length === 0
    && studyPlayer.cardsDrawn === 0
    && !studyPlayer.metrics.interactionWindowsOpened;
}

function noRhysticMeansNoOpponentCastTrigger() {
  const observer = realPlayer('Observer', { estimatedBracket: 3 });
  const caster = realPlayer('Caster');
  const castCard = spell('The One Ring', ['draw', 'high-impact'], 4);
  observer.library.push(realCard('Should Not Draw', 'Instant', '{U}', []));
  const gameState = new GameState([caster, observer], { debug: true });
  gameState.turn = 5;
  const turnEngine = minimalTurnEngine();
  turnEngine.castAction(gameState, caster, { highestThreatOpponent: () => observer }, { type: 'cast_draw', card: castCard }, castCard);
  return originalHistory(gameState, 'The One Ring')
    && !originalHistory(gameState, 'Rhystic Study trigger')
    && observer.cardsDrawn === 0
    && caster.metrics.interactionWindowsOpened === 1
    && !observer.metrics.interactionWindowsOpened;
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
    && history.priority.responses.length === 0
    && history.priority.passes.length === 2
    && history.priorityResult.reason === 'all_players_passed'
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
  const gameState = new GameState(players, { debug: true });
  gameState.turn = 4;
  return gameState;
}

function realPlayer(name, profile = {}) {
  const player = new PlayerState({
    id: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    deck: { commanders: [], mainboard: [] },
    cardDatabase: { get: () => null },
    random: { shuffle: (cards) => cards, next: () => 0.25 },
    strategyProfile: {
      primaryArchetype: 'midrange',
      controlPriority: 50,
      removalPriority: 50,
      estimatedBracket: 2,
      ...profile
    }
  });
  player.commandZone = [];
  player.refreshManaPool();
  return player;
}

function realCard(name, typeLine, manaCost = '', tags = []) {
  const colors = ['W', 'U', 'B', 'R', 'G'].filter((color) => manaCost.includes(`{${color}}`));
  const numeric = Number((manaCost.match(/\d+/) || [0])[0]);
  return {
    name,
    typeLine,
    manaCost,
    manaValue: Math.max(0, numeric + colors.length),
    tags,
    colors,
    colorIdentity: colors,
    oracleText: ''
  };
}

function addRealLands(player, name, count) {
  for (let index = 0; index < count; index += 1) {
    player.addPermanent(realCard(name, 'Land', '', ['land']), { summoningSick: false });
  }
}

function minimalTurnEngine(decisionEngine = idleDecisionEngine()) {
  return new TurnEngine({
    behaviorRegistry: {
      get: () => ({
        canCast: () => true,
        cast: ({ player, card }) => {
          player.metrics.spellsCast = (player.metrics.spellsCast || 0) + 1;
          return { message: `${player.name} casts ${card.name}.` };
        }
      })
    },
    combatEngine: { attack: () => {} },
    decisionEngine,
    interactionEngine: new InteractionEngine()
  });
}

function scriptedDecisionEngine(action) {
  let used = false;
  return {
    chooseCastAction: () => {
      if (used) return null;
      used = true;
      return action;
    },
    shouldAttemptCombo: () => null
  };
}

function idleDecisionEngine() {
  return {
    chooseCastAction: () => null,
    shouldAttemptCombo: () => null
  };
}

function debugIncludes(gameState, text) {
  return gameState.events.some((event) => String(event.message).includes(text));
}

function originalHistory(gameState, label = null) {
  return gameState.stackManager.history.find((object) => {
    if (object.isResponse) return false;
    return !label || object.label() === label;
  });
}

function responseHistory(gameState) {
  return gameState.stackManager.history.find((object) => object.isResponse);
}

module.exports = { testInteractionWindowsCommand };
