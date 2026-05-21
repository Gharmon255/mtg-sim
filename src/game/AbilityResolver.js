const { abilitiesForCard, staticRestrictionsForCard } = require('./ActivatedAbility');
const { RestrictionEngine } = require('./RestrictionEngine');
const { payAbilityCost } = require('./AbilityCost');
const { ACTION_TYPES, WINDOW_TYPES, createInteractionWindow } = require('./InteractionWindow');

class AbilityResolver {
  constructor(options = {}) {
    this.restrictions = options.restrictions || new RestrictionEngine();
    this.interactionEngine = options.interactionEngine || null;
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
    const interactionEngine = context.interactionEngine || this.interactionEngine;
    const gameState = context.gameState || null;
    if (interactionEngine && gameState && shouldOpenActivatedWindow(player, permanent, ability, context)) {
      const stopped = interactionEngine.attemptToStop(gameState, player, createInteractionWindow(player, {
        windowType: WINDOW_TYPES.ACTIVATED_ABILITY,
        actionType: activatedActionType(permanent, ability),
        label: `${permanent.name} ${ability.abilityType} ability`,
        sourceCard: permanent.card || permanent,
        targetPlayer: context.targetPlayer || highestThreatOpponent(gameState, player),
        targetPermanent: context.targetPermanent || permanent,
        impactScore: activatedImpactScore(player, permanent, ability),
        canBeCountered: false,
        canBeRemoved: true,
        canBeProtected: true,
        reason: activatedReason(player, permanent, ability)
      }));
      if (stopped.stopped) {
        gameState.recordDebug && gameState.recordDebug(`${permanent.name} ${ability.abilityType} ability was stopped before costs were paid.`);
        player.metrics.activatedAbilitiesStopped = (player.metrics.activatedAbilitiesStopped || 0) + 1;
        return { success: false, stopped: true, reason: 'ability_stopped', ability, interaction: stopped };
      }
    }
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

function shouldOpenActivatedWindow(player, permanent, ability, context) {
  if (!permanent || !ability) return false;
  if (ability.abilityType === 'untap' && ['Basalt Monolith', 'Grim Monolith', 'Mana Vault'].includes(permanent.name)) {
    return hasComboPartner(player) || Boolean(context.forceInteractionWindow);
  }
  return Boolean(context.forceInteractionWindow);
}

function activatedActionType(permanent, ability) {
  if (ability.abilityType === 'untap' && ['Basalt Monolith', 'Grim Monolith'].includes(permanent.name)) return ACTION_TYPES.COMBO;
  return ACTION_TYPES.HIGH_IMPACT;
}

function activatedImpactScore(player, permanent, ability) {
  if (ability.abilityType === 'untap' && hasComboPartner(player)) return 88;
  return 72;
}

function activatedReason(player, permanent, ability) {
  if (ability.abilityType === 'untap' && hasComboPartner(player)) {
    return `${permanent.name} untap ability may enable a mana combo`;
  }
  return `${permanent.name} ${ability.abilityType} ability may create an important advantage`;
}

function hasComboPartner(player) {
  return (player.battlefield || []).concat(player.hand || [])
    .some((card) => ['Rings of Brighthearth', 'Power Artifact'].includes(card.name));
}

function highestThreatOpponent(gameState, player) {
  if (!gameState || typeof gameState.opponentsOf !== 'function') return null;
  return gameState.opponentsOf(player)
    .sort((a, b) => (b.threatScore || 0) + (b.boardScore || 0) - ((a.threatScore || 0) + (a.boardScore || 0)))[0] || null;
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
