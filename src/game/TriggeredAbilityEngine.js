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

  triggerOneRing(gameState, player, permanent) {
    permanent.metadata.burdenCounters = Number(permanent.metadata.burdenCounters || 0) + 1;
    const damage = permanent.metadata.burdenCounters;
    player.life -= damage;
    player.metrics.oneRingBurdenDamage = (player.metrics.oneRingBurdenDamage || 0) + damage;
    gameState.recordDebug && gameState.recordDebug(`The One Ring burden caused ${damage} life pressure.`);
  }
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
