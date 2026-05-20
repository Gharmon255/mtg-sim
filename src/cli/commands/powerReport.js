const { BracketAnalyzer } = require('../../analysis/BracketAnalyzer');
const { ComboDetector } = require('../../analysis/ComboDetector');
const { ManaAnalyzer } = require('../../analysis/ManaAnalyzer');
const { ArchetypeDetector } = require('../../analysis/ArchetypeDetector');
const { DeckValidator } = require('../../decks/DeckValidator');
const { hydrateCommand } = require('./hydrate');
const { listValue } = require('../args');
const { MoxfieldImporter } = require('../../importers/MoxfieldImporter');

function bracketCommand(args, context) {
  const { deck, report } = analyzePower(args, context);
  printBracketReport(deck, report);
  return 0;
}

function combosCommand(args, context) {
  const deck = loadDeck(args, context);
  const detector = new ComboDetector(context.cardDatabase);
  const report = detector.detect(deck);
  printComboReport(deck, report);
  return 0;
}

function powerCommand(args, context) {
  const { deck, report } = analyzePower(args, context);
  printPowerReport(deck, report);
  return 0;
}

async function reportCommand(args, context) {
  const moxfieldDeckPath = args.moxfield ? await importMoxfieldToFile(args) : null;
  const deckPaths = [moxfieldDeckPath || args.deck].concat(listValue(args.opponents)).filter(Boolean);
  if (!deckPaths.length) throw new Error('Missing --deck path.');
  if (!args.skipHydrate) {
    await hydrateCommand({ ...args, delayMs: args.delayMs || 150 }, context);
    context.cardDatabase.load();
  }
  const decks = deckPaths.map((deckPath) => context.importer.importFromFile(deckPath));
  const validator = new DeckValidator(context.cardDatabase);
  const bracketAnalyzer = new BracketAnalyzer(context.cardDatabase);
  const comboDetector = new ComboDetector(context.cardDatabase);
  const manaAnalyzer = new ManaAnalyzer(context.cardDatabase);
  const archetypeDetector = new ArchetypeDetector(context.cardDatabase);
  const reports = decks.map((deck) => ({
    deck,
    validation: validator.validate(deck),
    power: bracketAnalyzer.analyze(deck),
    combos: comboDetector.detect(deck),
    mana: manaAnalyzer.analyze(deck),
    archetype: archetypeDetector.detect(deck)
  }));
  printFullReports(reports);
  return 0;
}

async function importMoxfieldToFile(args) {
  const importer = new MoxfieldImporter();
  const deck = await importer.importUrl(args.moxfield, { timeoutMs: args.timeoutMs });
  return importer.save(deck);
}

function analyzePower(args, context) {
  const deck = loadDeck(args, context);
  const analyzer = new BracketAnalyzer(context.cardDatabase);
  return { deck, report: analyzer.analyze(deck) };
}

function loadDeck(args, context) {
  if (!args.deck) throw new Error('Missing --deck path.');
  return context.importer.importFromFile(args.deck);
}

function printPowerReport(deck, report) {
  printBracketReport(deck, report);
  console.log('');
  printComboSection(report.comboReport);
  console.log('');
  printArchetypeSection(report.archetype);
  console.log('');
  printManaReport(report.manaReport);
  console.log('');
  printScoreBreakdown(report.scoreBreakdown);
}

function printBracketReport(deck, report) {
  console.log('Deck Power Report');
  console.log('=================');
  console.log(`Deck: ${deck.name}`);
  console.log(`Commander: ${deck.commanders.map((entry) => entry.name).join(' / ') || 'None detected'}`);
  console.log(`Estimated Bracket: ${report.estimatedBracket} - ${report.bracketLabel}`);
  console.log(`Confidence: ${capitalize(report.confidence)}`);
  console.log('');
  console.log('Why:');
  for (const reason of report.reasons) console.log(`- ${reason}`);
  printMessages('Warnings', report.warnings);
}

function printComboReport(deck, report) {
  console.log('Combo Report');
  console.log('============');
  console.log(`Deck: ${deck.name}`);
  printComboSection(report);
  printMessages('Warnings', report.warnings);
}

function printComboSection(report) {
  console.log('Infinite / Combo Findings:');
  if (!report.exactCombos.length && !report.possibleCombos.length) {
    console.log('- No confirmed deterministic combo found.');
  }
  for (const combo of report.exactCombos) {
    console.log(`- Exact combo: ${combo.name} (${combo.type}, confidence ${combo.confidence})`);
    console.log(`  Cards: ${combo.cardsRequired.join(' + ')}`);
    console.log(`  Result: ${combo.result}`);
  }
  for (const combo of report.possibleCombos) {
    console.log(`- Possible combo: ${combo.name} (${combo.type}, confidence ${combo.confidence})`);
    console.log(`  Cards/signals: ${combo.cardsRequired.join(' + ')}`);
    console.log(`  Note: ${combo.explanation}`);
  }
  console.log(`Combo density score: ${report.comboDensityScore}`);
  console.log(`Fastest combo turn estimate: ${report.fastestComboTurnEstimate || 'none'}`);
}

