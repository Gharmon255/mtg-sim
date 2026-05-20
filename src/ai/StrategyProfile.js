class StrategyProfile {
  constructor(values = {}) {
    Object.assign(this, {
      deckName: '',
      commander: '',
      primaryArchetype: 'midrange',
      secondaryArchetypes: [],
      estimatedBracket: 1,
      aggressionLevel: 35,
      comboPriority: 0,
      controlPriority: 25,
      rampPriority: 35,
      commanderPriority: 35,
      protectionPriority: 20,
      tutorPriority: 0,
      removalPriority: 25,
      counterspellPriority: 0,
      boardwipePriority: 0,
      staxPriority: 0,
      threatAssessmentBias: 'board-state',
      mulliganPriorities: [],
      earlyGamePlan: [],
      midGamePlan: [],
      lateGamePlan: [],
      winPlan: [],
      warnings: [],
      comboReport: null,
      manaReport: null,
      scoreBreakdown: {}
    }, values);
  }

  summary() {
    return `${this.primaryArchetype}, Bracket ${this.estimatedBracket}: ${this.winPlan.join('; ') || 'develop mana and threats'}.`;
  }
}

module.exports = { StrategyProfile };
