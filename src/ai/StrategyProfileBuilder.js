const { BracketAnalyzer } = require('../analysis/BracketAnalyzer');
const { DeckAnalyzer } = require('../decks/DeckAnalyzer');
const { CardTagger } = require('../cards/CardTagger');
const { StrategyProfile } = require('./StrategyProfile');
const fixtures = require('./fixtures');
const { CardRoleResolver } = require('../cards/CardRoleResolver');
const { CommanderPlanResolver } = require('./CommanderPlanResolver');

class StrategyProfileBuilder {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.tagger = options.tagger || new CardTagger(options);
    this.roleResolver = options.roleResolver || new CardRoleResolver(options);
    this.bracketAnalyzer = options.bracketAnalyzer || new BracketAnalyzer(cardDatabase, { ...options, tagger: this.tagger });
    this.deckAnalyzer = options.deckAnalyzer || new DeckAnalyzer(cardDatabase);
    this.commanderPlanResolver = options.commanderPlanResolver || new CommanderPlanResolver(cardDatabase, { roleResolver: this.roleResolver });
  }

  build(deck) {
    const power = this.bracketAnalyzer.analyze(deck);
    const deckAnalysis = this.deckAnalyzer.analyze(deck);
    const archetype = power.archetype.primaryArchetype || 'midrange';
    const secondary = power.archetype.secondaryArchetypes || [];
    const fixture = fixtures[archetype] || fixtures.midrange;
    const scores = power.scoreBreakdown || {};
    const stats = power.stats || {};
    const profile = new StrategyProfile({
      deckName: deck.name,
      commander: deck.commanders.map((entry) => entry.name).join(' / '),
      primaryArchetype: archetype,
      secondaryArchetypes: secondary,
      estimatedBracket: power.estimatedBracket,
      aggressionLevel: baseAggression(archetype, scores, stats),
      comboPriority: priorityFrom(scores.comboScore, archetype === 'combo' ? 30 : 0),
      controlPriority: priorityFrom(scores.interactionScore, archetype === 'control' ? 25 : 0),
      rampPriority: priorityFrom(scores.rampScore, archetype === 'ramp' ? 25 : 0),
      commanderPriority: commanderPriority(archetype, scores),
      protectionPriority: priorityFrom(scores.protectionScore, ['voltron', 'combo'].includes(archetype) ? 25 : 0),
      tutorPriority: priorityFrom(scores.tutorScore, archetype === 'combo' ? 25 : 0),
      removalPriority: priorityFrom(scores.removalScore, ['control', 'stax'].includes(archetype) ? 20 : 0),
      counterspellPriority: priorityFrom(scores.counterspellScore, archetype === 'control' || archetype === 'combo' ? 15 : 0),
      boardwipePriority: priorityFrom(scores.interactionScore, archetype === 'control' ? 15 : 0),
      staxPriority: priorityFrom(stats.stax * 25 + stats.massLandDenial * 30, archetype === 'stax' ? 35 : 0),
      threatAssessmentBias: fixture.threatAssessmentBias || threatBias(archetype),
      fixture,
      comboReport: power.comboReport,
      manaReport: power.manaReport,
      scoreBreakdown: scores,
      warnings: power.warnings.slice()
    });

    profile.mulliganPriorities = fixture.earlyGamePriorities ? mulliganPriorities(profile).concat(Object.keys(fixture.mulliganWeights || {}).slice(0, 3)) : mulliganPriorities(profile);
    profile.earlyGamePlan = fixture.earlyGamePriorities || earlyPlan(profile, deckAnalysis);
    profile.midGamePlan = fixture.midGamePriorities || midPlan(profile);
    profile.lateGamePlan = fixture.lateGamePriorities || latePlan(profile);
    profile.winPlan = winPlan(profile, power);
    profile.commanderPlan = this.commanderPlanResolver.resolve(deck, profile);
    if (profile.commanderPlan.protect) profile.protectionPriority = Math.max(profile.protectionPriority, 75);
    return profile;
  }
}

