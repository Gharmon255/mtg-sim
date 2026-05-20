class RemovalBehavior {
  constructor(options = {}) {
    this.strength = options.strength || 3;
    this.playerDamage = options.playerDamage || 0;
  }

  canCast(player, card) {
    return player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0);
  }

  cast(context) {
    const { player, card, targeting } = context;
    if (player.payCard) {
      if (!player.payCard(card)) return { impact: 0, message: `${player.name} cannot pay for ${card.name}.` };
    } else {
      player.availableMana -= card.manaValue || 0;
    }
    const target = targeting.highestThreatOpponent(player);
    if (target) {
      const reduction = Math.min(target.boardScore, this.strength * 2);
      target.boardScore = Math.max(0, target.boardScore - reduction);
      target.threatScore = Math.max(0, target.threatScore - reduction);
      if (target.commanderPermanentNames && target.commanderPermanentNames.size) {
        const commanderName = Array.from(target.commanderPermanentNames)[0];
        target.commanderCombatPower.set(
          commanderName,
          Math.max(0, (target.commanderCombatPower.get(commanderName) || 1) - this.strength)
        );
      }
      target.life -= this.playerDamage;
    }
    player.metrics.removalUsed += 1;
    player.metrics.spellsCast += 1;
    player.graveyard.push(card);
    return { impact: this.strength, message: `${player.name} uses ${card.name} as interaction.` };
  }
}

module.exports = { RemovalBehavior };
