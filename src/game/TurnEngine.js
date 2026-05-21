const { CommanderRules } = require('../rules/CommanderRules');
const { DecisionEngine } = require('../ai/DecisionEngine');
const { UpkeepEngine } = require('./UpkeepEngine');
const { TriggeredAbilityEngine } = require('./TriggeredAbilityEngine');
const { ACTION_TYPES, WINDOW_TYPES, createInteractionWindow } = require('./InteractionWindow');

class TurnEngine {
  constructor({ behaviorRegistry, combatEngine, decisionEngine, interactionEngine }) {
    this.behaviorRegistry = behaviorRegistry;
    this.combatEngine = combatEngine;
    this.decisionEngine = decisionEngine || new DecisionEngine();
    this.interactionEngine = interactionEngine || null;
    this.upkeepEngine = new UpkeepEngine({ interactionEngine: this.interactionEngine });
    this.triggeredAbilityEngine = new TriggeredAbilityEngine({ interactionEngine: this.interactionEngine });
  }

  takeTurn(gameState, player, targeting) {
    if (player.eliminated) return;
    player.startTurn();
    this.upkeepEngine.run(gameState, player);
    player.draw(1);
    this.triggeredAbilityEngine.afterDraw(gameState, player, 1);
    const land = player.playLand();
    if (land && gameState.recordDebug) {
      const play = player.lastLandPlay || {};
      const viaFetch = play.fetch ? `${play.fetch} fetched ${play.land}` : play.land;
      const tapped = play.tapped ? 'tapped' : 'untapped';
      const reason = (play.reasons || []).join(', ') || 'best available source';
      gameState.recordDebug(`${player.name} plays ${viaFetch} ${tapped}: ${reason}.`);
    }
    this.trackManaProblems(player);
    this.castPriorityCards(gameState, player, targeting);
    this.tryComboWin(gameState, player);
    this.combatEngine.attack(gameState, player, targeting);
    this.cleanupEliminations(gameState, player);
  }

  trackManaProblems(player) {
    const lands = player.availableLandMana();
    const handLands = player.hand.filter((card) => (card.tags || []).includes('land')).length;
    if (player.turnCount >= 4 && lands < 3) player.metrics.manaScrewTurns += 1;
    if (player.turnCount >= 6 && handLands >= 4) player.metrics.manaFloodTurns += 1;
    let colorBlocked = 0;
    for (const card of player.hand) {
      if ((card.tags || []).includes('land')) continue;
      if (player.canPayCard && player.canPayCard(card)) {
        player.metrics.castableCardsSeen = (player.metrics.castableCardsSeen || 0) + 1;
        continue;
      }
      const missing = player.missingColorsForCard ? player.missingColorsForCard(card) : [];
      if (missing.length) {
        colorBlocked += 1;
        player.metrics.uncastableColorCardsSeen = (player.metrics.uncastableColorCardsSeen || 0) + 1;
        player.metrics.missingColors = player.metrics.missingColors || {};
        for (const color of missing) player.metrics.missingColors[color] = (player.metrics.missingColors[color] || 0) + 1;
      } else if (player.availableMana < (card.manaValue || 0)) {
        player.metrics.uncastableManaCardsSeen = (player.metrics.uncastableManaCardsSeen || 0) + 1;
      }
    }
    if (colorBlocked > 0) player.metrics.colorScrewTurns = (player.metrics.colorScrewTurns || 0) + 1;
  }

  castPriorityCards(gameState, player, targeting) {
    let castSomething = true;
    let castsThisTurn = 0;
    while (castSomething && castsThisTurn < 3) {
      castSomething = false;
      const action = this.decisionEngine.chooseCastAction(gameState, player, this.behaviorRegistry);
      if (!action || action.type === 'hold_up_interaction') {
        if (action && action.type === 'hold_up_interaction') {
          player.metrics.heldInteractionTurns = (player.metrics.heldInteractionTurns || 0) + 1;
          gameState.record(`${player.name} holds up interaction.`);
          gameState.recordDebug && gameState.recordDebug(`${player.name} holds interaction because ${heldInteractionReason(player)}.`);
        }
        break;
      }
      if (action.type === 'cast_commander') {
        if (this.tryCastCommander(gameState, player, targeting, action.card)) {
          castSomething = true;
          castsThisTurn += 1;
        }
        continue;
      }
      const card = action.card;
      if (!card) break;
      this.castAction(gameState, player, targeting, action, card);
      castSomething = true;
      castsThisTurn += 1;
    }
  }

