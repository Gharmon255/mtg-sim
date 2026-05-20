const { CardRoleResolver } = require('../cards/CardRoleResolver');

class InteractionEngine {
  constructor(options = {}) {
    this.roleResolver = options.roleResolver || new CardRoleResolver(options);
  }

  attemptToStop(gameState, actingPlayer, attempt) {
    gameState.recordDebug && gameState.recordDebug(`Interaction window: ${actingPlayer.name} attempts ${attempt.label}.`);
    const opponents = gameState.opponentsOf(actingPlayer)
      .filter((opponent) => !opponent.eliminated)
      .sort((a, b) => interactionReadiness(b) - interactionReadiness(a));

    for (const opponent of opponents) {
      const answer = chooseAnswer(opponent, attempt, this.roleResolver);
      if (!answer) continue;
      const protectedAttempt = consumeProtection(actingPlayer, attempt, this.roleResolver);
      consumeCard(opponent, answer);
      recordInteraction(opponent, answer, attempt, this.roleResolver);
      recordInteractionPaymentDebug(gameState, opponent, answer);
      if (protectedAttempt) {
        gameState.record(`${actingPlayer.name} protects ${attempt.label} with ${protectedAttempt.name} from ${opponent.name}'s ${answer.name}.`);
        recordInteractionPaymentDebug(gameState, actingPlayer, protectedAttempt);
        gameState.recordDebug && gameState.recordDebug(`${protectedAttempt.name} used because ${attempt.label} was important to ${actingPlayer.name}'s plan.`);
        continue;
      }
      const priority = answer.counterPriorityScore || answer.answerPriorityScore || 0;
      gameState.record(`${opponent.name} stops ${actingPlayer.name}'s ${attempt.label} with ${answer.name}.`);
      gameState.recordDebug && gameState.recordDebug(`${answer.name} used to stop ${attempt.label}. Priority score: ${priority}.`);
      recordStoppedAttempt(opponent, attempt);
      return { stopped: true, by: opponent.name, card: answer.name };
    }
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
  if ((best.card.tags || []).includes('counterspell')) best.card.counterPriorityScore = best.priority;
  return best.card;
}

function canAnswer(card, attempt) {
  if (isFalsePositiveManaSource(card)) return false;
  const tags = new Set(card.tags || []);
  if (attempt.kind === 'combo') return tags.has('counterspell') || tags.has('removal') || tags.has('free-spell');
  if (attempt.kind === 'boardwipe') return tags.has('counterspell') || tags.has('protection') || tags.has('free-spell');
  if (attempt.kind === 'lethal' || attempt.kind === 'commander-lethal') return tags.has('removal') || tags.has('protection') || tags.has('counterspell') || tags.has('free-spell');
  if (attempt.kind === 'stax' || attempt.kind === 'wincon' || attempt.kind === 'high-impact') return tags.has('counterspell') || tags.has('removal') || tags.has('free-spell');
  return tags.has('counterspell') || tags.has('removal') || tags.has('free-spell');
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
  if (tags.has('counterspell') && ['combo', 'boardwipe', 'stax', 'wincon', 'high-impact'].includes(attempt.kind)) score += 40;
  if (tags.has('removal') && ['combo', 'lethal', 'commander-lethal'].includes(attempt.kind)) score += 35;
  if (tags.has('protection') && ['boardwipe', 'lethal', 'commander-lethal'].includes(attempt.kind)) score += 30;
  score += (profile.controlPriority || 0) * 0.1 + (profile.estimatedBracket || 1) * 2;
  score -= Number(card.manaValue || 0);
  return score;
}

function answerPriority(card, attempt, player, roleResolver) {
  const tags = new Set(card.tags || []);
  if (tags.has('counterspell')) return roleResolver.counterPriority(card, attempt, player);
  if (tags.has('protection')) return roleResolver.protectionPriority(card, attempt, player);
  if (tags.has('removal')) {
    if (attempt.kind === 'combo') return 84;
    if (attempt.kind === 'lethal' || attempt.kind === 'commander-lethal') return 82;
    if (attempt.kind === 'stax') return 70;
    if (attempt.kind === 'wincon' || attempt.kind === 'high-impact') return 68;
    return 45;
  }
  if (tags.has('free-spell')) return 62;
  return 0;
}

function answerThreshold(card, attempt, player, roleResolver) {
  const tags = new Set(card.tags || []);
  if (tags.has('counterspell')) return roleResolver.counterThreshold(player, attempt);
  if (tags.has('protection')) return 55;
  if (tags.has('removal')) return ['combo', 'lethal', 'commander-lethal'].includes(attempt.kind) ? 50 : 62;
  return 65;
}

function consumeProtection(player, attempt, roleResolver) {
  if (!['combo', 'boardwipe', 'lethal', 'commander-lethal', 'wincon', 'high-impact'].includes(attempt.kind)) return null;
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
  if (tags.has('counterspell') && attempt.kind === 'combo') return roleResolver.counterPriority(card, { ...attempt, protectingWin: true }, player);
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
  if (attempt.kind === 'high-impact') player.metrics.highImpactInteractionUsed = (player.metrics.highImpactInteractionUsed || 0) + 1;
}

function recordStoppedAttempt(player, attempt) {
  if (attempt.kind === 'combo') player.metrics.comboAttemptsStopped = (player.metrics.comboAttemptsStopped || 0) + 1;
  if (attempt.kind === 'lethal' || attempt.kind === 'commander-lethal') player.metrics.lethalAttacksStopped = (player.metrics.lethalAttacksStopped || 0) + 1;
  if (attempt.kind === 'high-impact' || attempt.kind === 'stax' || attempt.kind === 'wincon') {
    player.metrics.highImpactSpellsStopped = (player.metrics.highImpactSpellsStopped || 0) + 1;
  }
}

module.exports = { InteractionEngine };
