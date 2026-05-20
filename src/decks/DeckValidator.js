const { CommanderRules } = require('../rules/CommanderRules');
const { CommanderBanlist } = require('../rules/CommanderBanlist');
const { isSubset, unionColorIdentity, formatColorIdentity } = require('../rules/ColorIdentity');

class DeckValidator {
  constructor(cardDatabase) {
    this.cardDatabase = cardDatabase;
    this.banlist = new CommanderBanlist();
  }

  validate(deck) {
    const errors = [...deck.errors];
    const warnings = [];

    if (!deck.commanders.length) {
      errors.push('Deck must include a commander.');
    }

    const commanderQuantity = deck.commanders.reduce((sum, entry) => sum + entry.quantity, 0);
    if (commanderQuantity < 1) {
      errors.push('Deck must include at least one commander card.');
    }
    if (commanderQuantity > CommanderRules.maxCommanders) {
      errors.push(`Commander decks may have at most ${CommanderRules.maxCommanders} commander cards in the command zone.`);
    }
    if (deck.commanders.some((entry) => entry.quantity !== 1)) {
      errors.push('Each commander entry must have quantity 1.');
    }

    if (deck.totalCards !== CommanderRules.deckSize) {
      errors.push(`Commander decks must contain ${CommanderRules.deckSize} cards including commander; found ${deck.totalCards}.`);
    }

    const commanderCards = deck.commanders.map((entry) => this.cardDatabase.get(entry.name)).filter(Boolean);
    const commanderIdentity = commanderCards.length
      ? unionColorIdentity(commanderCards)
      : parseColorIdentityOverride(deck.metadata && deck.metadata.color_identity);

    for (const entry of deck.commanders) {
      const card = this.cardDatabase.get(entry.name);
      if (!card) {
        warnings.push(`Commander "${entry.name}" is missing from the local card database.`);
        continue;
      }
      if (!CommanderRules.isAllowedCommander(card)) {
        errors.push(`${entry.name} is not recognized as a legal commander type.`);
      }
      const banMessage = this.banlist.check(card);
      if (banMessage) errors.push(banMessage);
    }

    if (commanderCards.length > 1 && !commanderCards.every((card) => CommanderRules.hasPartnerLikeAbility(card))) {
      errors.push("Multiple commanders require partner, friends forever, choose a Background, Doctor's companion, or another allowed pairing ability.");
    }

    const counts = new Map();
    for (const entry of deck.cards) {
      counts.set(entry.name, (counts.get(entry.name) || 0) + entry.quantity);
      const card = this.cardDatabase.get(entry.name);
      if (!card) {
        warnings.push(`Card "${entry.name}" is missing from the local database; legality checks are incomplete.`);
        continue;
      }
      if (!isSubset(card.colorIdentity, commanderIdentity)) {
        errors.push(`${entry.name} has color identity ${formatColorIdentity(card.colorIdentity)}, outside commander identity ${formatColorIdentity(commanderIdentity)}.`);
      }
      if (card.legalities.commander && card.legalities.commander !== 'legal') {
        errors.push(`${entry.name} is marked ${card.legalities.commander} in Commander.`);
      }
      const banMessage = this.banlist.check(card);
      if (banMessage) errors.push(banMessage);
    }

    for (const [name, count] of counts.entries()) {
      const card = this.cardDatabase.get(name);
      const isBasic = CommanderRules.isBasicLand(card);
      if (count > 1 && !isBasic) {
        errors.push(`${name} appears ${count} times; Commander singleton allows only one copy except basic lands.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      commanderIdentity
    };
  }
}

function parseColorIdentityOverride(value) {
  if (!value) return [];
  return String(value).toUpperCase().split('').filter((color) => ['W', 'U', 'B', 'R', 'G'].includes(color));
}

module.exports = { DeckValidator };
