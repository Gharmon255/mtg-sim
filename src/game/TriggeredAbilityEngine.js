class TriggeredAbilityEngine {
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
      owner.createTreasures(1, 'Smothering Tithe');
      created += 1;
    }
    if (created > 0) {
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

function shouldPayForTithe(owner, drawingPlayer) {
  const profile = drawingPlayer.strategyProfile || {};
  if (drawingPlayer.availableMana < 2) return false;
  if ((owner.threatScore || 0) > (drawingPlayer.threatScore || 0) + 5) return true;
  return profile.primaryArchetype === 'control' && drawingPlayer.availableMana >= 4;
}

module.exports = { TriggeredAbilityEngine };
