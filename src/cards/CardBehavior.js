const { CardBehaviorEngine } = require('./CardBehaviorEngine');
const { CardBehaviorRegistry } = require('./CardBehaviorRegistry');
const { RampBehavior } = require('./behaviors/RampBehavior');
const { RemovalBehavior } = require('./behaviors/RemovalBehavior');
const { CreatureBehavior } = require('./behaviors/CreatureBehavior');
const { CounterspellBehavior } = require('./behaviors/CounterspellBehavior');
const { registerStapleBehaviors } = require('./behaviors/staples');

function createDefaultBehaviorRegistry() {
  const registry = new CardBehaviorRegistry();
  registerStapleBehaviors(registry);
  registry.register('Lightning Bolt', new RemovalBehavior({ strength: 2, playerDamage: 3 }));
  return new CardBehaviorEngine({ registry });
}

module.exports = {
  CardBehaviorRegistry,
  CardBehaviorEngine,
  createDefaultBehaviorRegistry
};
