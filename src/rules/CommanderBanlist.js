const fs = require('fs');
const path = require('path');

class CommanderBanlist {
  constructor(filePath = path.join(process.cwd(), 'data/commander-banned.json')) {
    this.filePath = filePath;
    this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    this.bannedNames = new Set(this.data.cards.map(normalizeName));
    this.companionOnlyNames = new Set((this.data.companionOnly || []).map(normalizeName));
  }

  check(card) {
    if (!card) return null;
    const normalized = normalizeName(card.name);
    if (this.bannedNames.has(normalized)) {
      return `${card.name} is banned in Commander.`;
    }
    if (this.hasBannedPattern(card)) {
      return `${card.name} matches a category banned in Commander.`;
    }
    return null;
  }

  checkCompanion(card) {
    if (!card) return null;
    if (this.companionOnlyNames.has(normalizeName(card.name))) {
      return `${card.name} is banned as a companion in Commander.`;
    }
    return null;
  }

  hasBannedPattern(card) {
    const typeLine = String(card.typeLine || '');
    const oracleText = String(card.oracleText || '');
    if (/\bConspiracy\b/i.test(typeLine)) return true;
    if (/\bplaying for ante\b|\bante\b/i.test(oracleText)) return true;
    if (/\bsticker\b|\battraction\b/i.test(typeLine) || /\bsticker\b|\battraction\b/i.test(oracleText)) return true;
    return false;
  }
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { CommanderBanlist };
