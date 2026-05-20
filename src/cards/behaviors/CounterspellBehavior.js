class CounterspellBehavior {
  constructor(options = {}) {
    this.strength = options.strength || 3;
  }

  canCast(player, card) {
    return player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0);
  }

  cast(context) {
    const { player, card } = context;
    if (player.payCard) {
      if (!player.payCard(card)) return { impact: 0, message: `${player.name} cannot pay for ${card.name}.` };
    } else {
      player.availableMana -= card.manaValue || 0;
    }
    player.interactionShield += this.strength;
    player.metrics.counterspellsHeld += 1;
    player.metrics.spellsCast += 1;
    player.graveyard.push(card);
    return { impact: this.strength, message: `${player.name} holds up ${card.name}.` };
  }
}

module.exports = { CounterspellBehavior };
