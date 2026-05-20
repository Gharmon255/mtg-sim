const fs = require('fs');
const path = require('path');
const { CardDatabase } = require('./CardDatabase');
const { mapScryfallCard } = require('./ScryfallCardMapper');
const { createPlaceholderCard } = require('../precons/WizardsDecklistFetcher');

class CardHydrator {
  constructor(options = {}) {
    this.root = options.root || process.cwd();
    this.cachePath = options.cachePath || path.join(this.root, 'data/cards.precons.json');
    this.timeoutMs = Number(options.timeoutMs || 10000);
    this.retries = Number(options.retries || 2);
    this.delayMs = Number(options.delayMs || 150);
    this.logger = options.logger || { info() {} };
    this.failures = [];
    this.starterNames = new Set(new CardDatabase({
      filePath: path.join(this.root, 'data/cards.starter.json'),
      extraFilePaths: []
    }).load().all().map((card) => card.name.toLowerCase()));
  }

  async hydrateDeck(deck, options = {}) {
    const existing = this.readCache();
    const recordsByName = new Map(existing.map((record) => [record.name.toLowerCase(), record]));
    const commanderNames = new Set(deck.commanders.map((entry) => entry.name.toLowerCase()));
    const inferredIdentity = inferDeckIdentity(deck, recordsByName, this.starterNames, this.root);
    const summary = {
      lookedUp: 0,
      found: 0,
      fuzzyFound: 0,
      placeholders: 0,
      deferred: 0,
      skippedExisting: 0,
      lookupFailures: [],
      unresolved: []
    };
    const failureStart = this.failures.length;

    for (const entry of deck.cards) {
      const key = entry.name.toLowerCase();
      const existingRecord = recordsByName.get(key);
      if (!options.refreshAll && (this.starterNames.has(key) || (existingRecord && !needsHydration(existingRecord)))) {
        summary.skippedExisting += 1;
        continue;
      }

      summary.lookedUp += 1;
      this.logger.info(`Scryfall lookup ${summary.lookedUp}: ${entry.name}`);
      const failuresBeforeLookup = this.failures.length;
      const lookup = await this.lookupCard(entry.name);
      if (lookup.card) {
        recordsByName.set(entry.name.toLowerCase(), addAlias(lookup.card, entry.name));
        summary.found += 1;
        if (lookup.mode === 'fuzzy') summary.fuzzyFound += 1;
      } else {
        if (this.failures.length > failuresBeforeLookup) {
          summary.deferred += 1;
          summary.unresolved.push(entry.name);
          continue;
        }
        if (existingRecord && !needsHydration(existingRecord)) {
          summary.skippedExisting += 1;
          continue;
        }
        if (this.starterNames.has(key)) {
          summary.skippedExisting += 1;
          continue;
        }
        const placeholder = createPlaceholderCard(entry.name, {
          colorIdentity: inferredIdentity,
          isCommander: commanderNames.has(key)
        });
        recordsByName.set(entry.name.toLowerCase(), placeholder);
        summary.placeholders += 1;
        summary.unresolved.push(entry.name);
      }
      await sleep(this.delayMs);
    }

    this.writeCache(recordsByName);
    summary.lookupFailures = this.failures.slice(failureStart);
    return summary;
  }

  async hydrateAllDecks(decks, options = {}) {
    const aggregate = {
      decks: 0,
      lookedUp: 0,
      found: 0,
      fuzzyFound: 0,
      placeholders: 0,
      deferred: 0,
      skippedExisting: 0,
      lookupFailures: [],
      unresolved: []
    };

    for (const deck of decks) {
      aggregate.decks += 1;
      const summary = await this.hydrateDeck(deck, options);
      aggregate.lookedUp += summary.lookedUp;
      aggregate.found += summary.found;
      aggregate.fuzzyFound += summary.fuzzyFound;
      aggregate.placeholders += summary.placeholders;
      aggregate.deferred += summary.deferred;
      aggregate.skippedExisting += summary.skippedExisting;
      aggregate.lookupFailures = (aggregate.lookupFailures || []).concat(summary.lookupFailures || []);
      aggregate.unresolved.push(...summary.unresolved);
    }

    aggregate.unresolved = Array.from(new Set(aggregate.unresolved)).sort();
    return aggregate;
  }

