const { ACTION_TYPES, WINDOW_TYPES, createInteractionWindow } = require('./InteractionWindow');

class TriggeredAbilityEngine {
  constructor(options = {}) {
    this.interactionEngine = options.interactionEngine || null;
  }

  afterDraw(gameState, drawingPlayer, count = 1) {
    for (const permanent of drawingPlayer.battlefield || []) {
      if (permanent.name === 'The One Ring') this.triggerOneRing(gameState, drawingPlayer, permanent);
    }
    for (const player of gameState.players || []) {
      if (player === drawingPlayer || player.eliminated) continue;
      for (const permanent of player.battlefield || []) {
        if (permanent.name === 'Smothering Tithe') this.triggerSmotheringTithe(gameState, player, drawingPlayer, count);
      }
    }
  }

  afterOpponentCast(gameState, castingPlayer, castCard, options = {}) {
    if (!gameState || !castingPlayer || !castCard) return;
    for (const player of gameState.players || []) {
      if (player === castingPlayer || player.eliminated) continue;
      for (const permanent of player.battlefield || []) {
        if (permanent.name === 'Rhystic Study') {
          this.triggerRhysticStudy(gameState, player, castingPlayer, castCard, permanent, options);
        }
        if (isMysticRemoraPermanent(permanent)) {
          this.triggerMysticRemora(gameState, player, castingPlayer, castCard, permanent, options);
        }
        if (isEsperSentinelPermanent(permanent)) {
          this.triggerEsperSentinel(gameState, player, castingPlayer, castCard, permanent, options);
        }
      }
    }
  }

  triggerSmotheringTithe(gameState, owner, drawingPlayer, count) {
    let created = 0;
    for (let index = 0; index < count; index += 1) {
      if (shouldPayForTithe(owner, drawingPlayer)) continue;
      created += 1;
    }
    if (created > 0 && this.interactionEngine && shouldOpenSmotheringTitheWindow(owner, drawingPlayer, created)) {
      const stopped = this.interactionEngine.attemptToStop(gameState, owner, createInteractionWindow(owner, {
        windowType: WINDOW_TYPES.TRIGGERED_ABILITY,
        actionType: ACTION_TYPES.HIGH_IMPACT,
        label: 'Smothering Tithe trigger',
        sourceCard: findPermanentCard(owner, 'Smothering Tithe'),
        targetPlayer: drawingPlayer,
        impactScore: Math.min(95, 70 + created * 8),
        canBeCountered: true,
        canBeRemoved: true,
        canBeProtected: true,
        reason: `${drawingPlayer.name} drew ${count}; Smothering Tithe may create ${created} Treasure`
      }));
      if (stopped.stopped) {
        gameState.recordDebug && gameState.recordDebug(`Smothering Tithe trigger was stopped before creating ${created} Treasure.`);
        return;
      }
    }
    if (created > 0) {
      owner.createTreasures(created, 'Smothering Tithe');
      owner.metrics.treasureTriggers = (owner.metrics.treasureTriggers || 0) + created;
      gameState.recordDebug && gameState.recordDebug(`Smothering Tithe created ${created} Treasure for ${owner.name}.`);
    }
  }

  triggerRhysticStudy(gameState, owner, castingPlayer, castCard, permanent, options = {}) {
    if (!shouldOpenRhysticStudyWindow(owner, castingPlayer, castCard, permanent, options, this.interactionEngine)) {
      return;
    }
    const stopped = this.interactionEngine.attemptToStop(gameState, owner, createInteractionWindow(owner, {
      windowType: WINDOW_TYPES.TRIGGERED_ABILITY,
      actionType: ACTION_TYPES.HIGH_IMPACT,
      label: 'Rhystic Study trigger',
      sourceCard: permanent.card || permanent,
      targetPlayer: castingPlayer,
      impactScore: rhysticImpactScore(owner, castingPlayer, castCard),
      canBeCountered: true,
      canBeRemoved: true,
      canBeProtected: true,
      reason: `${castingPlayer.name} cast ${castCard.name}; Rhystic Study may draw a card`,
      debug: {
        castCard: castCard.name,
        castActionType: options.action ? options.action.type : null
      }
    }));
    if (stopped.stopped) {
      gameState.recordDebug && gameState.recordDebug(`Rhystic Study trigger was stopped before ${owner.name} drew a card.`);
      return;
    }
    resolveTaxThenDraw(gameState, 'rhystic', owner, castingPlayer, castCard, permanent, options);
  }