  buildPriorities(player, targeting) {
    const nonLand = (card) => !(card.tags || []).includes('land');
    const predicates = {
      ramp: (card) => nonLand(card) && (card.tags || []).includes('ramp'),
      draw: (card) => nonLand(card) && (card.tags || []).includes('draw'),
      removal: (card) => nonLand(card) && (card.tags || []).includes('removal') && targeting.highestThreatOpponent(player),
      protection: (card) => nonLand(card) && (card.tags || []).includes('protection'),
      counters: (card) => nonLand(card) && (card.tags || []).includes('counters'),
      boardwipe: (card) => nonLand(card) && (card.tags || []).includes('boardwipe') && targeting.highestThreatOpponent(player) && targeting.highestThreatOpponent(player).boardScore > player.boardScore + 6,
      counterspell: (card) => nonLand(card) && (card.tags || []).includes('counterspell'),
      wincon: (card) => nonLand(card) && (card.tags || []).includes('wincon'),
      creature: (card) => nonLand(card) && (card.tags || []).includes('creature')
    };
    const order = (player.strategy && player.strategy.priorities) || ['ramp', 'draw', 'removal', 'protection', 'counters', 'counterspell', 'wincon', 'creature'];
    return ['boardwipe'].concat(order).map((key) => predicates[key]).filter(Boolean);
  }

  findCastable(player, predicate) {
    return player.hand
      .filter(predicate)
      .filter((card) => this.behaviorRegistry.get(card).canCast(player, card))
      .sort((a, b) => (b.manaValue || 0) - (a.manaValue || 0))[0] || null;
  }

  castAction(gameState, player, targeting, action, card) {
    if (action.type === 'cast_tutor') {
      if (player.payCard) {
        if (!player.payCard(card)) {
          gameState.recordDebug && gameState.recordDebug(`${player.name} cannot pay for ${card.name}; tutor action skipped.`);
          return;
        }
      } else {
        player.availableMana -= card.manaValue || 0;
      }
      player.removeFromHand(card);
      player.graveyard.push(card);
      player.metrics.spellsCast += 1;
      if (action.behavior && action.behavior.source === 'specific') {
        player.metrics.behaviorOverridesUsed = (player.metrics.behaviorOverridesUsed || 0) + 1;
        const explanation = action.behavior.explainDecision ? action.behavior.explainDecision({ gameState, player, card, action }) : '';
        if (explanation) recordBehaviorEvent(player, card, explanation);
      }
      const result = this.decisionEngine.tutorResolver.resolveTutor(player, gameState, card);
      gameState.record(result.message);
      recordManaPaymentDebug(gameState, player, card);
      this.triggeredAbilityEngine.afterOpponentCast(gameState, player, card, { action, targeting });
      return;
    }

    const interactionKind = interactionKindForAction(action, card);
    if (interactionKind && this.interactionEngine) {
      const window = createInteractionWindow(player, {
        windowType: windowTypeForInteractionKind(interactionKind),
        actionType: interactionKind,
        label: card.name,
        sourceCard: card,
        targetPlayer: targeting.highestThreatOpponent ? targeting.highestThreatOpponent(player) : null,
        impactScore: impactScoreForInteractionKind(interactionKind, player, gameState),
        canBeCountered: true,
        canBeRemoved: removableForInteractionKind(interactionKind),
        canBeProtected: protectableForInteractionKind(interactionKind),
        reason: reasonForInteractionKind(interactionKind, card, player)
      });
      const stopped = this.interactionEngine.attemptToStop(gameState, player, window);
      if (stopped.stopped) {
        if (player.payCard) player.payCard(card);
        else player.availableMana -= card.manaValue || 0;
        player.removeFromHand(card);
        player.graveyard.push(card);
        if (action.type === 'cast_boardwipe') player.metrics.boardWipesCast += 1;
        player.metrics.highImpactSpellsStoppedAgainst = (player.metrics.highImpactSpellsStoppedAgainst || 0) + 1;
        player.metrics.spellsCast += 1;
        return;
      }
    }

    const behavior = this.behaviorRegistry.get(card);
    player.removeFromHand(card);
    if (action.type === 'setup_graveyard') player.metrics.graveyardSetupActions = (player.metrics.graveyardSetupActions || 0) + 1;
    if (action.type === 'reanimate_threat') player.metrics.reanimationActions = (player.metrics.reanimationActions || 0) + 1;
    if (action.type === 'sacrifice_for_value') player.metrics.sacrificeActions = (player.metrics.sacrificeActions || 0) + 1;
    if (action.type === 'cast_boardwipe') recordBoardWipeQuality(gameState, player);
    if (action.type === 'cast_removal') recordRemovalQuality(gameState, player);
    const result = behavior.cast({ gameState, player, card, targeting });
    gameState.record(result.message);
    recordManaPaymentDebug(gameState, player, card);
    if (behavior.source === 'specific') {
      player.metrics.behaviorOverridesUsed = (player.metrics.behaviorOverridesUsed || 0) + 1;
    }
    const explanation = behavior.explainDecision ? behavior.explainDecision({ gameState, player, card, action }) : '';
    if (explanation) recordBehaviorEvent(player, card, explanation);
    gameState.recordDebug && gameState.recordDebug(`${player.name} chose ${card.name} as ${action.type} with ${explanation || sequencingReason(action, player)}.`);
    this.triggeredAbilityEngine.afterOpponentCast(gameState, player, card, { action, targeting });
  }

