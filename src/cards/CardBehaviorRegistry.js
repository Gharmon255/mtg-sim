class CardBehaviorRegistry {
  constructor() {
    this.specific = new Map();
  }

  register(cardName, behavior) {
    if (!cardName || !behavior) return this;
    this.specific.set(normalizeName(cardName), behavior);
    return this;
  }

  registerMany(entries = {}) {
    for (const [name, behavior] of Object.entries(entries)) this.register(name, behavior);
    return this;
  }

  getSpecific(cardOrName) {
    const name = typeof cardOrName === 'string' ? cardOrName : cardOrName && cardOrName.name;
    return this.specific.get(normalizeName(name)) || null;
  }

  hasSpecific(cardOrName) {
    return Boolean(this.getSpecific(cardOrName));
  }

  names() {
    return Array.from(this.specific.keys());
  }
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { CardBehaviorRegistry, normalizeName };
