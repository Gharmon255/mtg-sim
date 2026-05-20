const { PlayScorer } = require('./PlayScorer');
const { ThreatEvaluator } = require('./ThreatEvaluator');
const { TutorResolver } = require('./TutorResolver');
const { CardRoleResolver } = require('../cards/CardRoleResolver');

class DecisionEngine {
  constructor(options = {}) {
    this.roleResolver = options.roleResolver || new CardRoleResolver(options);
    this.playScorer = options.playScorer || new PlayScorer({ ...options, roleResolver: this.roleResolver });
    this.threatEvaluator = options.threatEvaluator || new ThreatEvaluator();
    this.tutorResolver = options.tutorResolver || new TutorResolver({ ...options, roleResolver: this.roleResolver });
  }

  chooseCastAction(gameState, player, behaviorRegistry) {
    const actions = this.possibleCastActions(gameState, player, behaviorRegistry)
      .map((action) => ({
        ...action,
        score: this.playScorer.score(action, { gameState, player, behaviorRegistry })
      }))
      .sort((a, b) => b.score - a.score || (b.card.manaValue || 0) - (a.card.manaValue || 0));
    return actions[0] || null;
  }

  possibleCastActions(gameState, player, behaviorRegistry) {
    const actions = [];
    for (const card of player.hand) {
      if ((card.tags || []).includes('land')) continue;
      if (shouldReserveForInteraction(player, card)) continue;
      const behavior = behaviorRegistry.get(card);
      if (!behavior.canCast(player, card)) continue;
      if (this.roleResolver.shouldHold(card, 'clear-purpose') && !hasClearTutorPurpose(player, card)) continue;
      if (behavior.shouldHold({ gameState, player, card, turn: gameState.turn, hasClearPurpose: hasClearTutorPurpose(player, card), opponents: gameState.opponentsOf(player) })) {
        player.metrics.cardsHeldForBetterTiming = (player.metrics.cardsHeldForBetterTiming || 0) + 1;
        continue;
      }
      actions.push({ type: actionTypeFor(card), card, behavior, base: 10 });
    }

    const commander = player.commandZone
      .filter((card) => !player.commanderPermanentNames.has(card.name))
      .filter((card) => canPayCommander(player, card))
      .sort((a, b) => (a.manaValue || 0) - (b.manaValue || 0))[0];
    if (commander && shouldCastCommanderNow(player, commander)) {
      actions.push({ type: 'cast_commander', card: commander, behavior: behaviorRegistry.get(commander), base: 12 });
    } else if (commander) {
      player.metrics.commanderSequencingDelayed = (player.metrics.commanderSequencingDelayed || 0) + 1;
    }

    if (shouldHoldInteraction(player)) {
      actions.push({ type: 'hold_up_interaction', card: { name: 'available interaction', manaValue: 0, tags: [] }, base: 8 });
    }

    return actions;
  }

  chooseAttackTarget(gameState, player) {
    return this.threatEvaluator.weakestCombatTarget(gameState, player);
  }

  chooseRemovalTarget(gameState, player) {
    return this.threatEvaluator.highestThreat(gameState, player);
  }

  shouldAttemptCombo(gameState, player) {
    const profile = player.strategyProfile || {};
    if (profile.comboPriority < 45 || !profile.comboReport) return null;
    const exact = profile.comboReport.exactCombos || [];
    const availableNames = availableCardNames(player);
    const castableNames = castableCardNames(player);
    const protectedAttempt = hasProtection(player) || profile.estimatedBracket >= 5;

    for (const combo of exact) {
      const required = combo.cardsRequired || [];
      if (!required.length) continue;
      const allAvailable = required.every((name) => availableNames.has(normalizeName(name)));
      const allCastable = required.every((name) => availableNames.has(normalizeName(name)) || castableNames.has(normalizeName(name)));
      const enoughMana = player.availableMana + player.rampMana >= comboManaNeed(required, player);
      if (allAvailable && enoughMana && (protectedAttempt || gameState.turn >= 6)) {
        return { combo, confidence: combo.confidence || 'medium', possible: false };
      }
      if (allCastable && enoughMana && profile.comboPriority >= 80 && gameState.turn >= 4) {
        return { combo, confidence: combo.confidence || 'medium', possible: false };
      }
    }

    const possible = (profile.comboReport.possibleCombos || [])[0];
    if (possible && gameState.turn >= 7 && profile.comboPriority >= 75 && player.threatScore >= 8) {
      return { combo: possible, confidence: possible.confidence || 'low', possible: true };
    }
    return null;
  }
}