function priorityFrom(score = 0, bonus = 0) {
  return Math.max(0, Math.min(100, Math.round(score + bonus)));
}

function baseAggression(archetype, scores, stats) {
  const base = {
    aggro: 85,
    voltron: 75,
    tokens: 68,
    ramp: 52,
    combo: 25,
    control: 20,
    stax: 30,
    aristocrats: 45,
    reanimator: 45
  }[archetype] || 45;
  return Math.max(0, Math.min(100, base + Math.min(15, stats.wincons * 2) - Math.round((scores.counterspellScore || 0) / 12)));
}

function commanderPriority(archetype, scores) {
  if (archetype === 'voltron') return 95;
  if (archetype === 'commander-damage') return 90;
  if (archetype === 'combo') return Math.max(35, scores.commanderDependencyScore || 35);
  return Math.max(25, Math.min(75, scores.commanderDependencyScore || 35));
}

function threatBias(archetype) {
  return {
    combo: 'combo-risk',
    control: 'combo-risk',
    aggro: 'life-total',
    voltron: 'commander-damage',
    stax: 'combo-risk',
    ramp: 'board-state'
  }[archetype] || 'board-state';
}

function mulliganPriorities(profile) {
  const common = ['2-4 lands', 'castable early play'];
  if (profile.primaryArchetype === 'combo') return ['fast mana', 'tutor or combo piece', 'protection or interaction'].concat(common);
  if (profile.primaryArchetype === 'control') return ['3 lands', 'interaction', 'card draw'].concat(common);
  if (profile.primaryArchetype === 'aggro') return ['2-3 lands', 'cheap creature', 'early pressure'].concat(common);
  if (profile.primaryArchetype === 'ramp') return ['3 lands', 'ramp spell or mana rock'].concat(common);
  if (profile.primaryArchetype === 'voltron') return ['lands for commander', 'protection', 'equipment or counters'].concat(common);
  return common;
}

function earlyPlan(profile) {
  if (profile.primaryArchetype === 'combo') return ['deploy fast mana', 'find missing combo pieces', 'avoid unprotected win attempts'];
  if (profile.primaryArchetype === 'control') return ['make land drops', 'hold interaction', 'answer early combo pressure'];
  if (profile.primaryArchetype === 'aggro') return ['cast cheap threats', 'attack vulnerable players'];
  if (profile.primaryArchetype === 'ramp') return ['prioritize ramp', 'set up high-mana turns'];
  if (profile.primaryArchetype === 'voltron') return ['cast commander', 'add protection and damage support'];
  return ['develop mana', 'cast efficient setup cards'];
}

function midPlan(profile) {
  if (profile.primaryArchetype === 'combo') return ['assemble deterministic line', 'hold protection if possible'];
  if (profile.primaryArchetype === 'control') return ['trade interaction for high-impact plays', 'wipe boards when behind'];
  if (profile.primaryArchetype === 'stax') return ['deploy lock pieces', 'pressure combo decks'];
  if (profile.primaryArchetype === 'tokens') return ['build a wide board', 'find payoff effects'];
  if (profile.primaryArchetype === 'aristocrats') return ['assemble outlet plus payoff', 'convert creatures into value'];
  return ['increase board pressure', 'protect strongest plan'];
}

function latePlan(profile) {
  if (profile.comboPriority >= 60) return ['attempt protected combo win'];
  if (profile.aggressionLevel >= 70) return ['convert board into lethal combat'];
  if (profile.controlPriority >= 70) return ['stabilize and win with finishers'];
  return ['use accumulated advantage to close the game'];
}

function winPlan(profile, power) {
  const plans = [];
  if ((power.comboReport.exactCombos || []).length) plans.push('win through exact combo lines');
  if (profile.primaryArchetype === 'voltron') plans.push('win through commander damage');
  if (profile.aggressionLevel >= 65) plans.push('win through combat pressure');
  if (!plans.length) plans.push('win through board advantage and attrition');
  return plans;
}

module.exports = { StrategyProfileBuilder };
