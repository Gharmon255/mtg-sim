class DrawBehavior {
  constructor(options = {}) {
    this.cards = options.cards || 2;
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
    player.draw(this.cards);
    player.metrics.drawSpellsCast += 1;
    player.metrics.spellsCast += 1;
    player.graveyard.push(card);
    return { impact: this.cards, message: `${player.name} draws cards with ${card.name}.` };
  }
}

module.exports = { DrawBehavior };
