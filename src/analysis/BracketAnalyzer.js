const { CardTagger } = require('../cards/CardTagger');
const { ComboDetector } = require('./ComboDetector');
const { ArchetypeDetector } = require('./ArchetypeDetector');
const { ManaAnalyzer } = require('./ManaAnalyzer');

class BracketAnalyzer {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.tagger = options.tagger || new CardTagger(options);
    this.comboDetector = options.comboDetector || new ComboDetector(cardDatabase, { ...options, tagger: this.tagger });
    this.archetypeDetector = options.archetypeDetector || new ArchetypeDetector(cardDatabase, { ...options, tagger: this.tagger });
    this.manaAnalyzer = options.manaAnalyzer || new ManaAnalyzer(cardDatabase, { ...options, tagger: this.tagger });
  }

  analyze(deck) {
    const warnings = [];
    const reasons = [];
    const comboReport = this.comboDetector.detect(deck);
    const archetype = this.archetypeDetector.detect(deck);
    const manaReport = this.manaAnalyzer.analyze(deck);
    const stats = collectStats(deck, this.cardDatabase, this.tagger);

    if (stats.missingCards > 0) {
      warnings.push(`Card data missing for ${stats.missingCards} card entries, so confidence is reduced.`);
    }
    if (comboReport.warnings.length) warnings.push(...comboReport.warnings);
    if (stats.massLandDenial > 0 || stats.stax > 2) warnings.push('Stax or mass-land-denial cards increase pubstomp risk in casual pods.');
    if (stats.missingCards > 20) warnings.push('False-low risk: many card records are missing, so powerful cards may be undercounted.');

    const scoreBreakdown = {
      rampScore: scoreCount(stats.ramp, 12),
      fastManaScore: scoreCount(stats.fastMana, 6),
      tutorScore: scoreCount(stats.tutors, 8),
      comboScore: comboReport.comboDensityScore,
      infiniteComboScore: Math.min(100, comboReport.infiniteLoops.length * 34),
      interactionScore: scoreCount(stats.interaction, 14),
      removalScore: scoreCount(stats.removal, 10),
      counterspellScore: scoreCount(stats.counterspells, 8),
      protectionScore: scoreCount(stats.protection, 8),
      cardDrawScore: scoreCount(stats.draw, 12),
      winconScore: scoreCount(stats.wincons, 7),
      manaBaseScore: manaReport.manaBaseQualityScore,
      averageManaValue: stats.averageManaValue,
      commanderDependencyScore: commanderDependencyScore(deck, this.cardDatabase, this.tagger),
      earlyWinPotential: earlyWinPotential(stats, comboReport),
      consistencyScore: consistencyScore(stats, manaReport),
      saltScore: saltScore(stats, comboReport),
      pubstompRiskScore: pubstompRiskScore(stats, comboReport)
    };

    const weighted = weightedPowerScore(scoreBreakdown);
    let estimatedBracket = bracketFromScore(weighted);
    estimatedBracket = Math.max(estimatedBracket, bracketFloor(stats, comboReport));

    if (manaReport.manaBaseQualityScore < 45 && estimatedBracket >= 3) {
      warnings.push('Mana base quality appears low for the estimated power level.');
    } else if (manaReport.manaFloodRisk === 'High') {
      warnings.push('Mana flood risk appears high because the deck has a very large land count.');
    }

    reasons.push(`${stats.ramp} ramp cards, including ${stats.fastMana} fast mana card(s).`);
    reasons.push(`${stats.interaction} interaction cards (${stats.removal} removal, ${stats.counterspells} counterspells).`);
    reasons.push(`${stats.draw} draw/card-advantage cards and ${stats.tutors} tutor(s).`);
    reasons.push(`Average mana value is ${stats.averageManaValue}.`);
    reasons.push(`Mana base quality is ${manaReport.manaBaseQualityScore}/100 with ${manaReport.fastManaCount} fast mana card(s).`);
    reasons.push(`${comboReport.exactCombos.length} exact combo(s) and ${comboReport.possibleCombos.length} possible combo pattern(s) detected.`);
    reasons.push(`Primary archetype appears to be ${archetype.primaryArchetype}.`);

    return {
      estimatedBracket,
      bracketLabel: bracketLabel(estimatedBracket),
      confidence: confidence(stats, comboReport),
      reasons,
      warnings,
      scoreBreakdown,
      comboReport,
      archetype,
      manaReport,
      stats
    };
  }
}