  triggerMysticRemora(gameState, owner, castingPlayer, castCard, permanent, options = {}) {
    if (!shouldOpenMysticRemoraWindow(owner, castingPlayer, castCard, permanent, options, this.interactionEngine)) {
      return;
    }
    const stopped = this.interactionEngine.attemptToStop(gameState, owner, createInteractionWindow(owner, {
      windowType: WINDOW_TYPES.TRIGGERED_ABILITY,
      actionType: ACTION_TYPES.HIGH_IMPACT,
      label: 'Mystic Remora trigger',
      sourceCard: permanent.card || permanent,
      targetPlayer: castingPlayer,
      impactScore: mysticRemoraImpactScore(owner, castingPlayer, castCard),
      canBeCountered: true,
      canBeRemoved: true,
      canBeProtected: true,
      reason: `${castingPlayer.name} cast noncreature spell ${castCard.name}; Mystic Remora may draw a card`,
      debug: {
        castCard: castCard.name,
        castActionType: options.action ? options.action.type : null,
        noncreatureHeuristic: nonCreatureClassificationReason(castCard)
      }
    }));
    if (stopped.stopped) {
      gameState.recordDebug && gameState.recordDebug(`Mystic Remora trigger was stopped before ${owner.name} drew a card.`);
      return;
    }
    resolveTaxThenDraw(gameState, 'mystic', owner, castingPlayer, castCard, permanent, options);
  }

  triggerEsperSentinel(gameState, owner, castingPlayer, castCard, permanent, options = {}) {
    if (!shouldOpenEsperSentinelWindow(owner, castingPlayer, castCard, permanent, options, this.interactionEngine, gameState)) {
      return;
    }
    markEsperSentinelTrigger(permanent, gameState, castingPlayer);
    const stopped = this.interactionEngine.attemptToStop(gameState, owner, createInteractionWindow(owner, {
      windowType: WINDOW_TYPES.TRIGGERED_ABILITY,
      actionType: ACTION_TYPES.HIGH_IMPACT,
      label: 'Esper Sentinel trigger',
      sourceCard: permanent.card || permanent,
      targetPlayer: castingPlayer,
      impactScore: esperSentinelImpactScore(owner, castingPlayer, castCard),
      canBeCountered: true,
      canBeRemoved: true,
      canBeProtected: true,
      reason: `${castingPlayer.name} cast first noncreature spell ${castCard.name}; Esper Sentinel may draw a card`,
      debug: {
        castCard: castCard.name,
        castActionType: options.action ? options.action.type : null,
        noncreatureHeuristic: nonCreatureClassificationReason(castCard),
        firstSpellGate: esperSentinelTurnKey(gameState, castingPlayer)
      }
    }));
    if (stopped.stopped) {
      gameState.recordDebug && gameState.recordDebug(`Esper Sentinel trigger was stopped before ${owner.name} drew a card.`);
      return;
    }
    resolveTaxThenDraw(gameState, 'esper', owner, castingPlayer, castCard, permanent, options);
  }

  triggerOneRing(gameState, player, permanent) {
    permanent.metadata.burdenCounters = Number(permanent.metadata.burdenCounters || 0) + 1;
    const damage = permanent.metadata.burdenCounters;
    player.life -= damage;
    player.metrics.oneRingBurdenDamage = (player.metrics.oneRingBurdenDamage || 0) + damage;
    gameState.recordDebug && gameState.recordDebug(`The One Ring burden caused ${damage} life pressure.`);
  }
}

function shouldOpenRhysticStudyWindow(owner, castingPlayer, castCard, permanent, options, interactionEngine) {
  if (!interactionEngine || !owner || !castingPlayer || !castCard || !permanent) return false;
  if (owner === castingPlayer || owner.eliminated || castingPlayer.eliminated) return false;
  if (!isInteractionRelevantCast(castCard, options)) return false;
  return Boolean(castCard.name && castingPlayer.name && owner.name);
}

