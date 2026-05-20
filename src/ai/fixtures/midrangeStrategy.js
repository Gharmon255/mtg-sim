module.exports = {
  archetype: 'midrange',
  mulliganWeights: { lands: 24, ramp: 18, value: 24, interaction: 22 },
  earlyGamePriorities: ['ramp', 'value', 'interaction'],
  midGamePriorities: ['efficient-threat', 'answer-best-threat'],
  lateGamePriorities: ['resilient-threat', 'resource-advantage'],
  actionWeights: { cast_ramp: 18, cast_draw: 20, cast_creature: 22, cast_removal: 22, hold_up_interaction: 10 },
  tutorPreferences: ['best value card', 'answer', 'finisher'],
  threatAssessmentBias: 'board-state',
  interactionPolicy: 'Answer the best threat, not every threat.',
  attackPolicy: 'Attack when profitable and protect resources.',
  winAttemptPolicy: 'Grind resources and win with resilient threats.'
};