function collectStats(deck, cardDatabase, tagger) {
  const stats = {
    totalCards: deck.totalCards,
    lands: 0,
    ramp: 0,
    fastMana: 0,
    rituals: 0,
    tutors: 0,
    draw: 0,
    interaction: 0,
    removal: 0,
    boardwipes: 0,
    counterspells: 0,
    protection: 0,
    stax: 0,
    massLandDenial: 0,
    extraTurns: 0,
    wincons: 0,
    comboPieces: 0,
    infiniteComboPieces: 0,
    highImpact: 0,
    freeInteraction: 0,
    cedhStaples: 0,
    missingCards: 0,
    manaValueTotal: 0,
    nonLandCards: 0,
    colorFixingLands: 0
  };

  for (const entry of deck.cards) {
    const knownCard = cardDatabase.get(entry.name);
    const card = knownCard || { name: entry.name, tags: [] };
    if (!knownCard) {
      stats.missingCards += entry.quantity;
    }
    const tags = new Set(tagger.tagsFor(card));
    const quantity = entry.quantity;
    const type = String(card.typeLine || '').toLowerCase();
    const isLand = tags.has('land') || type.includes('land') || looksLikeLand(entry.name);
    const manaValue = knownCard ? (card.manaValue || 0) : inferMissingManaValue(entry.name, tags, isLand);

    if (isLand) {
      stats.lands += quantity;
      if (String(card.oracleText || '').includes('Add one mana of any color') || String(card.oracleText || '').includes('any color')) {
        stats.colorFixingLands += quantity;
      }
    } else {
      stats.nonLandCards += quantity;
      stats.manaValueTotal += manaValue * quantity;
    }

    if (!isLand && tags.has('ramp')) stats.ramp += quantity;
    if (tags.has('fast-mana') || tags.has('cedh-staple')) stats.fastMana += tags.has('fast-mana') ? quantity : 0;
    if (tags.has('ritual')) stats.rituals += quantity;
    if (tags.has('tutor')) stats.tutors += quantity;
    if (tags.has('draw')) stats.draw += quantity;
    if (tags.has('removal')) stats.removal += quantity;
    if (tags.has('boardwipe')) stats.boardwipes += quantity;
    if (tags.has('counterspell')) stats.counterspells += quantity;
    if (tags.has('protection')) stats.protection += quantity;
    if (tags.has('stax')) stats.stax += quantity;
    if (tags.has('mass-land-denial')) stats.massLandDenial += quantity;
    if (tags.has('extra-turn')) stats.extraTurns += quantity;
    if (tags.has('wincon')) stats.wincons += quantity;
    if (tags.has('combo-piece')) stats.comboPieces += quantity;
    if (tags.has('infinite-combo-piece')) stats.infiniteComboPieces += quantity;
    if (tags.has('high-impact') || tags.has('extra-turn')) stats.highImpact += quantity;
    if (tags.has('free-spell')) stats.freeInteraction = (stats.freeInteraction || 0) + quantity;
    if (tags.has('cedh-staple')) stats.cedhStaples = (stats.cedhStaples || 0) + quantity;
  }

  stats.interaction = stats.removal + stats.boardwipes + stats.counterspells;
  stats.averageManaValue = stats.nonLandCards ? Number((stats.manaValueTotal / stats.nonLandCards).toFixed(2)) : 0;
  return stats;
}

function scoreCount(count, strongCount) {
  return Math.min(100, Math.round((count / strongCount) * 100));
}

function manaBaseScore(stats) {
  const landScore = stats.lands >= 35 ? 70 : stats.lands >= 32 ? 55 : stats.lands >= 29 ? 38 : 20;
  return Math.min(100, landScore + Math.min(25, stats.colorFixingLands * 3));
}

function commanderDependencyScore(deck, cardDatabase, tagger) {
  const commanders = deck.commanders.map((entry) => cardDatabase.get(entry.name)).filter(Boolean);
  if (!commanders.length) return 60;
  const commanderTags = new Set(commanders.flatMap((card) => tagger.tagsFor(card)));
  let score = 25;
  if (commanderTags.has('combo-piece') || commanderTags.has('infinite-combo-piece')) score += 35;
  if (commanderTags.has('commander-damage') || commanderTags.has('counters')) score += 20;
  if (deck.commanders.length > 1) score += 10;
  return Math.min(100, score);
}

