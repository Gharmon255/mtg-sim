const fs = require('fs');
const path = require('path');

class CardDatabase {
  constructor(options = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'data/cards.starter.json');
    this.extraFilePaths = options.extraFilePaths || [
      path.resolve(process.cwd(), 'data/cards.cache.json'),
      path.resolve(process.cwd(), 'data/cards.precons.json')
    ];
    this.cardsByName = new Map();
  }

  load() {
    this.cardsByName.clear();
    const records = this.readRecords(this.filePath)
      .concat(this.extraFilePaths.flatMap((filePath) => this.readRecords(filePath)));
    for (const record of records) {
      const normalized = CardDatabase.normalizeName(record.name);
      const card = {
        ...record,
        colors: record.colors || [],
        colorIdentity: record.colorIdentity || [],
        legalities: record.legalities || {},
        tags: record.tags || []
      };
      this.setCard(normalized, card);
      for (const alias of record.aliases || []) {
        this.setCard(CardDatabase.normalizeName(alias), card);
      }
    }
    return this;
  }

  setCard(normalizedName, card) {
    const current = this.cardsByName.get(normalizedName);
    if (current && !current.placeholder && card.placeholder) return;
    if (current && current.scryfallId && !card.scryfallId) return;
    this.cardsByName.set(normalizedName, card);
  }

  readRecords(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  }

  static normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  get(name) {
    return this.cardsByName.get(CardDatabase.normalizeName(name)) || null;
  }

  has(name) {
    return Boolean(this.get(name));
  }

  all() {
    return Array.from(this.cardsByName.values());
  }
}

module.exports = { CardDatabase };
