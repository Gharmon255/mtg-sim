module.exports = {
  archetype: 'aristocrats',
  mulliganWeights: { sacrificeOutlet: 30, fodder: 20, payoff: 28, lands: 20 },
  earlyGamePriorities: ['sacrifice-outlet', 'fodder'],
  midGamePriorities: ['death-payoff', 'recursion', 'drain'],
  lateGamePriorities: ['combo-drain', 'value-loop'],
  actionWeights: { sacrifice_for_value: 36, cast_creature: 20, cast_draw: 18, cast_removal: 14 },
  tutorPreferences: ['sacrifice outlet', 'death payoff', 'recursion'],
  threatAssessmentBias: 'combo-risk',
  interactionPolicy: 'Protect engine pieces and answer graveyard hate.',
  attackPolicy: 'Attack second; prioritize drain/value loops.',
  winAttemptPolicy: 'Drain opponents through death triggers or loops.'
};
