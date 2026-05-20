module.exports = {
  archetype: 'ramp',
  mulliganWeights: { lands: 30, ramp: 34, draw: 10, payoff: 14 },
  earlyGamePriorities: ['ramp', 'mana-rock', 'land-ramp'],
  midGamePriorities: ['big-threat', 'draw', 'stabilize'],
  lateGamePriorities: ['haymaker', 'wincon'],
  actionWeights: { cast_ramp: 38, cast_fast_mana: 28, cast_wincon: 28, cast_creature: 18 },
  tutorPreferences: ['ramp early', 'finisher late'],
  threatAssessmentBias: 'board-state',
  interactionPolicy: 'Minimal early interaction unless a player can win first.',
  attackPolicy: 'Attack once large threats are online.',
  winAttemptPolicy: 'Use mana advantage to cast haymakers.'
};
