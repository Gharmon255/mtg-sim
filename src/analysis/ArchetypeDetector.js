const { CardTagger } = require('../cards/CardTagger');

class ArchetypeDetector {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.tagger = options.tagger || new CardTagger(options);
  }

  detect(deck) {
    const signals = emptySignals();
    const reasons = [];

    for (const entry of deck.cards) {
      const card = this.cardDatabase.get(entry.name) || { name: entry.name, tags: [] };
      const tags = new Set(this.tagger.tagsFor(card));
      const type = String(card.typeLine || '').toLowerCase();
      const text = String(card.oracleText || '').toLowerCase();
      const name = String(entry.name || '').toLowerCase();
      const quantity = entry.quantity;

      if (tags.has('creature')) signals.aggro += quantity;
      if (tags.has('removal') || tags.has('counterspell') || tags.has('boardwipe')) signals.control += quantity * 2;
      if (tags.has('draw') || tags.has('ramp')) signals.midrange += quantity;
      if (tags.has('combo-piece') || tags.has('infinite-combo-piece')) signals.combo += quantity * 5;
      if (tags.has('aristocrats') || tags.has('sacrifice-outlet') || text.includes('dies')) signals.aristocrats += quantity * 2;
      if (tags.has('tokens') || tags.has('token-doubler')) signals.tokens += quantity * 2;
      if (tags.has('commander-damage') || tags.has('protection') || type.includes('equipment')) signals.voltron += quantity * 2;
      if (tags.has('spellslinger') || tags.has('storm')) signals.spellslinger += quantity;
      if (tags.has('stax') || tags.has('mass-land-denial')) signals.stax += quantity * 3;
      if (tags.has('reanimation')) signals.reanimator += quantity * 3;
      if (tags.has('blink')) signals.blink += quantity * 2;
      if (tags.has('graveyard-synergy')) signals.graveyard += quantity * 2;
      if (tags.has('counters')) signals.counters += quantity * 2;
      if (tags.has('lifegain') || tags.has('lifedrain')) signals.lifegain += quantity;
      if (tags.has('ramp')) signals.ramp += quantity * 2;
      if (tags.has('storm')) signals.storm += quantity * 3;
      if (name.includes('sliver') || name.includes('elf') || name.includes('goblin') || name.includes('zombie')) signals.tribal += quantity;
    }

    const ranked = Object.entries(signals)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);
    const primary = ranked[0] || ['midrange', 0];
    const secondary = ranked.slice(1, 4).filter(([, score]) => score >= Math.max(4, primary[1] * 0.45));

    if (primary[1]) reasons.push(`${primary[0]} has the strongest tag signal (${primary[1]} points).`);
    for (const [name, score] of secondary) reasons.push(`${name} is also present (${score} points).`);

    return {
      primaryArchetype: primary[0],
      secondaryArchetypes: secondary.map(([name]) => name),
      confidence: primary[1] >= 20 ? 'high' : primary[1] >= 10 ? 'medium' : 'low',
      reasons
    };
  }
}

function emptySignals() {
  return {
    aggro: 0,
    control: 0,
    midrange: 0,
    combo: 0,
    aristocrats: 0,
    tokens: 0,
    voltron: 0,
    spellslinger: 0,
    stax: 0,
    reanimator: 0,
    blink: 0,
    graveyard: 0,
    counters: 0,
    lifegain: 0,
    tribal: 0,
    ramp: 0,
    storm: 0
  };
}

module.exports = { ArchetypeDetector };