function earlyWinPotential(stats, comboReport) {
  let score = 0;
  if (comboReport.fastestComboTurnEstimate) score += Math.max(0, 70 - comboReport.fastestComboTurnEstimate * 10);
  score += stats.fastMana * 8 + stats.tutors * 5 + stats.comboPieces * 4 + stats.rituals * 5;
  if (stats.averageManaValue <= 2.4) score += 12;
  return Math.min(100, Math.round(score));
}

function consistencyScore(stats, manaReport) {
  return Math.min(100, Math.round(stats.ramp * 4 + stats.draw * 4 + stats.tutors * 7 + stats.fastMana * 5 + manaReport.manaBaseQualityScore * 0.25 - Math.max(0, stats.averageManaValue - 3.2) * 12));
}

function saltScore(stats, comboReport) {
  return Math.min(100, Math.round(stats.stax * 12 + stats.massLandDenial * 20 + stats.extraTurns * 12 + comboReport.exactCombos.length * 10 + stats.highImpact * 6));
}

function pubstompRiskScore(stats, comboReport) {
  return Math.min(100, Math.round(stats.fastMana * 10 + stats.tutors * 7 + comboReport.exactCombos.length * 15 + stats.stax * 8 + stats.massLandDenial * 12));
}

function weightedPowerScore(scores) {
  return Math.round(
    scores.rampScore * 0.08 +
    scores.fastManaScore * 0.12 +
    scores.tutorScore * 0.11 +
    scores.comboScore * 0.15 +
    scores.infiniteComboScore * 0.12 +
    scores.interactionScore * 0.1 +
    scores.cardDrawScore * 0.08 +
    scores.winconScore * 0.06 +
    scores.manaBaseScore * 0.05 +
    scores.earlyWinPotential * 0.08 +
    scores.consistencyScore * 0.05 +
    scores.pubstompRiskScore * 0.1
  );
}

function bracketFromScore(score) {
  if (score >= 76) return 5;
  if (score >= 58) return 4;
  if (score >= 38) return 3;
  if (score >= 20) return 2;
  return 1;
}

function bracketFloor(stats, comboReport) {
  if (comboReport.exactCombos.some((combo) => combo.bracketImpact >= 5) && stats.tutors >= 2) return 5;
  if (comboReport.exactCombos.length || stats.fastMana >= 3 || stats.tutors >= 4 || (stats.cedhStaples || 0) >= 5) return 4;
  if (stats.ramp >= 8 || stats.interaction >= 8 || stats.comboPieces >= 3) return 3;
  return 1;
}

function confidence(stats, comboReport) {
  const hydratedRatio = stats.totalCards ? (stats.totalCards - stats.missingCards) / stats.totalCards : 0;
  if (hydratedRatio >= 0.9 && (comboReport.exactCombos.length || (stats.cedhStaples || 0) >= 3)) return 'high';
  if (hydratedRatio >= 0.75) return 'medium';
  if (comboReport.exactCombos.length >= 2) return 'medium';
  if (stats.missingCards > 8) return 'low';
  if (comboReport.exactCombos.length || stats.missingCards <= 2) return 'high';
  return 'medium';
}

function looksLikeLand(name) {
  return /\b(plains|island|swamp|mountain|forest|tower|tomb|strand|delta|heath|foothills|rainforest|catacombs|flats|tarn|mire|vista|pool|grave|shrine|garden|fountain|sea|tropical|tundra|bayou|savannah|scrubland|orchard|confluence|caverns|boseiju|otawara)\b/i.test(name);
}

function inferMissingManaValue(name, tags, isLand) {
  if (isLand) return 0;
  if (tags.has('fast-mana') || tags.has('free-spell')) return 0;
  if (tags.has('tutor') || tags.has('counterspell') || tags.has('protection')) return 1.5;
  if (tags.has('combo-piece')) return 2.5;
  if (tags.has('wincon')) return 4;
  if (/\b(mox|lotus|crypt|pact|force|probe)\b/i.test(name)) return 0;
  return 3;
}

function bracketLabel(bracket) {
  return {
    1: 'Very Casual',
    2: 'Casual Functional',
    3: 'Upgraded',
    4: 'High Power',
    5: 'cEDH-style'
  }[bracket] || 'Unknown';
}

module.exports = { BracketAnalyzer };