function shouldOpenMysticRemoraWindow(owner, castingPlayer, castCard, permanent, options, interactionEngine) {
  if (!interactionEngine || !owner || !castingPlayer || !castCard || !permanent) return false;
  if (owner === castingPlayer || owner.eliminated || castingPlayer.eliminated) return false;
  if (!isNonCreatureCast(castCard, options)) return false;
  return Boolean(castCard.name && castingPlayer.name && owner.name);
}

function shouldOpenEsperSentinelWindow(owner, castingPlayer, castCard, permanent, options, interactionEngine, gameState) {
  if (!interactionEngine || !owner || !castingPlayer || !castCard || !permanent) return false;
  if (owner === castingPlayer || owner.eliminated || castingPlayer.eliminated) return false;
  if (!isNonCreatureCast(castCard, options)) return false;
  if (hasEsperSentinelTriggeredThisTurn(permanent, gameState, castingPlayer)) return false;
  return Boolean(castCard.name && castingPlayer.name && owner.name);
}

function isInteractionRelevantCast(card, options = {}) {
  const tags = new Set(card.tags || []);
  if (tags.has('high-impact') || tags.has('wincon') || tags.has('stax') || tags.has('boardwipe')) return true;
  if (tags.has('combo-piece') && tags.has('wincon')) return true;
  if ((options.action || {}).type === 'cast_boardwipe' || (options.action || {}).type === 'cast_wincon') return true;
  return Number(card.manaValue || 0) >= 4;
}

