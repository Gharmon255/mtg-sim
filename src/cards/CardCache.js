const fs = require('fs');
const path = require('path');

class CardCache {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(process.cwd(), 'data/cards.cache.json');
    this.recordsByName = new Map();
  }

  load() {
    this.recordsByName.clear();
    if (!fs.existsSync(this.filePath)) return this;
    const records = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    for (const record of records) this.set(record.name, record);
    return this;
  }

  get(name) {
    return this.recordsByName.get(normalizeName(name)) || null;
  }

  has(name) {
    return Boolean(this.get(name));
  }

  set(name, record) {
    const key = normalizeName(name);
    const existing = this.recordsByName.get(key);
    if (existing && !needsRefresh(existing) && record.placeholder) return;
    this.recordsByName.set(key, { ...record, aliases: mergeAliases(existing, record, name) });
  }

  all() {
    return Array.from(this.recordsByName.values());
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const records = this.all().sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(this.filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }
}

function mergeAliases(existing, record, requestedName) {
  const aliases = new Set([...(existing && existing.aliases ? existing.aliases : []), ...(record.aliases || [])]);
  if (record.name && requestedName && normalizeName(record.name) !== normalizeName(requestedName)) aliases.add(requestedName);
  return Array.from(aliases).sort();
}

function needsRefresh(record) {
  return !record || record.placeholder || !record.oracleText || !record.scryfallId;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { CardCache, needsRefresh };
