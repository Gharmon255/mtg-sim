class TargetingEngine {
  constructor(gameState, threatEvaluator = null) {
    this.gameState = gameState;
    this.threatEvaluator = threatEvaluator;
  }

  highestThreatOpponent(player) {
    if (this.threatEvaluator) return this.threatEvaluator.highestThreat(this.gameState, player);
    return this.gameState.opponentsOf(player).sort((a, b) => b.threatScore - a.threatScore || b.boardScore - a.boardScore)[0] || null;
  }

  highestLifeOpponent(player) {
    return this.gameState.opponentsOf(player).sort((a, b) => b.life - a.life)[0] || null;
  }

  combatTarget(player) {
    if (this.threatEvaluator) return this.threatEvaluator.weakestCombatTarget(this.gameState, player);
    return this.gameState.opponentsOf(player).sort((a, b) => a.life - b.life || b.threatScore - a.threatScore)[0] || null;
  }
}

module.exports = { TargetingEngine };