function isNonCreatureCast(card, options = {}) {
  const tags = new Set(card.tags || []);
  const typeLine = String(card.typeLine || '').toLowerCase();
  if (tags.has('creature') || typeLine.includes('creature')) return false;
  if (typeLine.trim()) return true;
  if (['cast_creature'].includes((options.action || {}).type)) return false;
  if (['cast_draw', 'cast_tutor', 'cast_removal', 'cast_counterspell', 'cast_boardwipe', 'cast_stax_piece', 'cast_wincon'].includes((options.action || {}).type)) {
    return true;
  }
  if (['instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'battle'].some((tag) => tags.has(tag))) return true;
  return false;
}

function nonCreatureClassificationReason(card) {
  const typeLine = String(card.typeLine || '').trim();
  if (typeLine) return `type line "${typeLine}"`;
  const tags = (card.tags || []).join(', ');
  return tags ? `tags ${tags}` : 'missing type data';
}

function rhysticImpactScore(owner, castingPlayer, castCard) {
  const base = Number(castCard.manaValue || 0) >= 4 ? 72 : 64;
  const tagBonus = (castCard.tags || []).some((tag) => ['high-impact', 'wincon', 'stax', 'boardwipe'].includes(tag)) ? 10 : 0;
  const ownerBonus = ((owner.strategyProfile || {}).estimatedBracket || 1) >= 4 ? 5 : 0;
  const casterBonus = ['combo', 'control'].includes((castingPlayer.strategyProfile || {}).primaryArchetype) ? 4 : 0;
  return Math.min(95, base + tagBonus + ownerBonus + casterBonus);
}

function mysticRemoraImpactScore(owner, castingPlayer, castCard) {
  const base = Number(castCard.manaValue || 0) >= 4 ? 74 : 66;
  const tagBonus = (castCard.tags || []).some((tag) => ['high-impact', 'wincon', 'stax', 'boardwipe', 'tutor'].includes(tag)) ? 8 : 0;
  const ownerBonus = ((owner.strategyProfile || {}).estimatedBracket || 1) >= 4 ? 5 : 0;
  const casterBonus = ['combo', 'control'].includes((castingPlayer.strategyProfile || {}).primaryArchetype) ? 4 : 0;
  return Math.min(95, base + tagBonus + ownerBonus + casterBonus);
}

function esperSentinelImpactScore(owner, castingPlayer, castCard) {
  const base = Number(castCard.manaValue || 0) >= 4 ? 73 : 67;
  const tagBonus = (castCard.tags || []).some((tag) => ['high-impact', 'wincon', 'stax', 'boardwipe', 'tutor'].includes(tag)) ? 7 : 0;
  const ownerBonus = ((owner.strategyProfile || {}).estimatedBracket || 1) >= 4 ? 4 : 0;
  const casterBonus = ['combo', 'control'].includes((castingPlayer.strategyProfile || {}).primaryArchetype) ? 4 : 0;
  return Math.min(95, base + tagBonus + ownerBonus + casterBonus);
}

function shouldOpenSmotheringTitheWindow(owner, drawingPlayer, created) {
  if (!created) return false;
  const ownerProfile = owner.strategyProfile || {};
  const drawingProfile = drawingPlayer.strategyProfile || {};
  return created >= 2
    || (ownerProfile.estimatedBracket || 1) >= 3
    || drawingProfile.primaryArchetype === 'control'
    || drawingProfile.primaryArchetype === 'combo';
}

function findPermanentCard(player, name) {
  const permanent = (player.battlefield || []).find((item) => item.name === name);
  return permanent ? (permanent.card || permanent) : { name };
}

function isMysticRemoraPermanent(permanent) {
  if (!permanent) return false;
  if (permanent.name === 'Mystic Remora') return true;
  const card = permanent.card || permanent;
  const tags = new Set(card.tags || permanent.tags || []);
  return tags.has('mystic-remora') || tags.has('mystic-remora-style');
}

function isEsperSentinelPermanent(permanent) {
  if (!permanent) return false;
  if (permanent.name === 'Esper Sentinel') return true;
  const card = permanent.card || permanent;
  const tags = new Set(card.tags || permanent.tags || []);
  return tags.has('esper-sentinel') || tags.has('esper-sentinel-style');
}

function hasEsperSentinelTriggeredThisTurn(permanent, gameState, castingPlayer) {
  const metadata = permanent.metadata || {};
  const key = esperSentinelTurnKey(gameState, castingPlayer);
  return Boolean((metadata.esperSentinelCastTriggers || {})[key]);
}

function markEsperSentinelTrigger(permanent, gameState, castingPlayer) {
  permanent.metadata = permanent.metadata || {};
  permanent.metadata.esperSentinelCastTriggers = permanent.metadata.esperSentinelCastTriggers || {};
  permanent.metadata.esperSentinelCastTriggers[esperSentinelTurnKey(gameState, castingPlayer)] = true;
}

function esperSentinelTurnKey(gameState, castingPlayer) {
  const gameTurn = gameState && gameState.turn !== undefined ? gameState.turn : 0;
  const playerTurn = castingPlayer && castingPlayer.turnCount !== undefined ? castingPlayer.turnCount : 0;
  const playerId = castingPlayer && castingPlayer.id !== undefined ? castingPlayer.id : 'unknown';
  return `${gameTurn}:${playerTurn}:${playerId}`;
}

function shouldPayForTithe(owner, drawingPlayer) {
  const profile = drawingPlayer.strategyProfile || {};
  if (drawingPlayer.availableMana < 2) return false;
  if ((owner.threatScore || 0) > (drawingPlayer.threatScore || 0) + 5) return true;
  return profile.primaryArchetype === 'control' && drawingPlayer.availableMana >= 4;
}

function resolveTaxThenDraw(gameState, kind, owner, castingPlayer, castCard, permanent, options = {}) {
  const config = taxConfig(kind, permanent);
  owner.metrics[config.triggerMetric] = (owner.metrics[config.triggerMetric] || 0) + 1;
  const decision = decideHeuristicTaxPayment(kind, owner, castingPlayer, castCard, permanent, options, config);
  if (decision.shouldPay && payHeuristicTax(castingPlayer, config, decision)) {
    owner.metrics[config.paidMetric] = (owner.metrics[config.paidMetric] || 0) + 1;
    gameState.recordDebug && gameState.recordDebug(`${castingPlayer.name} pays ${config.label} heuristic tax (${decision.reason}); ${owner.name} does not draw.`);
    return;
  }

  owner.metrics[config.declinedMetric] = (owner.metrics[config.declinedMetric] || 0) + 1;
  gameState.recordDebug && gameState.recordDebug(`${castingPlayer.name} does not pay ${config.label} heuristic tax (${decision.reason}); ${owner.name} may draw.`);
  const before = owner.cardsDrawn || 0;
  owner.draw(1);
  const drawn = (owner.cardsDrawn || 0) - before;
  if (drawn > 0) {
    owner.metrics[config.drawMetric] = (owner.metrics[config.drawMetric] || 0) + drawn;
    gameState.recordDebug && gameState.recordDebug(`${config.label} drew ${drawn} card for ${owner.name}.`);
  } else {
    gameState.recordDebug && gameState.recordDebug(`${config.label} resolved for ${owner.name}, but no card was available to draw.`);
  }
}

function taxConfig(kind, permanent) {
  if (kind === 'mystic') {
    return {
      label: 'Mystic Remora',
      amount: 4,
      triggerMetric: 'mysticRemoraTriggers',
      drawMetric: 'mysticRemoraDraws',
      paidMetric: 'mysticTaxesPaid',
      declinedMetric: 'mysticTaxesDeclined'
    };
  }
  if (kind === 'esper') {
    return {
      label: 'Esper Sentinel',
      amount: esperTaxAmount(permanent),
      triggerMetric: 'esperSentinelTriggers',
      drawMetric: 'esperSentinelDraws',
      paidMetric: 'esperTaxesPaid',
      declinedMetric: 'esperTaxesDeclined'
    };
  }
  return {
    label: 'Rhystic Study',
    amount: 1,
    triggerMetric: 'rhysticStudyTriggers',
    drawMetric: 'rhysticStudyDraws',
    paidMetric: 'rhysticTaxesPaid',
    declinedMetric: 'rhysticTaxesDeclined'
  };
}

function esperTaxAmount(permanent) {
  const raw = Number((permanent && (permanent.power || (permanent.card || {}).power)) || 1);
  return Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.floor(raw)) : 1;
}

function decideHeuristicTaxPayment(kind, owner, castingPlayer, castCard, permanent, options, config) {
  if (!owner || !castingPlayer || !castCard) return { shouldPay: false, reason: 'missing payment context' };
  const taxCard = taxPaymentCard(config);
  const canPay = canPayHeuristicTax(castingPlayer, taxCard);
  if (!canPay) return { shouldPay: false, reason: `cannot pay ${config.amount}` };

  const available = estimateAvailableMana(castingPlayer);
  const commanderTax = Number(options.commanderTax || 0);
  const estimatedPostCast = Math.max(0, available - Number(castCard.manaValue || 0) - commanderTax);
  const reserve = taxReserve(kind, castingPlayer, castCard, options);
  const shouldPay = estimatedPostCast >= config.amount + reserve;
  const commanderTaxNote = commanderTax > 0 ? ` after commander tax ${commanderTax}` : '';
  return {
    shouldPay,
    taxCard,
    reason: shouldPay
      ? `estimated spare mana ${estimatedPostCast}${commanderTaxNote} covers tax ${config.amount} with reserve ${reserve}`
      : `estimated spare mana ${estimatedPostCast}${commanderTaxNote} below tax ${config.amount} plus reserve ${reserve}`
  };
}

function canPayHeuristicTax(player, taxCard) {
  if (player && typeof player.canPayCard === 'function') return player.canPayCard(taxCard);
  return Number((player && player.availableMana) || 0) >= Number(taxCard.manaValue || 0);
}

function payHeuristicTax(player, config, decision) {
  const taxCard = decision.taxCard || taxPaymentCard(config);
  if (player && typeof player.payCard === 'function') return player.payCard(taxCard);
  if (Number((player && player.availableMana) || 0) < Number(config.amount || 0)) return false;
  player.availableMana -= Number(config.amount || 0);
  return true;
}

function taxPaymentCard(config) {
  return {
    name: `${config.label} heuristic tax`,
    manaCost: `{${config.amount}}`,
    manaValue: config.amount,
    typeLine: 'Tax Payment',
    tags: []
  };
}

function estimateAvailableMana(player) {
  if (player && typeof player.refreshManaPool === 'function') {
    const pool = player.refreshManaPool();
    return pool && typeof pool.total === 'function' ? pool.total() : Number(player.availableMana || 0);
  }
  return Number((player && player.availableMana) || 0);
}

function taxReserve(kind, castingPlayer, castCard, options = {}) {
  const profile = (castingPlayer && castingPlayer.strategyProfile) || {};
  const highImpact = isInteractionRelevantCast(castCard, options);
  let reserve = kind === 'mystic' ? 2 : kind === 'esper' ? 1 : highImpact ? 2 : 0;
  if (profile.primaryArchetype === 'control') reserve = Math.max(0, reserve - 1);
  if (profile.primaryArchetype === 'combo' && highImpact) reserve += 1;
  if ((castingPlayer.hand || []).length <= 2) reserve += 1;
  return reserve;
}

module.exports = { TriggeredAbilityEngine };
