const { analyzeDeckStrategy } = require('./DeckStrategy');

class DeckAnalyzer {
  constructor(cardDatabase) {
    this.cardDatabase = cardDatabase;
  }

  analyze(deck) {
    const buckets = {
      lands: 0,
      ramp: 0,
      draw: 0,
      removal: 0,
      protection: 0,
      counters: 0,
      creatures: 0,
      wincons: 0,
      unknown: 0
    };
    const manaCurve = {};

    for (const entry of deck.cards) {
      const card = this.cardDatabase.get(entry.name);
      if (!card) {
        buckets.unknown += entry.quantity;
        continue;
      }
      const tags = new Set(card.tags || []);
      const isLand = tags.has('land');
      const mv = Math.min(card.manaValue || 0, 7);
      manaCurve[mv] = (manaCurve[mv] || 0) + entry.quantity;
      if (isLand) buckets.lands += entry.quantity;
      if (!isLand && tags.has('ramp')) buckets.ramp += entry.quantity;
      if (tags.has('draw')) buckets.draw += entry.quantity;
      if (tags.has('removal') || tags.has('counterspell') || tags.has('boardwipe')) buckets.removal += entry.quantity;
      if (tags.has('protection')) buckets.protection += entry.quantity;
      if (tags.has('counters')) buckets.counters += entry.quantity;
      if (tags.has('creature')) buckets.creatures += entry.quantity;
      if (tags.has('wincon')) buckets.wincons += entry.quantity;
    }

    const nonLand = Math.max(1, deck.totalCards - buckets.lands);
    const strategy = analyzeDeckStrategy(deck, this.cardDatabase);
    return {
      deckName: deck.name,
      totalCards: deck.totalCards,
      buckets,
      manaCurve,
      strategy,
      consistencyScore: Math.round(Math.min(100, (buckets.lands * 1.3 + buckets.ramp * 4 + buckets.draw * 3) / 2)),
      aggressionScore: Math.round(Math.min(100, (buckets.creatures * 2 + buckets.wincons * 8) / 2)),
      interactionScore: Math.round(Math.min(100, buckets.removal * 8 + buckets.protection * 5)),
      averageManaValue: Number((Object.entries(manaCurve).reduce((sum, [mv, count]) => sum + Number(mv) * count, 0) / nonLand).toFixed(2))
    };
  }
}

module.exports = { DeckAnalyzer };
