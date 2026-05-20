const { CardTagger } = require('../cards/CardTagger');
const { COLORS, producedColors, entersTapped } = require('../rules/ManaProduction');

class ManaAnalyzer {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.tagger = options.tagger || new CardTagger(options);
  }

  analyze(deck) {
    const sources = Object.fromEntries(COLORS.map((color) => [color, 0]));
    const earlyPips = Object.fromEntries(COLORS.map((color) => [color, 0]));
    let lands = 0;
    let tappedLands = 0;
    let ramp = 0;
    let fastMana = 0;
    let fixing = 0;
    let nonLand = 0;
    let manaValueTotal = 0;
    const warnings = [];

    for (const entry of deck.cards) {
      const card = this.cardDatabase.get(entry.name) || { name: entry.name, manaValue: 3, tags: [], oracleText: '', typeLine: '' };
      const tags = new Set(this.tagger.tagsFor(card));
      const quantity = entry.quantity;
      const type = String(card.typeLine || '').toLowerCase();
      const isLand = tags.has('land') || type.includes('land') || basicLandColor(entry.name);
      const colors = producedColors(card);
      if (basicLandColor(entry.name)) colors.push(basicLandColor(entry.name));

      if (isLand) {
        lands += quantity;
        if (entersTapped(card)) tappedLands += quantity;
      } else {
        nonLand += quantity;
        manaValueTotal += (card.manaValue || 3) * quantity;
      }

      if (tags.has('ramp') || tags.has('mana-rock') || tags.has('land-ramp')) ramp += quantity;
      if (tags.has('fast-mana')) fastMana += quantity;
      if (colors.length >= 3 || String(card.oracleText || '').toLowerCase().includes('any color')) fixing += quantity;
      for (const color of new Set(colors)) sources[color] += quantity;
      if (!isLand && (card.manaValue || 3) <= 3) {
        for (const color of card.colorIdentity || card.colors || []) earlyPips[color] += quantity;
      }
    }

    const commanderColors = new Set(deck.commanders.flatMap((entry) => {
      const card = this.cardDatabase.get(entry.name);
      return (card && card.colorIdentity) || [];
    }));
    const commanderReliability = commanderCastReliability(sources, commanderColors, lands, ramp, fastMana);
    const colorScrewRisk = riskLabel(100 - commanderReliability);
    const floodRisk = lands >= 42 ? 'High' : lands >= 38 ? 'Medium' : 'Low';
    const quality = manaBaseQuality({ lands, tappedLands, fixing, ramp, fastMana, commanderReliability });
    const averageManaValue = nonLand ? Number((manaValueTotal / nonLand).toFixed(2)) : 0;
    const earlyPlayabilityScore = earlyPlayability(sources, earlyPips, lands, ramp, fastMana);

    for (const color of COLORS) {
      if (earlyPips[color] >= 6 && sources[color] < 10) {
        warnings.push(`Deck has ${sources[color]} ${color} sources but ${earlyPips[color]} early ${color} cards.`);
      }
    }
    if (tappedLands >= 10) warnings.push('Many lands appear to enter tapped, which may slow higher-power decks.');
    if (lands < 30 && ramp + fastMana < 10) warnings.push('Low land count without enough ramp may increase mana shortfall risk.');

    return {
      totalLands: lands,
      coloredSources: sources,
      untappedSourceEstimate: Math.max(0, lands - tappedLands) + fastMana,
      tappedLandCount: tappedLands,
      colorFixingScore: Math.min(100, Math.round(fixing * 7 + Object.values(sources).filter((count) => count >= 10).length * 8)),
      rampCount: ramp,
      fastManaCount: fastMana,
      averageManaValue,
      earlyPlayabilityScore,
      commanderCastReliability: commanderReliability,
      colorScrewRisk,
      manaFloodRisk: floodRisk,
      manaBaseQualityScore: quality,
      warnings
    };
  }
}

function commanderCastReliability(sources, commanderColors, lands, ramp, fastMana) {
  if (!commanderColors.size) return 100;
  const needed = Array.from(commanderColors);
  const sourceScore = needed.reduce((sum, color) => sum + Math.min(25, sources[color] * 2), 0) / needed.length;
  const landScore = lands >= 36 ? 25 : lands >= 32 ? 18 : 10;
  return Math.min(100, Math.round(sourceScore + landScore + ramp * 2 + fastMana * 3));
}

function manaBaseQuality({ lands, tappedLands, fixing, ramp, fastMana, commanderReliability }) {
  let score = commanderReliability * 0.55 + Math.min(25, fixing * 3) + Math.min(20, ramp * 2 + fastMana * 4);
  if (lands < 30) score -= 12;
  if (lands > 42) score -= 10;
  score -= Math.min(18, tappedLands * 1.5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function earlyPlayability(sources, earlyPips, lands, ramp, fastMana) {
  const pressure = Object.entries(earlyPips).reduce((sum, [color, pips]) => sum + Math.max(0, pips - sources[color]), 0);
  return Math.max(0, Math.min(100, Math.round(70 + ramp * 2 + fastMana * 4 + Math.min(15, lands - 30) - pressure * 4)));
}

function riskLabel(score) {
  return score >= 45 ? 'High' : score >= 25 ? 'Medium' : 'Low';
}

function basicLandColor(name) {
  return { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' }[name] || null;
}

module.exports = { ManaAnalyzer };
