const { DeckAnalyzer } = require('../../decks/DeckAnalyzer');

function analyzeCommand(args, context) {
  if (!args.deck) throw new Error('Missing --deck path.');
  const deck = context.importer.importFromFile(args.deck);
  const analyzer = new DeckAnalyzer(context.cardDatabase);
  const analysis = analyzer.analyze(deck);

  console.log(`Deck: ${analysis.deckName}`);
  console.log(`Cards: ${analysis.totalCards}`);
  console.log(`Average mana value: ${analysis.averageManaValue}`);
  console.log(`Strategy: ${analysis.strategy.archetype}`);
  console.log('Buckets:');
  for (const [name, count] of Object.entries(analysis.buckets)) {
    console.log(`  ${name}: ${count}`);
  }
  console.log('Mana curve:');
  for (const [mv, count] of Object.entries(analysis.manaCurve).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`  ${mv}: ${count}`);
  }
  if (analysis.strategy.comboHints.length) {
    console.log('Combo hints:');
    for (const hint of analysis.strategy.comboHints) {
      console.log(`  ${hint.cards.join(' + ')}: ${hint.note}`);
    }
  }
  console.log(`Scores: consistency ${analysis.consistencyScore}, aggression ${analysis.aggressionScore}, interaction ${analysis.interactionScore}`);
  return 0;
}

module.exports = { analyzeCommand };
