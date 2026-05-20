module.exports = {
  archetype: 'stax',
  mulliganWeights: { fastMana: 28, staxPiece: 34, lands: 22, protection: 14 },
  earlyGamePriorities: ['fast-mana', 'stax-piece'],
  midGamePriorities: ['keep-lock', 'remove-parity-breaker'],
  lateGamePriorities: ['slow-win-under-lock'],
  actionWeights: { cast_stax_piece: 42, cast_fast_mana: 24, hold_up_interaction: 26, cast_removal: 20 },
  tutorPreferences: ['stax piece', 'protection', 'slow finisher'],
  threatAssessmentBias: 'combo-risk',
  interactionPolicy: 'Stop removal aimed at lock pieces.',
  attackPolicy: 'Win slowly while opponents are constrained.',
  winAttemptPolicy: 'Close after lock pieces reduce opponent action quality.'
};
