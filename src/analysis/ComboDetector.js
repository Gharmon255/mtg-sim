const fs = require('fs');
const path = require('path');
const { CardTagger } = require('../cards/CardTagger');
const { ManaAnalyzer } = require('./ManaAnalyzer');
const { CommanderComboRules } = require('./CommanderComboRules');

class ComboDetector {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.tagger = options.tagger || new CardTagger(options);
    this.manaAnalyzer = options.manaAnalyzer || new ManaAnalyzer(cardDatabase, { ...options, tagger: this.tagger });
    this.commanderRules = options.commanderRules || new CommanderComboRules(cardDatabase, { ...options, tagger: this.tagger });
    this.comboPath = options.comboPath || path.join(process.cwd(), 'data/known-combos.json');
    this.knownCombos = loadCombos(this.comboPath);
  }

  detect(deck) {
    const names = new Set(deck.cards.map((entry) => normalizeName(entry.name)));
    const cards = deck.cards.map((entry) => {
      const card = this.cardDatabase.get(entry.name) || { name: entry.name, tags: [] };
      return { entry, card, tags: new Set(this.tagger.tagsFor(card)) };
    });

    const exactCombos = this.knownCombos.filter((combo) => combo.cardsRequired.every((name) => names.has(normalizeName(name))));
    const manaReport = this.manaAnalyzer.analyze(deck);
    const commanderFindings = this.commanderRules.detect(deck);
    const possibleCombos = detectPossibleCombos(cards, names).concat(commanderFindings.map(commanderFindingToCombo));
    const enrichedExactCombos = exactCombos.map((combo) => enrichCombo(combo, { cards, deck, manaReport }));
    const infiniteLoops = exactCombos
      .filter((combo) => String(combo.type || '').includes('infinite'))
      .concat(possibleCombos.filter((combo) => String(combo.type || '').includes('infinite')));
    const fastest = enrichedExactCombos.concat(possibleCombos)
      .map((combo) => combo.fastestComboTurnEstimate || combo.speed)
      .filter((speed) => Number.isFinite(Number(speed)))
      .sort((a, b) => a - b)[0] || null;
    const density = comboDensityScore(cards, enrichedExactCombos, possibleCombos);
    const warnings = [];

    if (exactCombos.some((combo) => combo.bracketImpact >= 5)) {
      warnings.push('Detected a compact deterministic combo commonly associated with cEDH or very high-power decks.');
    }
    if (!exactCombos.length && possibleCombos.length) {
      warnings.push('Only pattern-based combo warnings were found; these require human review.');
    }

    return {
      exactCombos: enrichedExactCombos,
      possibleCombos,
      infiniteLoops,
      comboDensityScore: density,
      fastestComboTurnEstimate: fastest,
      realisticComboTurnRange: fastest ? comboTurnRange(fastest) : null,
      comboConsistencyScore: comboConsistencyScore(cards, enrichedExactCombos, manaReport),
      comboSetupDifficulty: comboSetupDifficulty(enrichedExactCombos, manaReport),
      warnings
    };
  }
}

function enrichCombo(combo, context) {
  const required = combo.cardsRequired || [];
  const pieceMana = required.map((name) => {
    const item = context.cards.find((candidate) => normalizeName(candidate.entry.name) === normalizeName(name));
    return item ? Number(item.card.manaValue || 2) : 2.5;
  });
  const totalMana = pieceMana.reduce((sum, value) => sum + value, 0);
  const commanderPieces = required.filter((name) => context.deck.commanders.some((entry) => normalizeName(entry.name) === normalizeName(name))).length;
  const tutors = context.cards.filter((item) => item.tags.has('tutor')).length;
  const draw = context.cards.filter((item) => item.tags.has('draw') || item.tags.has('card-draw')).length;
  const fastMana = context.manaReport.fastManaCount;
  const estimate = Math.max(2, Math.ceil(totalMana / 3) + required.length - 1 - Math.floor(tutors / 3) - Math.floor(fastMana / 3) - commanderPieces);
  const fastestTurn = Math.max(2, Math.min(Number(combo.speed || 6), estimate));
  return {
    ...combo,
    fastestComboTurnEstimate: fastestTurn,
    realisticComboTurnRange: comboTurnRange(fastestTurn + Math.max(0, 2 - Math.floor((tutors + draw) / 8))),
    comboConsistencyScore: Math.min(100, Math.round(35 + tutors * 7 + draw * 3 + fastMana * 5 - Math.max(0, required.length - 2) * 8)),
    comboSetupDifficulty: required.length <= 2 && tutors >= 3 ? 'low' : required.length <= 3 ? 'medium' : 'high'
  };
}

