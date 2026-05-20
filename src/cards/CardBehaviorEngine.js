const { CardBehaviorRegistry } = require('./CardBehaviorRegistry');
const { CardRoleResolver } = require('./CardRoleResolver');
const { DefaultBehavior } = require('./behaviors/DefaultBehavior');
const { RampBehavior } = require('./behaviors/RampBehavior');
const { DrawBehavior } = require('./behaviors/DrawBehavior');
const { RemovalBehavior } = require('./behaviors/RemovalBehavior');
const { CreatureBehavior } = require('./behaviors/CreatureBehavior');
const { BoardWipeBehavior } = require('./behaviors/BoardWipeBehavior');
const { CounterspellBehavior } = require('./behaviors/CounterspellBehavior');
const { CountersBehavior } = require('./behaviors/CountersBehavior');

class CardBehaviorEngine {
  constructor(options = {}) {
    this.registry = options.registry || new CardBehaviorRegistry();
    const roleOptions = { ...options };
    delete roleOptions.registry;
    this.roleResolver = options.roleResolver || new CardRoleResolver(roleOptions);
    this.defaultBehavior = new DefaultBehavior();
  }

  register(cardName, behavior) {
    this.registry.register(cardName, behavior);
    return this;
  }

  get(card) {
    const specific = this.registry.getSpecific(card);
    if (specific) return withFallback(specific, this.genericFor(card), 'specific');

    const role = this.roleResolver.roleFor(card);
    if (role) return withFallback(new RoleAwareBehavior(role, this.genericFor(card)), this.genericFor(card), 'role');

    return withFallback(this.genericFor(card), this.defaultBehavior, tagSource(card));
  }

  hasSpecific(cardOrName) {
    return this.registry.hasSpecific(cardOrName);
  }

  coverageForCards(cards = []) {
    const totals = {
      totalCards: 0,
      specific: 0,
      role: 0,
      tag: 0,
      generic: 0,
      missing: []
    };

    for (const card of cards) {
      totals.totalCards += 1;
      if (this.registry.hasSpecific(card)) totals.specific += 1;
      else if (this.roleResolver.roleFor(card)) totals.role += 1;
      else if ((card.tags || []).length) totals.tag += 1;
      else {
        totals.generic += 1;
        totals.missing.push(card.name);
      }
    }
    return totals;
  }

  genericFor(card) {
    const tags = new Set((card && card.tags) || []);
    if (tags.has('land')) return this.defaultBehavior;
    if (tags.has('boardwipe')) return new BoardWipeBehavior();
    if (tags.has('counterspell')) return new CounterspellBehavior();
    if (tags.has('removal')) return new RemovalBehavior();
    if (tags.has('draw') || tags.has('card-draw')) return new DrawBehavior();
    if (tags.has('ramp') || tags.has('fast-mana')) return new RampBehavior();
    if (tags.has('counters')) return new CountersBehavior();
    if (tags.has('creature')) return new CreatureBehavior();
    return this.defaultBehavior;
  }
}

class RoleAwareBehavior {
  constructor(role, fallback) {
    this.role = role;
    this.fallback = fallback;
    this.source = 'role';
  }

  canCast(player, card) {
    return this.fallback.canCast(player, card);
  }

  cast(context) {
    return this.fallback.cast(context);
  }

  getCastPriority(context) {
    const archetype = (((context.player || {}).strategyProfile || {}).primaryArchetype) || 'midrange';
    return Number((this.role.priorityByArchetype || {})[archetype]) || 0;
  }

  shouldHold(context) {
    const role = this.role;
    return (role.holdUntil || []).includes('clear-purpose') && !context.hasClearPurpose;
  }

  explainDecision() {
    return this.role.notes || 'role metadata informed this decision';
  }
}

function withFallback(behavior, fallback, source) {
  const wrapped = behavior || fallback;
  wrapped.source = source || wrapped.source || 'generic';
  if (!wrapped.canCast) wrapped.canCast = (player, card) => fallback.canCast(player, card);
  if (!wrapped.cast) wrapped.cast = (context) => fallback.cast(context);
  if (!wrapped.getCastPriority) wrapped.getCastPriority = () => 0;
  if (!wrapped.getTutorPriority) wrapped.getTutorPriority = () => 0;
  if (!wrapped.getInteractionPriority) wrapped.getInteractionPriority = () => 0;
  if (!wrapped.shouldHold) wrapped.shouldHold = () => false;
  if (!wrapped.getTargets) wrapped.getTargets = () => [];
  if (!wrapped.getComboContribution) wrapped.getComboContribution = () => null;
  if (!wrapped.getWinAttempt) wrapped.getWinAttempt = () => null;
  if (!wrapped.explainDecision) wrapped.explainDecision = () => '';
  return wrapped;
}

function tagSource(card) {
  const tags = (card && card.tags) || [];
  return tags.length ? 'tag' : 'generic';
}

module.exports = { CardBehaviorEngine };
