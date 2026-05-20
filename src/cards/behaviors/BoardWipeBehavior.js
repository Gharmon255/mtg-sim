class BoardWipeBehavior {
  canCast(player, card) {
    return player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0);
  }

  cast(context) {
    const { gameState, player, card } = context;
    if (player.payCard) {
      if (!player.payCard(card)) return { impact: 0, message: `${player.name} cannot pay for ${card.name}.` };
    } else {
      player.availableMana -= card.manaValue || 0;
    }
    for (const opponent of gameState.activePlayers()) {
      opponent.boardScore = Math.floor(opponent.boardScore * 0.2);
      opponent.threatScore = Math.floor(opponent.threatScore * 0.3);
    }
    player.metrics.boardWipesCast += 1;
    player.metrics.spellsCast += 1;
    player.graveyard.push(card);
    return { impact: 8, message: `${player.name} resets the board with ${card.name}.` };
  }
}

module.exports = { BoardWipeBehavior };
