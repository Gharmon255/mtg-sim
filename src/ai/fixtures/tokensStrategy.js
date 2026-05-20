module.exports = {
  archetype: 'tokens',
  mulliganWeights: { lands: 22, tokenMaker: 28, ramp: 18, payoff: 22 },
  earlyGamePriorities: ['token-maker', 'ramp'],
  midGamePriorities: ['anthem', 'token-doubler', 'payoff'],
  lateGamePriorities: ['wide-attack', 'drain-payoff'],
  actionWeights: { cast_creature: 25, cast_wincon: 24, cast_protection: 18, cast_draw: 14 },
  tutorPreferences: ['token doubler', 'payoff', 'protection'],
  threatAssessmentBias: 'board-state',
  interactionPolicy: 'Protect board from wipes when possible.',
  attackPolicy: 'Attack wide when board is stronger than opponents.',
  winAttemptPolicy: 'Win with wide combat or token payoff.'
};