  tryCastCommander(gameState, player, targeting, preferredCommander = null) {
    const commander = preferredCommander || this.findCastableCommander(player);
    if (!commander) return;
    const castCount = player.commanderCastCounts.get(commander.name) || 0;
    const tax = CommanderRules.commanderTax(castCount);
    const commanderToCast = withCommanderTax(commander, tax);
    if (player.canPayCard) {
      if (!player.canPayCard(commanderToCast)) {
        const missing = player.missingColorsForCard ? player.missingColorsForCard(commanderToCast) : [];
        if (missing.length) player.metrics.commanderColorFailureTurns = (player.metrics.commanderColorFailureTurns || 0) + 1;
        return;
      }
    } else if (player.availableMana < (commander.manaValue || 0) + tax) {
      return;
    } else {
      player.availableMana -= tax;
    }
    player.commanderCastCount += 1;
    player.commanderCastCounts.set(commander.name, castCount + 1);
    player.commanderPermanentNames.add(commander.name);
    if (player.metrics.commanderCastTurn === null) player.metrics.commanderCastTurn = gameState.turn;
    player.metrics.commanderSequencingGood = (player.metrics.commanderSequencingGood || 0) + 1;
    player.metrics.cardSequencingScoreTotal = (player.metrics.cardSequencingScoreTotal || 0) + commanderSequencingScore(player);
    player.metrics.cardSequencingScoreCount = (player.metrics.cardSequencingScoreCount || 0) + 1;
    const behavior = this.behaviorRegistry.get(commander);
    behavior.cast({ gameState, player, card: commanderToCast, targeting });
    recordManaPaymentDebug(gameState, player, commander);
    player.commanderCombatPower.set(commander.name, estimateCommanderCombatPower(commander));
    gameState.record(`${player.name} casts commander ${commander.name}.`);
    return true;
  }

  findCastableCommander(player) {
    return player.commandZone
      .filter((commander) => !player.commanderPermanentNames.has(commander.name))
      .sort((a, b) => (a.manaValue || 0) - (b.manaValue || 0))[0] || null;
  }

  cleanupEliminations(gameState, actingPlayer) {
    for (const player of gameState.activePlayers()) {
      if (player.life <= 0) {
        player.eliminated = true;
        player.metrics.lossReason = `eliminated by ${actingPlayer.name}`;
        actingPlayer.metrics.winType = actingPlayer.metrics.winType || 'combat';
        gameState.record(`${player.name} is eliminated.`);
      }
    }
  }

