const CommanderRules = {
  startingLife: 40,
  deckSize: 100,
  maxPlayers: 4,
  minPlayers: 2,
  commanderTaxPerCast: 2,
  commanderDamageLimit: 21,
  basicLandNames: new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']),
  maxCommanders: 2,

  isBasicLand(card) {
    return Boolean(card && card.typeLine && card.typeLine.includes('Basic Land'));
  },

  isAllowedCommander(card) {
    if (!card || !card.typeLine) return false;
    const typeLine = card.typeLine;
    const oracleText = card.oracleText || '';
    return typeLine.includes('Legendary Creature')
      || oracleText.includes('can be your commander')
      || (card.tags || []).includes('commander');
  },

  hasPartnerLikeAbility(card) {
    const text = String((card && card.oracleText) || '').toLowerCase();
    return text.includes('partner')
      || text.includes('friends forever')
      || text.includes('choose a background')
      || text.includes("doctor's companion")
      || text.includes('doctor’s companion');
  },

  commanderTax(timesCast) {
    return timesCast * this.commanderTaxPerCast;
  }
};

module.exports = { CommanderRules };
