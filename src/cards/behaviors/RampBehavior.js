class RampBehavior {
  constructor(options = {}) {
    this.rampAmount = options.rampAmount || 1;
    this.boardScore = options.boardScore || 0;
    this.delayedLand = Boolean(options.delayedLand);
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
    const reusableSource = isReusableManaPermanent(card);
    if (!reusableSource) player.rampMana += this.rampAmount;
    player.boardScore += this.boardScore;
    player.threatScore += this.boardScore;
    player.metrics.rampPlayed += 1;
    player.metrics.spellsCast += 1;
    if (isPermanent(card)) {
      if (player.addPermanent) player.addPermanent(card);
      else player.battlefield.push(card);
    }
    else player.graveyard.push(card);
    return { impact: this.rampAmount + this.boardScore, message: `${player.name} ramps with ${card.name}.` };
  }
}

function isReusableManaPermanent(card) {
  const type = String((card && card.typeLine) || '').toLowerCase();
  return type.includes('artifact') || type.includes('creature');
}

function isPermanent(card) {
  const type = String((card && card.typeLine) || '').toLowerCase();
  return type.includes('artifact')
    || type.includes('creature')
    || type.includes('enchantment')
    || type.includes('planeswalker')
    || type.includes('battle');
}

module.exports = { RampBehavior };
