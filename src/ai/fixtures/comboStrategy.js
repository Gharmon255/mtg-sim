module.exports = {
  archetype: 'combo',
  mulliganWeights: { fastMana: 30, tutor: 28, draw: 18, comboPiece: 28, protection: 18, lands: 18 },
  earlyGamePriorities: ['fast-mana', 'ramp', 'draw', 'tutor'],
  midGamePriorities: ['tutor', 'combo-piece', 'protection', 'counterspell'],
  lateGamePriorities: ['combo-win', 'protection', 'backup-combo'],
  actionWeights: { cast_fast_mana: 35, cast_tutor: 32, cast_combo_piece: 34, hold_up_interaction: 28, cast_draw: 18 },
  tutorPreferences: ['missing combo piece', 'protection', 'fast mana'],
  threatAssessmentBias: 'combo-risk',
  interactionPolicy: 'Save interaction to protect own win attempt or stop faster combo.',
  attackPolicy: 'Attack only when it does not slow combo setup.',
  winAttemptPolicy: 'Attempt deterministic combo with protection or when opponents are tapped low.'
};
