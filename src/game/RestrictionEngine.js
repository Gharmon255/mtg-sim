class RestrictionEngine {
  canActivate({ player, permanent, ability, context = {} }) {
    const failures = [];
    if (!permanent || permanent.sacrificed) failures.push('source missing');
    if (ability.costs.tap && permanent && permanent.tapped) failures.push('source tapped');
    if (ability.oncePerTurn && permanent && permanent.metadata && permanent.metadata.activatedTurn === context.turn) failures.push('once per turn used');

    for (const restriction of ability.restrictions || []) {
      const failure = checkRestriction(restriction, player, permanent, ability, context);
      if (failure) failures.push(failure);
    }

    return {
      allowed: failures.length === 0,
      failures
    };
  }
}

function checkRestriction(restriction, player, permanent, ability, context) {
  if (restriction === 'commander-only' && !context.isCommander) return 'commander-only';
  if (restriction === 'requires-imprint' && !(permanent.metadata && permanent.metadata.imprintedColor)) return 'requires imprint';
  if (restriction === 'requires-land-discarded' && !(permanent.metadata && permanent.metadata.discardedLand)) return 'requires discarded land';
  if (restriction === 'combo-or-empty-hand') {
    const archetype = (player.strategyProfile && player.strategyProfile.primaryArchetype) || '';
    const handSize = (player.hand || []).length;
    const comboReason = archetype === 'combo' || context.comboActive || context.force;
    if (!comboReason && handSize > 1) return 'hand too valuable';
  }
  return null;
}

module.exports = { RestrictionEngine };
