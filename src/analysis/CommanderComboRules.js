const fs = require('fs');
const path = require('path');
const { CardTagger } = require('../cards/CardTagger');

class CommanderComboRules {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.tagger = options.tagger || new CardTagger(options);
    this.rulesPath = options.rulesPath || path.join(process.cwd(), 'data/commander-combo-rules.json');
    this.rules = fs.existsSync(this.rulesPath) ? JSON.parse(fs.readFileSync(this.rulesPath, 'utf8')) : [];
  }

  detect(deck) {
    const findings = [];
    const deckCards = deck.cards.map((entry) => {
      const card = this.cardDatabase.get(entry.name) || { name: entry.name, tags: [] };
      return { entry, card, tags: new Set(this.tagger.tagsFor(card)) };
    });
    const deckNames = new Set(deck.cards.map((entry) => normalizeName(entry.name)));

    for (const commanderEntry of deck.commanders) {
      const commander = this.cardDatabase.get(commanderEntry.name) || { name: commanderEntry.name, oracleText: '', tags: [] };
      const commanderTags = new Set(this.tagger.tagsFor(commander));
      const commanderText = String(commander.oracleText || '').toLowerCase();

      for (const rule of this.rules) {
        if (!matchesCommanderRule(rule, commander, commanderTags, commanderText)) continue;
        for (const check of rule.checks || []) {
          if (!checkMatches(check, deckCards, deckNames)) continue;
          findings.push({
            commander: commanderEntry.name,
            name: check.name,
            result: check.result,
            type: check.type || 'possible-combo',
            confidence: check.confidence || 'low',
            bracketImpact: check.bracketImpact || 1
          });
        }
      }
    }

    return findings;
  }
}

function matchesCommanderRule(rule, commander, tags, text) {
  if (rule.commander && normalizeName(rule.commander) !== normalizeName(commander.name)) return false;
  if (rule.commanderTag && !tags.has(rule.commanderTag)) return false;
  if (rule.commanderTextIncludes && !text.includes(String(rule.commanderTextIncludes).toLowerCase())) return false;
  return Boolean(rule.commander || rule.commanderTag || rule.commanderTextIncludes);
}

function checkMatches(check, cards, names) {
  if (check.requiresAny && !check.requiresAny.some((name) => names.has(normalizeName(name)))) return false;
  if (check.requiresAll && !check.requiresAll.every((name) => names.has(normalizeName(name)))) return false;
  if (check.requiresTags && !check.requiresTags.every((tag) => cards.some((item) => item.tags.has(tag)))) return false;
  return true;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { CommanderComboRules };
