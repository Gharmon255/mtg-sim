module.exports = {
  archetype: 'aggro',
  mulliganWeights: { lands: 22, cheapCreature: 30, curve: 24, removal: 10 },
  earlyGamePriorities: ['cheap-creature', 'attack', 'curve-out'],
  midGamePriorities: ['remove-blocker', 'attack-vulnerable-player'],
  lateGamePriorities: ['pump', 'burn', 'haste', 'wide-attack'],
  actionWeights: { cast_creature: 35, cast_removal: 18, cast_wincon: 22, hold_up_interaction: -12 },
  tutorPreferences: ['finisher', 'removal for blocker'],
  threatAssessmentBias: 'life-total',
  interactionPolicy: 'Use removal proactively; rarely hold up mana.',
  attackPolicy: 'Attack the weakest player unless combo is about to win.',
  winAttemptPolicy: 'Close before control or combo stabilizes.'
};
