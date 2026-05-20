const { abilitiesForCard, staticRestrictionsForCard } = require('./ActivatedAbility');
const { RestrictionEngine } = require('./RestrictionEngine');
const { payAbilityCost } = require('./AbilityCost');

class AbilityResolver {
  constructor(options = {}) {
    this.restrictions = options.restrictions || new RestrictionEngine();
  }

  decoratePermanent(permanent) {
    const staticRules = staticRestrictionsForCard(permanent.card || permanent);
    permanent.metadata = {
      ...(permanent.metadata || {}),
      ...staticRules
    };
    const abilities = abilitiesForCard(permanent.card || permanent);
    if (abilities.length) {
      permanent.activatedAbilities = mergeAbilities(permanent.activatedAbilities || [], abilities);
      permanent.manaAbilities = permanent.activatedAbilities.filter((ability) => ability.abilityType === 'mana');
    }
    return permanent;
  }

  canActivate(player, permanent, abilityType, context = {}) {
    const ability = findAbility(permanent, abilityType);
    if (!ability) return { success: false, reason: 'ability missing' };
    const restricted = this.restrictions.canActivate({ player, permanent, ability, context });
    if (!restricted.allowed) return { success: false, reason: restricted.failures.join(', ') };
    return { success: true, ability };
  }

  activate(player, permanent, abilityType, context = {}) {
    const check = this.canActivate(player, permanent, abilityType, context);
    if (!check.success) {
      recordAvoided(player, check.reason);
      return check;
    }
    const ability = check.ability;
    const paid = payAbilityCost(player, permanent, ability.costs, context);
    if (!paid.success) {
      recordAvoided(player, paid.reason);
      return paid;
    }
    applyEffects(player, permanent, ability, context);
    permanent.metadata = permanent.metadata || {};
    permanent.metadata.activatedTurn = context.turn || player.turnCount || 0;
    player.metrics.activatedAbilitiesUsed = (player.metrics.activatedAbilitiesUsed || 0) + 1;
    if (ability.abilityType === 'mana') player.metrics.manaAbilitiesActivated = (player.metrics.manaAbilitiesActivated || 0) + 1;
    if (ability.abilityType === 'untap') player.metrics.untapAbilitiesActivated = (player.metrics.untapAbilitiesActivated || 0) + 1;
    if (ability.abilityType === 'channel') player.metrics.channelAbilitiesUsed = (player.metrics.channelAbilitiesUsed || 0) + 1;
    return { success: true, ability };
  }
}

function findAbility(permanent, abilityType) {
  return (permanent.activatedAbilities || []).find((ability) => ability.abilityType === abilityType) || null;
}

function mergeAbilities(existing, incoming) {
  const byId = new Map(existing.map((ability) => [ability.id, ability]));
  for (const ability of incoming) byId.set(ability.id, ability);
  return Array.from(byId.values());
}

function applyEffects(player, permanent, ability, context) {
  for (const effect of ability.effects || []) {
    if (effect === 'untap-self' && permanent && !permanent.sacrificed) permanent.tapped = false;
  }
  if (context && context.recordDebug && ability.notes) context.recordDebug(ability.notes);
}

function recordAvoided(player, reason) {
  player.metrics.badActivationsAvoided = (player.metrics.badActivationsAvoided || 0) + 1;
  player.metrics.abilityFailureReasons = player.metrics.abilityFailureReasons || {};
  player.metrics.abilityFailureReasons[reason || 'unknown'] = (player.metrics.abilityFailureReasons[reason || 'unknown'] || 0) + 1;
}

module.exports = { AbilityResolver };
