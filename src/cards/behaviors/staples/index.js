const { registerFastMana } = require('./fastMana');
const { registerTutors } = require('./tutors');
const { registerValue } = require('./value');
const { registerInteraction } = require('./interaction');
const { registerProtection } = require('./protection');
const { registerComboWincons } = require('./comboWincons');
const { registerStax } = require('./stax');

function registerStapleBehaviors(registry) {
  registerFastMana(registry);
  registerTutors(registry);
  registerValue(registry);
  registerInteraction(registry);
  registerProtection(registry);
  registerComboWincons(registry);
  registerStax(registry);
  return registry;
}

module.exports = { registerStapleBehaviors };
