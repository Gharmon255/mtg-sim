const fs = require('fs');
const path = require('path');
const { serializeDeck } = require('../decks/DeckSerializer');
const { slugify } = require('../precons/PreconCatalog');

const EXCLUDED_SECTIONS = new Set(['sideboard', 'maybeboard', 'considering', 'tokens', 'token', 'acquireboard', 'acquire']);
const COMMANDER_SECTIONS = new Set(['commander', 'commanders']);
const MAIN_SECTIONS = new Set(['mainboard', 'main', 'deck', 'creatures', 'artifacts', 'enchantments', 'instants', 'sorceries', 'planeswalkers', 'battles', 'lands']);

class MoxfieldImporter {
  parseText(text, options = {}) {
    const commanders = [];
    const mainboard = [];
    const categories = {};
    const errors = [];
    let section = 'mainboard';
    let include = true;

    String(text || '').split(/\r?\n/).forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;
      const heading = parseHeading(line);
      if (heading) {
        section = heading;
        include = !EXCLUDED_SECTIONS.has(section) || Boolean(options.includeBoards);
        return;
      }
      if (!include) return;
      const parsed = parseCardLine(line);
      if (!parsed) {
        errors.push(`Line ${index + 1}: expected a Moxfield card line.`);
        return;
      }
      parsed.category = section;
      if (COMMANDER_SECTIONS.has(section)) commanders.push(parsed);
      else if (MAIN_SECTIONS.has(section) || options.includeBoards) mainboard.push(parsed);
      categories[section] = categories[section] || [];
      categories[section].push(parsed);
    });

    if (!commanders.length && mainboard.length) commanders.push(mainboard.shift());

    return {
      name: options.name || 'moxfield-import',
      source: options.source || 'moxfield',
      commanders,
      mainboard,
      cards: commanders.concat(mainboard),
      categories,
      metadata: { importer: 'moxfield' },
      errors,
      totalCards: commanders.concat(mainboard).reduce((sum, entry) => sum + entry.quantity, 0)
    };
  }

  parseFile(filePath, options = {}) {
    return this.parseText(fs.readFileSync(filePath, 'utf8'), {
      name: options.name || path.basename(filePath, path.extname(filePath)),
      source: filePath,
      includeBoards: options.includeBoards
    });
  }

  async importUrl(url, options = {}) {
    const id = extractDeckId(url);
    if (!id) throw new Error('Could not find a Moxfield deck id in the URL.');
    const endpoint = `https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`;
    let response;
    try {
      response = await fetchWithTimeout(endpoint, Number(options.timeoutMs || 10000));
    } catch (error) {
      throw new Error(`Moxfield URL import failed: ${error.message}. Export/copy the decklist from Moxfield and use --input instead.`);
    }
    if (!response.ok) {
      throw new Error(`Moxfield URL import failed with HTTP ${response.status}. Export/copy the decklist from Moxfield and use --input instead.`);
    }
    const json = await response.json();
    return deckFromMoxfieldJson(json, { source: url, includeBoards: options.includeBoards });
  }

  save(deck, outputPath) {
    const filePath = outputPath || path.join(process.cwd(), 'decks', 'imported', `${slugify(deck.name || 'moxfield-import')}.txt`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, serializeDeck(deck), 'utf8');
    return filePath;
  }
}

function parseHeading(line) {
  const cleaned = line.replace(/^\/\//, '').replace(/:$/, '').trim().toLowerCase();
  if (COMMANDER_SECTIONS.has(cleaned)) return 'commander';
  if (EXCLUDED_SECTIONS.has(cleaned)) return cleaned;
  if (MAIN_SECTIONS.has(cleaned)) return cleaned === 'main' ? 'mainboard' : cleaned;
  return null;
}

function parseCardLine(line) {
  const withoutComment = line.replace(/\s+#.*$/, '').replace(/\s+\/\/.*$/, '').trim();
  const match = withoutComment.match(/^(\d+)x?\s+(.+)$/i);
  if (!match) return null;
  const quantity = Number(match[1]);
  let name = cleanCardName(match[2]);
  if (!quantity || !name) return null;
  return { quantity, name };
}

function cleanCardName(value) {
  return String(value || '')
    .replace(/\s+\*[^*]+\*\s*$/g, '')
    .replace(/\s+\[[^\]]+\]\s*$/g, '')
    .replace(/\s+\([A-Z0-9]{2,}\)\s*[\w.-]*.*$/i, '')
    .replace(/\s+\{[^}]+\}\s*$/g, '')
    .replace(/\s+Foil$/i, '')
    .trim();
}

function extractDeckId(url) {
  const text = String(url || '').trim();
  const match = text.match(/moxfield\.com\/decks\/([^/?#]+)/i);
  return match ? match[1] : text.match(/^[A-Za-z0-9_-]{8,}$/) ? text : null;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'mtg-commander-simulator/0.1' }
    });
  } finally {
    clearTimeout(timer);
  }
}

function deckFromMoxfieldJson(json, options = {}) {
  const name = json.name || 'moxfield-import';
  const commanders = boardEntries(json.commanders || json.boards && json.boards.commanders);
  const mainboard = boardEntries(json.mainboard || json.boards && json.boards.mainboard);
  if (options.includeBoards) {
    mainboard.push(...boardEntries(json.sideboard || json.boards && json.boards.sideboard));
    mainboard.push(...boardEntries(json.maybeboard || json.boards && json.boards.maybeboard));
  }
  return {
    name,
    source: options.source || 'moxfield-url',
    commanders,
    mainboard,
    cards: commanders.concat(mainboard),
    categories: {},
    metadata: { importer: 'moxfield', url: options.source || '' },
    errors: commanders.length ? [] : ['No commander section found in Moxfield data.'],
    totalCards: commanders.concat(mainboard).reduce((sum, entry) => sum + entry.quantity, 0)
  };
}

function boardEntries(board) {
  if (!board) return [];
  if (Array.isArray(board)) return board.map(cardEntryFromJson).filter(Boolean);
  const cards = board.cards || board;
  return Object.values(cards).map(cardEntryFromJson).filter(Boolean);
}

function cardEntryFromJson(value) {
  const card = value.card || value;
  const name = card.name || value.name || value.cardName;
  if (!name) return null;
  return {
    quantity: Number(value.quantity || value.qty || 1),
    name: cleanCardName(name)
  };
}

module.exports = { MoxfieldImporter };
