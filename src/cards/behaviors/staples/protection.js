const { StapleBehavior } = require('./StapleBehavior');

function registerProtection(registry) {
  const protect = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'protection',
    basePriority: 5,
    interactionPriority: 84,
    archetypePriority: { combo: 14, voltron: 32, tokens: 18, stax: 14 },
    explain,
    ...extra
  }));
  const equipment = (name, explain) => registry.register(name, new StapleBehavior({
    kind: 'protection-equipment',
    basePriority: 28,
    earlyPriority: 20,
    archetypePriority: { voltron: 35, combo: 10, midrange: 8 },
    explain,
    cast(context) {
      const { player, card } = context;
      if (player.payCard) {
        if (!player.payCard(card)) return { impact: 0, message: `${player.name} cannot pay for ${card.name}.` };
      } else {
        player.availableMana -= card.manaValue || 0;
      }
      player.commanderDamageShield += 3;
      player.interactionShield += 1;
      player.metrics.spellsCast += 1;
      if (player.addPermanent) player.addPermanent(card);
      else player.battlefield.push(card);
      return { impact: 3, message: `${player.name} sets up commander protection with ${card.name}.` };
    }
  }));

  protect('Heroic Intervention', 'held until a board wipe, lethal attack, or key removal spell');
  protect('Teferi\'s Protection', 'held for lethal attacks, board wipes, or protected wins', { interactionPriority: 96, shield: 6, commanderShield: 6 });
  protect('Deflecting Swat', 'free protection for combo, commander, or key permanent', { free: true, interactionPriority: 90 });
  protect('Flawless Maneuver', 'free board protection when commander is central', { free: true, interactionPriority: 88 });
  protect('Silence', 'combo decks hold this before a win attempt', { archetypePriority: { combo: 36, control: 10 } });
  protect('Grand Abolisher', 'proactive protection for combo turns and commander-centric plans', { basePriority: 26, earlyPriority: 14 });
  equipment('Lightning Greaves', 'voltron and commander decks prioritize early protection');
  equipment('Swiftfoot Boots', 'commander-centric decks prioritize reusable protection');
}

module.exports = { registerProtection };
