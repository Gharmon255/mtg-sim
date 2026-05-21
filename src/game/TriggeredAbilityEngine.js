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
    const before = owner.cardsDrawn || 0;
    owner.draw(1);
    const drawn = (owner.cardsDrawn || 0) - before;
    if (drawn > 0) {
      owner.metrics.rhysticStudyTriggers = (owner.metrics.rhysticStudyTriggers || 0) + 1;
      owner.metrics.rhysticStudyDraws = (owner.metrics.rhysticStudyDraws || 0) + drawn;
      gameState.recordDebug && gameState.recordDebug(`Rhystic Study drew ${drawn} card for ${owner.name}.`);
    } else {
      gameState.recordDebug && gameState.recordDebug(`Rhystic Study resolved for ${owner.name}, but no card was available to draw.`);
    }
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

function isInteractionRelevantCast(card, options = {}) {
  const tags = new Set(card.tags || []);
  if (tags.has('high-impact') || tags.has('wincon') || tags.has('stax') || tags.has('boardwipe')) return true;
  if (tags.has('combo-piece') && tags.has('wincon')) return true;
  if ((options.action || {}).type === 'cast_boardwipe' || (options.action || {}).type === 'cast_wincon') return true;
  return Number(card.manaValue || 0) >= 4;
}

function rhysticImpactScore(owner, castingPlayer, castCard) {
  const base = Number(castCard.manaValue || 0) >= 4 ? 72 : 64;
  const tagBonus = (castCard.tags || []).some((tag) => ['high-impact', 'wincon', 'stax', 'boardwipe'].includes(tag)) ? 10 : 0;
  const ownerBonus = ((owner.strategyProfile || {}).estimatedBracket || 1) >= 4 ? 5 : 0;
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

function shouldPayForTithe(owner, drawingPlayer) {
  const profile = drawingPlayer.strategyProfile || {};
  if (drawingPlayer.availableMana < 2) return false;
  if ((owner.threatScore || 0) > (drawingPlayer.threatScore || 0) + 5) return true;
  return profile.primaryArchetype === 'control' && drawingPlayer.availableMana >= 4;
}

module.exports = { TriggeredAbilityEngine };
