const { CardRoleResolver } = require('../cards/CardRoleResolver');
const { ACTION_TYPES, WINDOW_TYPES, createInteractionWindow } = require('./InteractionWindow');
const { StackObject } = require('./StackObject');

class InteractionEngine {
  constructor(options = {}) {
    this.roleResolver = options.roleResolver || new CardRoleResolver(options);
  }

  attemptToStop(gameState, actingPlayer, attempt) {
    const window = createInteractionWindow(actingPlayer, attempt);
    if (gameState && gameState.stackManager && !(attempt && attempt.skipStackObject)) {
      this.pushInteractionStackObject(gameState, window);
      return gameState.stackManager.resolvePending(gameState, this);
    }
    return this.resolveWindow(gameState, actingPlayer, window);
  }

  pushInteractionStackObject(gameState, window) {
    const stackObject = StackObject.fromWindow(window, gameState);
    gameState.recordDebug && gameState.recordDebug(`Stack object created: ${stackObject.id} ${stackObject.label()}.`);
    gameState.stackManager.push(stackObject);
    gameState.recordDebug && gameState.recordDebug(`Stack object pushed: ${stackObject.id}. Stack size ${gameState.stackManager.size()}.`);
    return stackObject;
  }

  resolveStackObject(gameState, stackObject) {
    return this.resolveWindow(gameState, stackObject.sourcePlayer, stackObject.window);
  }

  resolveWindow(gameState, actingPlayer, window) {
    if (!window || typeof window.toAttempt !== 'function') {
      gameState && gameState.recordDebug && gameState.recordDebug('Interaction window skipped: missing or malformed window.');
      return { stopped: false, reason: 'invalid_window' };
    }
    if (!actingPlayer) {
      gameState && gameState.recordDebug && gameState.recordDebug(`Interaction window skipped: missing source player for ${window.label || 'unknown action'}.`);
      return { stopped: false, reason: 'missing_source_player' };
    }
    const normalizedAttempt = window.toAttempt();
    recordWindowOpened(gameState, window);
    if (actingPlayer.metrics) {
      actingPlayer.metrics.interactionWindowsOpened = (actingPlayer.metrics.interactionWindowsOpened || 0) + 1;
    }
    const opponents = gameState.opponentsOf(actingPlayer)
      .filter((opponent) => !opponent.eliminated)
      .sort((a, b) => interactionReadiness(b) - interactionReadiness(a));
    if (gameState.recordDebug) {
      const names = opponents.length ? opponents.map((opponent) => opponent.name).join(', ') : 'none';
      gameState.recordDebug(`Interaction window responders: ${names}.`);
    }

    for (const opponent of opponents) {
      const answer = chooseAnswer(opponent, normalizedAttempt, this.roleResolver);
      if (!answer) {
        gameState.recordDebug && gameState.recordDebug(`${opponent.name} passes: no suitable response to ${window.label}.`);
        continue;
      }
      gameState.recordDebug && gameState.recordDebug(`${opponent.name} chooses ${answer.name} for ${window.label}: ${answer.responseReason || 'highest available response score'}.`);
      const protectedAttempt = consumeProtection(actingPlayer, normalizedAttempt, this.roleResolver);
      if (!consumeCard(opponent, answer)) {
        gameState.recordDebug && gameState.recordDebug(`${opponent.name} could not pay for ${answer.name}; response skipped.`);
        continue;
      }
      recordInteraction(opponent, answer, normalizedAttempt, this.roleResolver);
      recordInteractionPaymentDebug(gameState, opponent, answer);
      if (protectedAttempt) {
        gameState.record(`${actingPlayer.name} protects ${normalizedAttempt.label} with ${protectedAttempt.name} from ${opponent.name}'s ${answer.name}.`);
        recordInteractionPaymentDebug(gameState, actingPlayer, protectedAttempt);
        gameState.recordDebug && gameState.recordDebug(`${protectedAttempt.name} used because ${normalizedAttempt.label} was important to ${actingPlayer.name}'s plan.`);
        continue;
      }
      const priority = answer.counterPriorityScore || answer.answerPriorityScore || 0;
      gameState.record(`${opponent.name} stops ${actingPlayer.name}'s ${normalizedAttempt.label} with ${answer.name}.`);
      gameState.recordDebug && gameState.recordDebug(`${answer.name} used to stop ${normalizedAttempt.label}. Priority score: ${priority}.`);
      recordStoppedAttempt(opponent, normalizedAttempt);
      return { stopped: true, by: opponent.name, card: answer.name };
    }
    gameState.recordDebug && gameState.recordDebug(`Interaction window closes: ${window.label} resolves.`);
    return { stopped: false };
  }
}

