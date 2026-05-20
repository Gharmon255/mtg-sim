class DefaultBehavior {
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
    if ((card.tags || []).includes('protection')) {
      player.interactionShield += 2;
      player.commanderDamageShield += 3;
      player.metrics.protectionUsed = (player.metrics.protectionUsed || 0) + 1;
    }
    if (isPermanent(card)) {
      if (player.addPermanent) player.addPermanent(card);
      else player.battlefield.push(card);
      if ((card.tags || []).includes('stax')) {
        player.metrics.staxPiecesCast = (player.metrics.staxPiecesCast || 0) + 1;
        player.threatScore += 2;
      }
      if ((card.tags || []).includes('combo-piece') || (card.tags || []).includes('infinite-combo-piece')) {
        player.metrics.comboPiecesSeen = (player.metrics.comboPiecesSeen || 0) + 1;
        player.threatScore += 2;
      }
    } else {
      player.graveyard.push(card);
    }
    player.metrics.spellsCast += 1;
    return { impact: 0, message: `${player.name} casts ${card.name}.` };
  }
}

function isPermanent(card) {
  const type = String((card && card.typeLine) || '').toLowerCase();
  return type.includes('artifact')
    || type.includes('creature')
    || type.includes('enchantment')
    || type.includes('planeswalker')
    || type.includes('battle');
}

module.exports = { DefaultBehavior };
