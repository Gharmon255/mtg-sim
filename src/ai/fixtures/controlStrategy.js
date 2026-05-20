module.exports = {
  archetype: 'control',
  mulliganWeights: { lands: 28, draw: 20, counterspell: 28, removal: 24, boardwipe: 14 },
  earlyGamePriorities: ['play_land', 'hold_up_interaction', 'draw'],
  midGamePriorities: ['counterspell', 'removal', 'boardwipe', 'draw'],
  lateGamePriorities: ['protected-finisher', 'hold_up_interaction'],
  actionWeights: { hold_up_interaction: 42, cast_counterspell: 35, cast_removal: 30, cast_boardwipe: 28, cast_draw: 18 },
  tutorPreferences: ['board wipe if behind', 'counterspell', 'removal', 'wincon if stable'],
  threatAssessmentBias: 'combo-risk',
  interactionPolicy: 'Hold up mana and stop high-impact plays first.',
  attackPolicy: 'Avoid overcommitting; attack after stabilizing.',
  winAttemptPolicy: 'Win late with a protected finisher.'
};
