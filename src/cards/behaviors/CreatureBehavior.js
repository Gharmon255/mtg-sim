class CreatureBehavior {
  constructor(options = {}) {
    this.boardScore = options.boardScore;
    this.threatScore = options.threatScore;
    this.burstDamage = options.burstDamage || 0;
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
    const power = Number(card.power) || Math.max(1, card.manaValue || 1);
    const toughness = Number(card.toughness) || Math.max(1, card.manaValue || 1);
    const board = this.boardScore === undefined ? Math.ceil((power + toughness) / 2) : this.boardScore;
    const threat = this.threatScore === undefined ? board : this.threatScore;
    player.boardScore += board;
    player.threatScore += threat;
    player.metrics.creaturesCast += 1;
    player.metrics.spellsCast += 1;
    if (player.addPermanent) player.addPermanent(card);
    else player.battlefield.push(card);

    if (this.burstDamage > 0) {
      const target = targeting.highestLifeOpponent(player);
      if (target) {
        target.life -= this.burstDamage;
        player.damageDealt += this.burstDamage;
      }
    }

    return { impact: board + threat, message: `${player.name} develops the board with ${card.name}.` };
  }
}

module.exports = { CreatureBehavior };