function interactionReadiness(player) {
  const profile = player.strategyProfile || {};
  return (profile.controlPriority || 0) + (profile.counterspellPriority || 0) + (profile.removalPriority || 0) + player.availableMana * 6 + player.hand.length;
}

function chooseAnswer(player, attempt, roleResolver) {
  const profile = player.strategyProfile || {};
  const answers = player.hand.filter((card) => canAnswer(card, attempt) && canPayInteraction(player, card));
  if (!answers.length) return null;
  const scored = answers.map((card) => {
    const priority = answerPriority(card, attempt, player, roleResolver);
    return { card, priority, score: answerScore(card, attempt, profile, priority) };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  const threshold = answerThreshold(best.card, attempt, player, roleResolver);
  if (best.priority < threshold) return null;
  best.card.answerPriorityScore = best.priority;
  best.card.responseReason = `${attempt.reason || 'important window'}; priority ${best.priority}, threshold ${threshold}`;
  if ((best.card.tags || []).includes('counterspell')) best.card.counterPriorityScore = best.priority;
  return best.card;
}

function canAnswer(card, attempt) {
  if (isFalsePositiveManaSource(card)) return false;
  const tags = new Set(card.tags || []);
  const counter = attempt.canBeCountered && (tags.has('counterspell') || tags.has('free-spell'));
  const removal = attempt.canBeRemoved && tags.has('removal');
  const protection = attempt.canBeProtected && tags.has('protection');
  if (attempt.kind === ACTION_TYPES.COMBO) return counter || removal;
  if (attempt.kind === ACTION_TYPES.BOARDWIPE) return counter || protection;
  if (attempt.kind === ACTION_TYPES.LETHAL || attempt.kind === ACTION_TYPES.COMMANDER_LETHAL) return removal || protection || counter;
  if ([ACTION_TYPES.STAX, ACTION_TYPES.WINCON, ACTION_TYPES.HIGH_IMPACT].includes(attempt.kind)) return counter || removal;
  if (attempt.interactionWindow && attempt.interactionWindow.windowType === WINDOW_TYPES.ACTIVATED_ABILITY) return removal || counter;
  if (attempt.interactionWindow && attempt.interactionWindow.windowType === WINDOW_TYPES.TRIGGERED_ABILITY) return counter || removal;
  return counter || removal;
}

function isFalsePositiveManaSource(card) {
  const type = String(card.typeLine || '').toLowerCase();
  if (!type.includes('land') && !type.includes('artifact')) return false;
  const text = String(card.oracleText || '').toLowerCase();
  const canActAsInteractionFromHand = text.includes('channel') && /target|counter/.test(text);
  const hasRealInteractionText = /counter target|destroy target|exile target|return target|prevent|protection from|phase out/.test(text);
  return !canActAsInteractionFromHand && !hasRealInteractionText;
}

function canPayInteraction(player, card) {
  if ((card.tags || []).includes('free-spell')) return true;
  return player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0);
}

function answerScore(card, attempt, profile, priority) {
  const tags = new Set(card.tags || []);
  let score = priority || 0;
  if (tags.has('free-spell')) score += 25;
  if (tags.has('counterspell') && [ACTION_TYPES.COMBO, ACTION_TYPES.BOARDWIPE, ACTION_TYPES.STAX, ACTION_TYPES.WINCON, ACTION_TYPES.HIGH_IMPACT].includes(attempt.kind)) score += 40;
  if (tags.has('removal') && [ACTION_TYPES.COMBO, ACTION_TYPES.LETHAL, ACTION_TYPES.COMMANDER_LETHAL].includes(attempt.kind)) score += 35;
  if (tags.has('protection') && [ACTION_TYPES.BOARDWIPE, ACTION_TYPES.LETHAL, ACTION_TYPES.COMMANDER_LETHAL].includes(attempt.kind)) score += 30;
  score += (profile.controlPriority || 0) * 0.1 + (profile.estimatedBracket || 1) * 2;
  score -= Number(card.manaValue || 0);
  return score;
}

function answerPriority(card, attempt, player, roleResolver) {
  const tags = new Set(card.tags || []);
  if (tags.has('counterspell')) return roleResolver.counterPriority(card, attempt, player);
  if (tags.has('protection')) return roleResolver.protectionPriority(card, attempt, player);
  if (tags.has('removal')) {
    if (attempt.kind === ACTION_TYPES.COMBO) return 84;
    if (attempt.kind === ACTION_TYPES.LETHAL || attempt.kind === ACTION_TYPES.COMMANDER_LETHAL) return 82;
    if (attempt.kind === ACTION_TYPES.STAX) return 70;
    if (attempt.kind === ACTION_TYPES.WINCON || attempt.kind === ACTION_TYPES.HIGH_IMPACT) return 68;
    return 45;
  }
  if (tags.has('free-spell')) return 62;
  return 0;
}

function answerThreshold(card, attempt, player, roleResolver) {
  const tags = new Set(card.tags || []);
  if (tags.has('counterspell')) return roleResolver.counterThreshold(player, attempt);
  if (tags.has('protection')) return 55;
  if (tags.has('removal')) return [ACTION_TYPES.COMBO, ACTION_TYPES.LETHAL, ACTION_TYPES.COMMANDER_LETHAL].includes(attempt.kind) ? 50 : 62;
  return 65;
}

function consumeProtection(player, attempt, roleResolver) {
  if (!attempt.canBeProtected && attempt.canBeProtected !== undefined) return null;
  if (![ACTION_TYPES.COMBO, ACTION_TYPES.BOARDWIPE, ACTION_TYPES.LETHAL, ACTION_TYPES.COMMANDER_LETHAL, ACTION_TYPES.WINCON, ACTION_TYPES.HIGH_IMPACT].includes(attempt.kind)) return null;
  const candidates = player.hand
    .map((card, index) => ({ card, index, priority: protectionAnswerPriority(card, attempt, player, roleResolver) }))
    .filter((entry) => entry.priority >= 55 && canPayInteraction(player, entry.card))
    .sort((a, b) => b.priority - a.priority);
  const index = candidates.length ? candidates[0].index : -1;
  if (index < 0) return null;
  const card = player.hand.splice(index, 1)[0];
  if (!spendInteractionMana(player, card)) {
    player.hand.splice(index, 0, card);
    return null;
  }
  player.graveyard.push(card);
  player.metrics.protectionUsed = (player.metrics.protectionUsed || 0) + 1;
  player.metrics.successfulProtection = (player.metrics.successfulProtection || 0) + 1;
  player.metrics.interactionUsed = (player.metrics.interactionUsed || 0) + 1;
  if ((card.tags || []).includes('counterspell')) player.metrics.counterspellsUsed = (player.metrics.counterspellsUsed || 0) + 1;
  player.metrics.cardSequencingScoreTotal = (player.metrics.cardSequencingScoreTotal || 0) + protectionAnswerPriority(card, attempt, player, roleResolver);
  player.metrics.cardSequencingScoreCount = (player.metrics.cardSequencingScoreCount || 0) + 1;
  return card;
}

function recordWindowOpened(gameState, window) {
  if (!gameState.recordDebug) return;
  const source = window.sourcePlayer ? window.sourcePlayer.name : 'Unknown player';
  const card = window.sourceCard ? ` from ${window.sourceCard.name}` : '';
  const flags = [
    window.canBeCountered ? 'counterable' : null,
    window.canBeRemoved ? 'removable' : null,
    window.canBeProtected ? 'protectable' : null
  ].filter(Boolean).join(', ') || 'no standard responses';
  gameState.recordDebug(`Interaction window opens [${window.windowType}/${window.actionType}]: ${source} attempts ${window.label}${card}. Impact ${window.impactScore}. ${flags}. Reason: ${window.reason}.`);
}

function recordInteractionPaymentDebug(gameState, player, card) {
  if (!gameState.recordDebug || !player.lastManaPayment || !player.lastManaPayment.success) return;
  const sources = player.lastManaPayment.sourcesUsed && player.lastManaPayment.sourcesUsed.length
    ? player.lastManaPayment.sourcesUsed.join(', ')
    : 'no sources';
  gameState.recordDebug(`${player.name} paid for ${card.name} using ${sources}.`);
}

function protectionAnswerPriority(card, attempt, player, roleResolver) {
  const tags = new Set(card.tags || []);
  if (tags.has('protection')) return roleResolver.protectionPriority(card, attempt, player);
  if (tags.has('counterspell') && attempt.kind === ACTION_TYPES.COMBO) return roleResolver.counterPriority(card, { ...attempt, protectingWin: true }, player);
  if (tags.has('free-spell')) return 60;
  return 0;
}

function consumeCard(player, card) {
  const index = player.hand.indexOf(card);
  if (index >= 0) player.hand.splice(index, 1);
  if (!spendInteractionMana(player, card)) {
    if (index >= 0) player.hand.splice(index, 0, card);
    return false;
  }
  player.graveyard.push(card);
  return true;
}

function spendInteractionMana(player, card) {
  if ((card.tags || []).includes('free-spell')) return true;
  if (player.payCard) return player.payCard(card);
  player.availableMana -= card.manaValue || 0;
  return true;
}

function recordInteraction(player, card, attempt, roleResolver) {
  const priority = answerPriority(card, attempt, player, roleResolver);
  player.metrics.interactionUsed = (player.metrics.interactionUsed || 0) + 1;
  player.metrics.cardSequencingScoreTotal = (player.metrics.cardSequencingScoreTotal || 0) + priority;
  player.metrics.cardSequencingScoreCount = (player.metrics.cardSequencingScoreCount || 0) + 1;
  if ((card.tags || []).includes('counterspell')) {
    player.metrics.counterspellsUsed = (player.metrics.counterspellsUsed || 0) + 1;
    player.metrics.counterPriorityTotal = (player.metrics.counterPriorityTotal || 0) + priority;
    player.metrics.counterPriorityCount = (player.metrics.counterPriorityCount || 0) + 1;
    if (priority >= 70) player.metrics.highPriorityCounters = (player.metrics.highPriorityCounters || 0) + 1;
    if (priority < 55) player.metrics.wastedCounters = (player.metrics.wastedCounters || 0) + 1;
  }
  if ((card.tags || []).includes('removal')) {
    player.metrics.removalUsed = (player.metrics.removalUsed || 0) + 1;
    player.metrics.removalQualityTotal = (player.metrics.removalQualityTotal || 0) + priority;
    player.metrics.removalQualityCount = (player.metrics.removalQualityCount || 0) + 1;
  }
  if ((card.tags || []).includes('protection')) {
    player.metrics.protectionUsed = (player.metrics.protectionUsed || 0) + 1;
    if (priority >= 60) player.metrics.successfulProtection = (player.metrics.successfulProtection || 0) + 1;
    else player.metrics.wastedProtection = (player.metrics.wastedProtection || 0) + 1;
  }
  if (attempt.kind === ACTION_TYPES.HIGH_IMPACT) player.metrics.highImpactInteractionUsed = (player.metrics.highImpactInteractionUsed || 0) + 1;
}

function recordStoppedAttempt(player, attempt) {
  if (attempt.kind === ACTION_TYPES.COMBO) player.metrics.comboAttemptsStopped = (player.metrics.comboAttemptsStopped || 0) + 1;
  if (attempt.kind === ACTION_TYPES.LETHAL || attempt.kind === ACTION_TYPES.COMMANDER_LETHAL) player.metrics.lethalAttacksStopped = (player.metrics.lethalAttacksStopped || 0) + 1;
  if (attempt.kind === ACTION_TYPES.HIGH_IMPACT || attempt.kind === ACTION_TYPES.STAX || attempt.kind === ACTION_TYPES.WINCON) {
    player.metrics.highImpactSpellsStopped = (player.metrics.highImpactSpellsStopped || 0) + 1;
  }
}

module.exports = { InteractionEngine };