function commanderFindingToCombo(finding) {
  return {
    name: finding.name,
    cardsRequired: [finding.commander],
    optionalCards: [],
    result: finding.result,
    type: finding.type,
    speed: 5,
    bracketImpact: finding.bracketImpact || 1,
    explanation: finding.result,
    confidence: finding.confidence || 'low'
  };
}

function detectPossibleCombos(cards, names) {
  const results = [];
  const byTag = (tag) => cards.filter((item) => item.tags.has(tag)).map((item) => item.entry.name);

  const manaOutlets = byTag('mana-outlet');
  const infinitePieces = byTag('infinite-combo-piece');
  const untappers = byTag('untapper');
  const tokenDoublers = byTag('token-doubler');
  const sacrificeOutlets = byTag('sacrifice-outlet');
  const aristocrats = byTag('aristocrats');

  if (names.has(normalizeName('Walking Ballista')) && cards.some((item) => item.tags.has('counters'))) {
    results.push(patternCombo(
      'Walking Ballista plus counter support',
      ['Walking Ballista'],
      'Possible scalable damage or infinite outlet if paired with a repeatable counter/lifegain engine.',
      'possible-infinite-damage',
      5,
      'medium'
    ));
  }

  if (infinitePieces.length >= 2 && manaOutlets.length) {
    results.push(patternCombo(
      'Infinite mana outlet package',
      infinitePieces.slice(0, 3).concat(manaOutlets.slice(0, 2)),
      'Multiple infinite combo pieces plus mana outlet tags suggest an infinite mana payoff line may exist.',
      'possible-infinite-mana',
      4,
      'low'
    ));
  }

  if (untappers.length && cards.filter((item) => item.tags.has('ramp') && !item.tags.has('land')).length >= 3) {
    results.push(patternCombo(
      'Untap plus mana engine',
      untappers.slice(0, 2),
      'Untap effects plus several nonland mana sources can create mana-loop potential.',
      'possible-infinite-mana',
      4,
      'low'
    ));
  }

  if (tokenDoublers.length && sacrificeOutlets.length && aristocrats.length) {
    results.push(patternCombo(
      'Token sacrifice drain engine',
      tokenDoublers.slice(0, 2).concat(sacrificeOutlets.slice(0, 2), aristocrats.slice(0, 2)),
      'Token doubling, sacrifice outlets, and death triggers can become loop engines with the right missing piece.',
      'possible-infinite-death-loop',
      5,
      'low'
    ));
  }

  return results;
}

function patternCombo(name, cards, explanation, type, speed, confidence) {
  return {
    name,
    cardsRequired: cards,
    optionalCards: [],
    result: explanation,
    type,
    speed,
    bracketImpact: confidence === 'low' ? 2 : 3,
    explanation,
    confidence
  };
}

function comboDensityScore(cards, exactCombos, possibleCombos) {
  const pieceCount = cards.reduce((sum, item) => sum + (item.tags.has('combo-piece') ? item.entry.quantity : 0) + (item.tags.has('infinite-combo-piece') ? item.entry.quantity : 0), 0);
  return Math.min(100, Math.round(pieceCount * 6 + exactCombos.length * 18 + possibleCombos.length * 8));
}

function comboConsistencyScore(cards, combos, manaReport) {
  const tutors = cards.filter((item) => item.tags.has('tutor')).length;
  const draw = cards.filter((item) => item.tags.has('draw') || item.tags.has('card-draw')).length;
  return Math.min(100, Math.round(combos.length * 12 + tutors * 7 + draw * 3 + manaReport.fastManaCount * 5));
}

function comboSetupDifficulty(combos, manaReport) {
  if (!combos.length) return 'none';
  const minCards = Math.min(...combos.map((combo) => (combo.cardsRequired || []).length));
  if (minCards <= 2 && manaReport.fastManaCount >= 3) return 'low';
  if (minCards <= 3) return 'medium';
  return 'high';
}

function comboTurnRange(turn) {
  if (!turn) return null;
  const start = Math.max(1, turn);
  return `Turns ${start}-${start + 2}`;
}

function loadCombos(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { ComboDetector };