function printArchetypeSection(archetype) {
  console.log('Archetype:');
  console.log(`- Primary: ${archetype.primaryArchetype}`);
  console.log(`- Secondary: ${archetype.secondaryArchetypes.length ? archetype.secondaryArchetypes.join(', ') : 'none'}`);
  console.log(`- Confidence: ${capitalize(archetype.confidence)}`);
  for (const reason of archetype.reasons) console.log(`  ${reason}`);
}

function printScoreBreakdown(scores) {
  console.log('Score Breakdown:');
  const labels = {
    rampScore: 'Ramp',
    interactionScore: 'Interaction',
    tutorScore: 'Tutors',
    fastManaScore: 'Fast Mana',
    comboScore: 'Combo',
    infiniteComboScore: 'Infinite Combo',
    consistencyScore: 'Consistency',
    earlyWinPotential: 'Win Speed',
    protectionScore: 'Protection',
    cardDrawScore: 'Card Draw',
    manaBaseScore: 'Mana Base',
    pubstompRiskScore: 'Pubstomp Risk',
    saltScore: 'Salt'
  };
  for (const [key, label] of Object.entries(labels)) {
    console.log(`${label}: ${scores[key]}`);
  }
  console.log(`Average Mana Value: ${scores.averageManaValue}`);
}

function printManaReport(mana) {
  console.log('Mana Report');
  console.log('===========');
  console.log(`Lands: ${mana.totalLands}`);
  console.log(`White sources: ${mana.coloredSources.W}`);
  console.log(`Blue sources: ${mana.coloredSources.U}`);
  console.log(`Black sources: ${mana.coloredSources.B}`);
  console.log(`Red sources: ${mana.coloredSources.R}`);
  console.log(`Green sources: ${mana.coloredSources.G}`);
  console.log(`Fast mana: ${mana.fastManaCount}`);
  console.log(`Ramp/fixing: ${mana.rampCount}`);
  console.log(`Tapped land estimate: ${mana.tappedLandCount}`);
  console.log(`Commander cast reliability: ${mana.commanderCastReliability}/100`);
  console.log(`Color screw risk: ${mana.colorScrewRisk}`);
  console.log(`Mana base quality: ${mana.manaBaseQualityScore}/100`);
  printMessages('Mana Warnings', mana.warnings);
}

function printFullReports(reports) {
  console.log('Full Deck Report');
  console.log('================');
  for (const item of reports) {
    console.log('');
    console.log(`${item.deck.name}`);
    console.log('-'.repeat(item.deck.name.length));
    console.log(`Commander: ${item.deck.commanders.map((entry) => entry.name).join(' / ') || 'None detected'}`);
    console.log(`Validation: ${item.validation.valid ? 'valid' : 'invalid'}`);
    console.log(`Bracket: ${item.power.estimatedBracket} - ${item.power.bracketLabel} (${item.power.confidence})`);
    console.log(`Archetype: ${item.archetype.primaryArchetype}`);
    console.log(`Major exact combos: ${item.combos.exactCombos.length ? item.combos.exactCombos.map((combo) => combo.name).join(', ') : 'none'}`);
    console.log(`Mana quality: ${item.mana.manaBaseQualityScore}/100; color screw risk ${item.mana.colorScrewRisk}`);
    printMessages('Warnings', item.power.warnings.concat(item.mana.warnings));
  }
  if (reports.length > 1) printPodSummary(reports);
}

function printPodSummary(reports) {
  const sorted = reports.slice().sort((a, b) => b.power.estimatedBracket - a.power.estimatedBracket || b.power.scoreBreakdown.pubstompRiskScore - a.power.scoreBreakdown.pubstompRiskScore);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  console.log('');
  console.log('Pod Summary');
  console.log('===========');
  console.log(`Expected strongest deck: ${strongest.deck.name} (Bracket ${strongest.power.estimatedBracket}, ${strongest.archetype.primaryArchetype})`);
  if (strongest.power.estimatedBracket - weakest.power.estimatedBracket >= 2) {
    console.log(`Warning: ${strongest.deck.name} appears much stronger than ${weakest.deck.name}.`);
  }
}

function printMessages(label, messages) {
  if (!messages.length) return;
  console.log('');
  console.log(`${label}:`);
  for (const message of messages) console.log(`- ${message}`);
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

module.exports = { bracketCommand, combosCommand, powerCommand, reportCommand };
