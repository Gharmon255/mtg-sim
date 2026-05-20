const fs = require('fs');
const path = require('path');

class CardRoleRegistry {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(process.cwd(), 'data/card-roles.json');
    this.rolesByName = new Map();
  }

  load() {
    this.rolesByName.clear();
    if (!fs.existsSync(this.filePath)) return this;
    const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    const records = Array.isArray(raw) ? raw : Object.values(raw);
    for (const record of records) {
      if (!record || !record.name) continue;
      this.rolesByName.set(normalizeName(record.name), {
        roles: [],
        timing: [],
        bestUseCases: [],
        avoidUseCases: [],
        priorityByArchetype: {},
        targetPreferences: {},
        holdUntil: [],
        riskLevel: 'medium',
        notes: '',
        ...record
      });
    }
    return this;
  }

  get(cardOrName) {
    const name = typeof cardOrName === 'string' ? cardOrName : cardOrName && cardOrName.name;
    return this.rolesByName.get(normalizeName(name)) || null;
  }

  has(cardOrName) {
    return Boolean(this.get(cardOrName));
  }
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { CardRoleRegistry };
