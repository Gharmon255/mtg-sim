class ThreatEvaluator {
  scoreOpponent(player, opponent) {
    const profile = opponent.strategyProfile || {};
    let score = 0;
    score += Math.max(0, 40 - opponent.life) * 0.4;
    score += opponent.boardScore * 2;
    score += opponent.threatScore * 2.5;
    score += opponent.hand.length * 1.2;
    score += opponent.availableMana * 1.5;
    score += (profile.estimatedBracket || 1) * 8;
    score += Math.min(35, profile.comboPriority || 0) * 0.7;
    score += opponent.metrics.comboPiecesSeen * 8 || 0;
    score += opponent.metrics.staxPiecesCast * 5 || 0;
    score += opponent.metrics.comboAttempts * 12 || 0;

    if ((player.strategyProfile || {}).threatAssessmentBias === 'life-total') {
      score += Math.max(0, 30 - opponent.life) * 1.2;
    }
    if ((player.strategyProfile || {}).threatAssessmentBias === 'combo-risk') {
      score += (profile.comboPriority || 0) * 0.8 + (profile.tutorPriority || 0) * 0.35;
    }
    if ((player.strategyProfile || {}).threatAssessmentBias === 'commander-damage') {
      score += commanderDamagePressure(player, opponent) * 2;
    }
    return Math.round(score);
  }

  highestThreat(gameState, player) {
    return gameState.opponentsOf(player)
      .sort((a, b) => this.scoreOpponent(player, b) - this.scoreOpponent(player, a))[0] || null;
  }

  weakestCombatTarget(gameState, player) {
    const profile = player.strategyProfile || {};
    return gameState.opponentsOf(player)
      .sort((a, b) => {
        if (profile.threatAssessmentBias === 'combo-risk') {
          return this.scoreOpponent(player, b) - this.scoreOpponent(player, a);
        }
        return a.life - b.life || this.scoreOpponent(player, b) - this.scoreOpponent(player, a);
      })[0] || null;
  }
}

function commanderDamagePressure(player, opponent) {
  let pressure = 0;
  for (const [key, damage] of opponent.commanderDamage.entries()) {
    if (String(key).startsWith(`${player.id}:`)) pressure = Math.max(pressure, damage);
  }
  return pressure;
}

module.exports = { ThreatEvaluator };