  tryComboWin(gameState, player) {
    const attempt = this.decisionEngine.shouldAttemptCombo(gameState, player);
    if (!attempt) return false;
    player.metrics.comboAttempts += 1;
    player.metrics.comboAttemptTurns.push(gameState.turn);
    const label = attempt.combo.name || 'combo win';
    if (this.interactionEngine) {
      const stopped = this.interactionEngine.attemptToStop(gameState, player, createInteractionWindow(player, {
        windowType: WINDOW_TYPES.COMBO_ATTEMPT,
        actionType: ACTION_TYPES.COMBO,
        label,
        impactScore: attempt.possible || attempt.confidence === 'low' ? 78 : 96,
        canBeCountered: true,
        canBeRemoved: true,
        canBeProtected: true,
        reason: attempt.possible ? 'possible combo line may become lethal' : 'detected combo attempt may end the game',
        debug: {
          confidence: attempt.confidence,
          possible: Boolean(attempt.possible)
        }
      }));
      if (stopped.stopped) {
        player.metrics.stoppedComboAttempts += 1;
        player.metrics.failedComboAttempts += 1;
        return false;
      }
    }

    const confidencePenalty = attempt.possible || attempt.confidence === 'low';
    if (confidencePenalty && gameState.turn < 9) {
      player.metrics.failedComboAttempts += 1;
      gameState.record(`${player.name} tries ${label}, but the line is not fully assembled.`);
      return false;
    }

    for (const opponent of gameState.opponentsOf(player)) {
      opponent.eliminated = true;
      opponent.life = 0;
      opponent.metrics.lossReason = `combo win by ${player.name}: ${label}`;
    }
    player.metrics.comboWins += 1;
    player.metrics.winType = 'combo';
    gameState.record(`${player.name} wins with ${label}.`);
    return true;
  }
}

function heldInteractionReason(player) {
  const profile = player.strategyProfile || {};
  if (profile.primaryArchetype === 'control') return 'control decks should answer high-risk plays before tapping out';
  if (profile.primaryArchetype === 'combo') return 'combo decks want protection for a win attempt';
  if ((profile.estimatedBracket || 1) >= 4) return 'high-power decks value instant-speed answers';
  return 'available answers are better held for a meaningful window';
}

function sequencingReason(action, player) {
  const profile = player.strategyProfile || {};
  if (action.type === 'cast_boardwipe') return 'board wipe timing based on board gap';
  if (action.type === 'cast_removal') return 'removal aimed at the highest threat';
  if (action.type === 'cast_combo_piece') return `combo priority ${profile.comboPriority || 0}`;
  if (action.type === 'cast_commander') return `commander plan ${((profile.commanderPlan || {}).role) || 'support'}`;
  return `archetype ${profile.primaryArchetype || 'midrange'}`;
}

function recordBoardWipeQuality(gameState, player) {
  const opponents = gameState.opponentsOf(player);
  const opponentBoard = opponents.reduce((sum, opponent) => sum + opponent.boardScore, 0);
  const quality = Math.max(20, Math.min(100, 50 + opponentBoard - player.boardScore * 2));
  player.metrics.boardWipeQualityTotal = (player.metrics.boardWipeQualityTotal || 0) + quality;
  player.metrics.boardWipeQualityCount = (player.metrics.boardWipeQualityCount || 0) + 1;
  player.metrics.cardSequencingScoreTotal = (player.metrics.cardSequencingScoreTotal || 0) + quality;
  player.metrics.cardSequencingScoreCount = (player.metrics.cardSequencingScoreCount || 0) + 1;
}

function recordRemovalQuality(gameState, player) {
  const highest = gameState.opponentsOf(player).sort((a, b) => b.threatScore + b.boardScore - (a.threatScore + a.boardScore))[0];
  const quality = highest ? Math.max(25, Math.min(100, 45 + highest.threatScore + highest.boardScore - player.boardScore)) : 35;
  player.metrics.removalQualityTotal = (player.metrics.removalQualityTotal || 0) + quality;
  player.metrics.removalQualityCount = (player.metrics.removalQualityCount || 0) + 1;
  player.metrics.cardSequencingScoreTotal = (player.metrics.cardSequencingScoreTotal || 0) + quality;
  player.metrics.cardSequencingScoreCount = (player.metrics.cardSequencingScoreCount || 0) + 1;
}

function commanderSequencingScore(player) {
  const profile = player.strategyProfile || {};
  const plan = profile.commanderPlan || {};
  if (plan.castTiming === 'early' && player.turnCount <= 4) return 85;
  if (plan.castTiming === 'with protection' && player.hand.some((card) => (card.tags || []).some((tag) => ['protection', 'counterspell', 'free-spell'].includes(tag)))) return 82;
  if (plan.castTiming === 'after ramp' && player.availableMana >= 5) return 78;
  return 65;
}

