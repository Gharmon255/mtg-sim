class CountersBehavior {
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
    const baseImpact = Math.max(2, Math.ceil((card.manaValue || 2) / 2));
    const commanderBonus = player.commanderPermanentNames.size ? 2 : 0;
    player.boardScore += baseImpact + commanderBonus;
    player.threatScore += baseImpact + commanderBonus + 1;
    player.metrics.countersPlayed = (player.metrics.countersPlayed || 0) + 1;
    player.metrics.spellsCast += 1;

    for (const commanderName of player.commanderPermanentNames) {
      player.commanderCombatPower.set(
        commanderName,
        (player.commanderCombatPower.get(commanderName) || 1) + 1
      );
    }

    if (isPermanent(card)) {
      if (player.addPermanent) player.addPermanent(card);
      else player.battlefield.push(card);
    } else {
      player.graveyard.push(card);
    }

    return { impact: baseImpact + commanderBonus, message: `${player.name} grows the board with ${card.name}.` };
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

module.exports = { CountersBehavior };