function actionTypeFor(card) {
  const tags = new Set(card.tags || []);
  if (tags.has('fast-mana')) return 'cast_fast_mana';
  if (tags.has('stax') || tags.has('mass-land-denial')) return 'cast_stax_piece';
  if (tags.has('boardwipe')) return 'cast_boardwipe';
  if (tags.has('counterspell')) return 'cast_counterspell';
  if (tags.has('removal')) return 'cast_removal';
  if (tags.has('tutor')) return 'cast_tutor';
  if (tags.has('combo-piece') || tags.has('infinite-combo-piece')) return 'cast_combo_piece';
  if (tags.has('protection')) return 'cast_protection';
  if (tags.has('draw') || tags.has('card-draw')) return 'cast_draw';
  if (tags.has('ramp')) return 'cast_ramp';
  if (tags.has('reanimation')) return 'reanimate_threat';
  if (tags.has('graveyard-synergy')) return 'setup_graveyard';
  if (tags.has('sacrifice-outlet') || tags.has('aristocrats')) return 'sacrifice_for_value';
  if (tags.has('wincon')) return 'cast_wincon';
  if (tags.has('creature')) return 'cast_creature';
  return 'cast_creature';
}

function shouldHoldInteraction(player) {
  const profile = player.strategyProfile || {};
  const hasInteraction = player.hand.some((card) => (card.tags || []).some((tag) => ['counterspell', 'removal', 'protection', 'free-spell'].includes(tag)));
  const canRepresentInteraction = player.hand.some((card) => (card.tags || []).includes('free-spell') || (player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0)));
  return hasInteraction && canRepresentInteraction && (profile.controlPriority >= 55 || profile.comboPriority >= 70 || profile.estimatedBracket >= 4);
}

function shouldReserveForInteraction(player, card) {
  const profile = player.strategyProfile || {};
  const tags = new Set(card.tags || []);
  if (tags.has('counterspell')) return true;
  if (tags.has('free-spell') && (tags.has('counterspell') || tags.has('protection'))) return true;
  if (tags.has('protection') && (profile.primaryArchetype === 'combo' || profile.primaryArchetype === 'voltron' || profile.estimatedBracket >= 4)) return true;
  if (tags.has('removal') && profile.primaryArchetype === 'control') {
    const canPay = player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0);
    if (canPay && player.availableMana <= (card.manaValue || 0) + 1) return true;
  }
  return false;
}

function hasClearTutorPurpose(player, card) {
  const profile = player.strategyProfile || {};
  const tags = new Set(card.tags || []);
  if (!tags.has('tutor')) return true;
  if (profile.primaryArchetype === 'combo' && profile.comboPriority >= 55) return true;
  if (profile.primaryArchetype === 'control' && player.boardScore < 8) return true;
  if (profile.primaryArchetype === 'reanimator' || profile.primaryArchetype === 'aristocrats') return true;
  if (player.turnCount >= 4) return true;
  return false;
}

function shouldCastCommanderNow(player, commander) {
  const profile = player.strategyProfile || {};
  const plan = profile.commanderPlan || {};
  if (plan.castTiming === 'with protection' && !hasProtection(player) && player.turnCount < 6) return false;
  if (plan.castTiming === 'after ramp' && player.availableMana < Math.max(5, (commander.manaValue || 0) + 1)) return false;
  return true;
}

function commanderCost(player, commander) {
  const castCount = player.commanderCastCounts.get(commander.name) || 0;
  return (commander.manaValue || 0) + castCount * 2;
}

function canPayCommander(player, commander) {
  const castCount = player.commanderCastCounts.get(commander.name) || 0;
  const tax = castCount * 2;
  if (!player.canPayCard) return player.availableMana >= (commander.manaValue || 0) + tax;
  return player.canPayCard({
    ...commander,
    manaCost: `${commander.manaCost || ''}${tax ? `{${tax}}` : ''}`,
    manaValue: (commander.manaValue || 0) + tax,
    isCommander: true
  });
}

function hasProtection(player) {
  return player.hand.some((card) => (card.tags || []).some((tag) => ['counterspell', 'protection', 'free-spell'].includes(tag)));
}

function availableCardNames(player) {
  return new Set(player.hand.concat(player.battlefield, player.graveyard, player.commandZone).map((card) => normalizeName(card.name)));
}

function castableCardNames(player) {
  return new Set(player.hand.filter((card) => player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0)).map((card) => normalizeName(card.name)));
}

function comboManaNeed(names, player) {
  let need = 0;
  for (const name of names) {
    const card = player.hand.find((candidate) => normalizeName(candidate.name) === normalizeName(name));
    if (card) need += Number(card.manaValue || 0);
  }
  return Math.max(0, need - 1);
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { DecisionEngine };