function recordBehaviorEvent(player, card, explanation) {
  player.metrics.behaviorEvents = player.metrics.behaviorEvents || {};
  const key = `${card.name}: ${explanation}`;
  player.metrics.behaviorEvents[key] = (player.metrics.behaviorEvents[key] || 0) + 1;
}

function recordManaPaymentDebug(gameState, player, card) {
  if (!gameState.recordDebug || !player.lastManaPayment || !player.lastManaPayment.success) return;
  const payment = player.lastManaPayment;
  const sources = payment.sourcesUsed && payment.sourcesUsed.length ? payment.sourcesUsed.join(', ') : 'no sources';
  gameState.recordDebug(`${player.name} paid ${payment.paidCost || card.manaCost || `{${card.manaValue || 0}}`} for ${card.name} using ${sources}.`);
  for (const source of payment.sources || []) {
    if (source.sourceType === 'treasure') gameState.recordDebug(`${player.name} sacrificed Treasure for mana.`);
    else if (source.tappedRequired) gameState.recordDebug(`${player.name} tapped ${source.cardName} for mana.`);
    else if (source.sacrificeRequired) gameState.recordDebug(`${player.name} sacrificed ${source.cardName} for mana.`);
  }
}

function interactionKindForAction(action, card) {
  const tags = new Set(card.tags || []);
  if (action.type === 'cast_boardwipe') return ACTION_TYPES.BOARDWIPE;
  if (action.type === 'cast_stax_piece') return ACTION_TYPES.STAX;
  if (action.type === 'cast_wincon') return ACTION_TYPES.WINCON;
  if (tags.has('high-impact')) return ACTION_TYPES.HIGH_IMPACT;
  if (tags.has('combo-piece') && tags.has('wincon')) return ACTION_TYPES.WINCON;
  return null;
}

function windowTypeForInteractionKind(kind) {
  if (kind === ACTION_TYPES.BOARDWIPE) return WINDOW_TYPES.BOARD_WIPE;
  return WINDOW_TYPES.SPELL_CAST;
}

function impactScoreForInteractionKind(kind, player, gameState) {
  if (kind === ACTION_TYPES.BOARDWIPE) {
    const opponentBoard = gameState.opponentsOf(player).reduce((sum, opponent) => sum + opponent.boardScore, 0);
    return Math.max(70, Math.min(100, 70 + opponentBoard - player.boardScore));
  }
  if (kind === ACTION_TYPES.WINCON) return 88;
  if (kind === ACTION_TYPES.STAX) return 76;
  if (kind === ACTION_TYPES.HIGH_IMPACT) return 74;
  return 60;
}

function removableForInteractionKind(kind) {
  return [ACTION_TYPES.STAX, ACTION_TYPES.WINCON, ACTION_TYPES.HIGH_IMPACT].includes(kind);
}

function protectableForInteractionKind(kind) {
  return [ACTION_TYPES.BOARDWIPE, ACTION_TYPES.WINCON, ACTION_TYPES.HIGH_IMPACT].includes(kind);
}

function reasonForInteractionKind(kind, card, player) {
  if (kind === ACTION_TYPES.BOARDWIPE) return `${card.name} would reset battlefield development`;
  if (kind === ACTION_TYPES.STAX) return `${card.name} may restrict opposing game plans`;
  if (kind === ACTION_TYPES.WINCON) return `${card.name} may create a winning position`;
  if (kind === ACTION_TYPES.HIGH_IMPACT) return `${card.name} is tagged as a high-impact spell`;
  return `${player.name} is casting ${card.name}`;
}

function estimateCommanderCombatPower(commander) {
  const power = Number(commander.power);
  if (Number.isFinite(power) && power > 0) return Math.max(1, power);
  return Math.max(1, Math.ceil((commander.manaValue || 3) / 2));
}

function withCommanderTax(commander, tax) {
  if (!tax) return { ...commander, isCommander: true };
  const extraCost = `{${tax}}`;
  return {
    ...commander,
    isCommander: true,
    manaCost: `${commander.manaCost || ''}${extraCost}`,
    manaValue: (commander.manaValue || 0) + tax
  };
}

module.exports = { TurnEngine };
