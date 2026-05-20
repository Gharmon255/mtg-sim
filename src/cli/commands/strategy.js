const { StrategyProfileBuilder } = require('../../ai/StrategyProfileBuilder');

function strategyCommand(args, context) {
  if (!args.deck) throw new Error('Missing --deck path.');
  const deck = context.importer.importFromFile(args.deck);
  const builder = new StrategyProfileBuilder(context.cardDatabase);
  const profile = builder.build(deck);
  console.log(formatStrategy(profile));
  return 0;
}

function formatStrategy(profile) {
  const lines = [];
  lines.push('Strategy Profile');
  lines.push('================');
  lines.push(`Deck: ${profile.deckName}`);
  lines.push(`Commander: ${profile.commander}`);
  lines.push(`Archetype: ${profile.primaryArchetype}`);
  if (profile.secondaryArchetypes.length) lines.push(`Secondary: ${profile.secondaryArchetypes.join(', ')}`);
  lines.push(`Bracket: ${profile.estimatedBracket}`);
  lines.push('');
  lines.push('Priorities:');
  for (const [label, value] of [
    ['Aggression', profile.aggressionLevel],
    ['Combo', profile.comboPriority],
    ['Control', profile.controlPriority],
    ['Ramp', profile.rampPriority],
    ['Commander', profile.commanderPriority],
    ['Protection', profile.protectionPriority],
    ['Tutor', profile.tutorPriority],
    ['Removal', profile.removalPriority],
    ['Counterspell', profile.counterspellPriority],
    ['Board wipe', profile.boardwipePriority],
    ['Stax', profile.staxPriority]
  ]) {
    lines.push(`- ${label}: ${value}/100`);
  }
  lines.push(`Threat bias: ${profile.threatAssessmentBias}`);
  lines.push('');
  lines.push('Mulligan priorities:');
  for (const item of profile.mulliganPriorities) lines.push(`- ${item}`);
  lines.push('');
  lines.push('Early game:');
  for (const item of profile.earlyGamePlan) lines.push(`- ${item}`);
  lines.push('Mid game:');
  for (const item of profile.midGamePlan) lines.push(`- ${item}`);
  lines.push('Late game:');
  for (const item of profile.lateGamePlan) lines.push(`- ${item}`);
  lines.push('Win plan:');
  for (const item of profile.winPlan) lines.push(`- ${item}`);
  if (profile.warnings.length) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of profile.warnings) lines.push(`- ${warning}`);
  }
  return lines.join('\n');
}

module.exports = { strategyCommand };
