module.exports = {
  archetype: 'reanimator',
  mulliganWeights: { discard: 24, selfMill: 24, reanimation: 30, target: 22, lands: 20 },
  earlyGamePriorities: ['graveyard-setup', 'discard', 'self-mill'],
  midGamePriorities: ['reanimate-threat', 'protect-threat'],
  lateGamePriorities: ['repeat-recursion', 'haymaker'],
  actionWeights: { setup_graveyard: 34, reanimate_threat: 38, cast_protection: 20, cast_removal: 14 },
  tutorPreferences: ['reanimation target', 'reanimation spell', 'protection'],
  threatAssessmentBias: 'combo-risk',
  interactionPolicy: 'Protect reanimation target and stop graveyard hate.',
  attackPolicy: 'Attack with reanimated threats.',
  winAttemptPolicy: 'Win through repeated large threats.'
};
