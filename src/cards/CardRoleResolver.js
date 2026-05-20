const { CardRoleRegistry } = require('./CardRoleRegistry');

class CardRoleResolver {
  constructor(options = {}) {
    this.registry = options.registry || new CardRoleRegistry(options).load();
  }

  roleFor(cardOrName) {
    return this.registry.get(cardOrName);
  }

  rolesFor(cardOrName) {
    const role = this.roleFor(cardOrName);
    return role ? role.roles || [] : [];
  }

  hasRole(cardOrName, roleName) {
    return this.rolesFor(cardOrName).includes(roleName);
  }

  archetypePriority(cardOrName, archetype, fallback = 0) {
    const role = this.roleFor(cardOrName);
    if (!role) return fallback;
    return Number(role.priorityByArchetype && role.priorityByArchetype[archetype]) || fallback;
  }

  targetPreferences(cardOrName, archetype) {
    const role = this.roleFor(cardOrName);
    if (!role) return [];
    return (role.targetPreferences && (role.targetPreferences[archetype] || role.targetPreferences.default)) || [];
  }

  shouldHold(cardOrName, reason) {
    const role = this.roleFor(cardOrName);
    if (!role) return false;
    return (role.holdUntil || []).includes(reason);
  }

  counterPriority(card, attempt, player) {
    const tags = new Set(card.tags || []);
    const profile = player.strategyProfile || {};
    let score = 0;
    if (attempt.kind === 'combo') score += 95;
    if (attempt.kind === 'wincon') score += 88;
    if (attempt.kind === 'boardwipe') score += boardWipeCounterNeed(player);
    if (attempt.kind === 'stax') score += hurtsOurPlan(profile) ? 80 : 55;
    if (attempt.kind === 'high-impact') score += 72;
    if (attempt.kind === 'lethal' || attempt.kind === 'commander-lethal') score += 85;
    if (attempt.kind === 'tutor') score += 62;
    if (attempt.kind === 'draw-engine') score += 58;
    if (attempt.kind === 'low-impact') score -= 30;
    if (tags.has('free-spell')) score += 8;
    score += Math.max(0, (profile.estimatedBracket || 1) - 3) * 5;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  counterThreshold(player, attempt) {
    const profile = player.strategyProfile || {};
    if (attempt.protectingWin || profile.primaryArchetype === 'combo' && attempt.kind === 'combo') return 40;
    if (profile.primaryArchetype === 'control') return 55;
    if ((profile.estimatedBracket || 1) >= 4) return 50;
    if (profile.primaryArchetype === 'aggro') return 75;
    if (profile.primaryArchetype === 'ramp') return 70;
    return 65;
  }

  protectionPriority(card, attempt, player) {
    const profile = player.strategyProfile || {};
    let score = 0;
    if (attempt.kind === 'combo') score += 95;
    if (attempt.kind === 'boardwipe') score += profile.primaryArchetype === 'tokens' || profile.primaryArchetype === 'aggro' ? 82 : 55;
    if (attempt.kind === 'commander-lethal' || attempt.kind === 'lethal') score += 70;
    if (attempt.kind === 'commander-removal') score += profile.commanderPriority || 50;
    if (attempt.kind === 'stax' && profile.primaryArchetype === 'stax') score += 80;
    if ((card.tags || []).includes('free-spell')) score += 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

function boardWipeCounterNeed(player) {
  const profile = player.strategyProfile || {};
  if (player.boardScore >= 12 || ['aggro', 'tokens', 'voltron'].includes(profile.primaryArchetype)) return 86;
  if (profile.primaryArchetype === 'control') return 45;
  return 62;
}

function hurtsOurPlan(profile) {
  return ['combo', 'ramp', 'tokens', 'voltron'].includes(profile.primaryArchetype);
}

module.exports = { CardRoleResolver };
