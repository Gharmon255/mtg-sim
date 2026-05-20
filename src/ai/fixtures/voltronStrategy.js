module.exports = {
  archetype: 'voltron',
  mulliganWeights: { lands: 24, protection: 26, commanderSupport: 30, ramp: 14 },
  earlyGamePriorities: ['cast_commander', 'equipment', 'protection'],
  midGamePriorities: ['protect-commander', 'commander-damage'],
  lateGamePriorities: ['lethal-commander-attack'],
  actionWeights: { cast_commander: 42, cast_protection: 32, hold_up_interaction: 24, cast_creature: 10 },
  tutorPreferences: ['protection', 'equipment', 'aura'],
  threatAssessmentBias: 'commander-damage',
  interactionPolicy: 'Protect commander first.',
  attackPolicy: 'Attack players closest to commander-damage death.',
  winAttemptPolicy: 'Kill with commander damage.'
};