  async lookupCard(name) {
    const exactName = normalizeLookupName(name);
    const exact = await this.fetchScryfall('exact', exactName);
    if (exact) return { card: exact, mode: 'exact' };

    const alternatives = alternateNames(exactName);
    for (const alternative of alternatives) {
      const exactAlternative = await this.fetchScryfall('exact', alternative);
      if (exactAlternative) return { card: exactAlternative, mode: 'exact' };
    }

    const fuzzy = await this.fetchScryfall('fuzzy', exactName);
    if (fuzzy) return { card: fuzzy, mode: 'fuzzy' };
    return { card: null, mode: 'missing' };
  }

  async fetchScryfall(mode, name) {
    const url = `https://api.scryfall.com/cards/named?${mode}=${encodeURIComponent(name)}`;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await fetchWithTimeout(url, {
          timeoutMs: this.timeoutMs,
          headers: {
            'User-Agent': 'mtg-commander-simulator/0.1',
            Accept: 'application/json'
          }
        });
        if (response.status === 429 && attempt < this.retries) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        if (response.status >= 500 && attempt < this.retries) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        if (!response.ok) {
          this.recordFailure(name, mode, `${response.status} ${response.statusText}`.trim());
          return null;
        }
        return mapScryfallCard(await response.json());
      } catch (error) {
        if (attempt >= this.retries) {
          if (this.logger && typeof this.logger.warn === 'function') {
            this.logger.warn(`Scryfall lookup failed for ${name}: ${error.message}`);
          }
          return null;
        }
        await sleep(250 * (attempt + 1));
      }
    }
    return null;
  }

  recordFailure(name, mode, reason) {
    if (!reason.startsWith('404')) {
      this.failures.push({ name, mode, reason });
      if (this.logger && typeof this.logger.warn === 'function') {
        this.logger.warn(`Scryfall ${mode} lookup failed for ${name}: ${reason}`);
      }
    }
  }

  readCache() {
    if (!fs.existsSync(this.cachePath)) return [];
    return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
  }

  writeCache(recordsByName) {
    const records = Array.from(recordsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(this.cachePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }
}

function addAlias(card, name) {
  const aliases = new Set(card.aliases || []);
  if (card.name !== name) aliases.add(name);
  return aliases.size ? { ...card, aliases: Array.from(aliases).sort() } : card;
}

function needsHydration(record) {
  return Boolean(record.placeholder)
    || !record.oracleText
    || record.oracleText.includes('Generated placeholder')
    || !record.typeLine
    || !record.imageUris;
}

function normalizeLookupName(name) {
  return String(name)
    .replace(/\s+\*[^*]+\*\s*$/g, '')
    .replace(/\s+\([A-Z0-9]{2,}\)\s+[\w.-]+.*$/i, '')
    .trim();
}

function alternateNames(name) {
  const alternatives = [];
  if (name.includes(' / ')) {
    const [front] = name.split(' / ');
    alternatives.push(front.trim());
    alternatives.push(name.replace(' / ', ' // '));
  }
  return alternatives.filter(Boolean);
}

function inferDeckIdentity(deck, recordsByName, starterNames, root) {
  const colors = new Set();
  const starterDb = new CardDatabase({ filePath: path.join(root, 'data/cards.starter.json'), extraFilePaths: [] }).load();
  for (const entry of deck.mainboard) {
    const key = entry.name.toLowerCase();
    const card = recordsByName.get(key) || (starterNames.has(key) ? starterDb.get(entry.name) : null);
    for (const color of (card && card.colorIdentity) || []) colors.add(color);
  }
  if (!colors.size) {
    const basics = { plains: 'W', island: 'U', swamp: 'B', mountain: 'R', forest: 'G' };
    for (const entry of deck.mainboard) {
      const color = basics[entry.name.toLowerCase()];
      if (color) colors.add(color);
    }
  }
  return Array.from(colors).sort();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timed out fetching ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers && response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return 1200 * (attempt + 1);
}

module.exports = { CardHydrator, needsHydration };
