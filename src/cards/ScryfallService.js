const { mapScryfallCard } = require('./ScryfallCardMapper');

class ScryfallService {
  constructor(options = {}) {
    this.timeoutMs = Number(options.timeoutMs || 10000);
    this.delayMs = Number(options.delayMs || 120);
    this.retries = Number(options.retries || 2);
    this.logger = options.logger || console;
  }

  async fetchCard(name) {
    const exact = await this.fetchNamed('exact', normalizeLookupName(name));
    if (exact) return exact;
    const fuzzy = await this.fetchNamed('fuzzy', normalizeLookupName(name));
    if (fuzzy) return fuzzy;
    return null;
  }

  async fetchNamed(mode, name) {
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
        if (response.status === 404) return null;
        if ((response.status === 429 || response.status >= 500) && attempt < this.retries) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        if (!response.ok) {
          this.warn(`Scryfall ${mode} lookup failed for ${name}: ${response.status} ${response.statusText}`);
          return null;
        }
        return mapScryfallCard(await response.json());
      } catch (error) {
        if (attempt >= this.retries) {
          this.warn(`Scryfall ${mode} lookup failed for ${name}: ${error.message}`);
          return null;
        }
        await sleep(300 * (attempt + 1));
      }
    }
    return null;
  }

  async throttle() {
    await sleep(this.delayMs);
  }

  warn(message) {
    if (this.logger && typeof this.logger.warn === 'function') this.logger.warn(message);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers && response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return 1000 * (attempt + 1);
}

function normalizeLookupName(name) {
  return String(name || '')
    .replace(/\s+\*[^*]+\*\s*$/g, '')
    .replace(/\s+\([A-Z0-9]{2,}\)\s+[\w.-]+.*$/i, '')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { ScryfallService };
