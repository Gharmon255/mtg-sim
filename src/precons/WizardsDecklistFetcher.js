const fs = require('fs');
const path = require('path');
const { PreconCatalog, slugify } = require('./PreconCatalog');
const { mapScryfallCard } = require('../cards/ScryfallCardMapper');
const { CardDatabase } = require('../cards/CardDatabase');

class WizardsDecklistFetcher {
  constructor(options = {}) {
    this.catalog = options.catalog || new PreconCatalog();
    this.outputDir = options.outputDir || path.join(process.cwd(), 'decks/precons');
    this.cardCachePath = options.cardCachePath || path.join(process.cwd(), 'data/cards.precons.json');
    this.logger = options.logger || console;
    this.fetchTimeoutMs = Number(options.fetchTimeoutMs || 12000);
  }

  async importLatest(options = {}) {
    const catalog = this.catalog.load();
    fs.mkdirSync(this.outputDir, { recursive: true });
    const imported = [];
    const deckLimit = toOptionalNumber(options.deckLimit || options.limit);
    const selectedSources = this.limitSources(catalog.sources, deckLimit);

    this.log(`Importing precons from ${selectedSources.length} source page(s).`);
    for (const source of selectedSources) {
      this.log(`Fetching ${source.setName}: ${source.sourceUrl}`);
      const html = await this.fetchPage(source.sourceUrl);
      const deckBlocks = this.extractDeckBlocks(html);
      const sourceDecks = deckLimit ? source.decks.slice(0, deckLimit - imported.length) : source.decks;

      for (const deckMeta of sourceDecks) {
        const block = deckBlocks.find((deck) => normalizeTitle(deck.title) === normalizeTitle(deckMeta.title));
        if (!block) {
          imported.push({
            title: deckMeta.title,
            setName: source.setName,
            status: 'missing',
            message: `Could not find "${deckMeta.title}" on the source page.`
          });
          continue;
        }

        const fileName = `${slugify(`${source.setName}-${deckMeta.title}`)}.txt`;
        const filePath = path.join(this.outputDir, fileName);
        fs.writeFileSync(filePath, this.toDeckFile(source, deckMeta, block), 'utf8');
        this.log(`Wrote ${fileName} (${block.cards.length} cards).`);
        imported.push({
          title: deckMeta.title,
          setName: source.setName,
          status: 'imported',
          filePath
        });

        if (deckLimit && imported.length >= deckLimit) break;
      }
      if (deckLimit && imported.length >= deckLimit) break;
    }

    if (options.skipCardCache) {
      this.log('Skipping Scryfall card cache update.');
    } else {
      await this.updateCardCache({
        cardLimit: toOptionalNumber(options.cardLimit),
        refreshPlaceholders: Boolean(options.refreshPlaceholders)
      });
    }
    return imported;
  }

  async importFromUrl(url, options = {}) {
    const safeUrl = normalizeWizardsUrl(url);
    fs.mkdirSync(this.outputDir, { recursive: true });
    this.log(`Fetching Wizards article: ${safeUrl}`);
    const html = await this.fetchPage(safeUrl);
    const articleTitle = extractArticleTitle(html) || path.basename(new URL(safeUrl).pathname);
    const deckBlocks = this.extractDeckBlocks(html);
    if (!deckBlocks.length) {
      throw new Error('No deck-list blocks were found on that Wizards article.');
    }

    const deckLimit = toOptionalNumber(options.deckLimit || options.limit);
    const selectedBlocks = deckLimit ? deckBlocks.slice(0, deckLimit) : deckBlocks;
    const imported = [];
    const importedFilePaths = [];

    for (const block of selectedBlocks) {
      const fileName = `${slugify(`${articleTitle}-${block.title}`)}.txt`;
      const filePath = path.join(this.outputDir, fileName);
      fs.writeFileSync(filePath, this.toGenericDeckFile({
        articleTitle,
        sourceUrl: safeUrl,
        block
      }), 'utf8');
      this.log(`Wrote ${fileName} (${block.cards.length} cards).`);
      imported.push({
        title: block.title,
        setName: articleTitle,
        status: 'imported',
        filePath
      });
      importedFilePaths.push(filePath);
    }

    if (options.skipCardCache) {
      this.log('Skipping Scryfall card cache update.');
    } else {
      await this.updateCardCache({
        cardLimit: toOptionalNumber(options.cardLimit),
        refreshPlaceholders: Boolean(options.refreshPlaceholders),
        filePaths: importedFilePaths
      });
    }

    return imported;
  }

  async fetchPage(url) {
    const response = await fetchWithTimeout(url, {
      timeoutMs: this.fetchTimeoutMs
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  extractDeckBlocks(html) {
    const blocks = [];
    const deckRegex = /<deck-list\b([^>]*)>([\s\S]*?)<\/deck-list>/gi;
    let deckMatch;

    while ((deckMatch = deckRegex.exec(html))) {
      const attrs = deckMatch[1];
      const titleMatch = attrs.match(/deck-title="([^"]+)"/i);
      const mainMatch = deckMatch[2].match(/<main-deck>([\s\S]*?)<\/main-deck>/i);
      if (!titleMatch || !mainMatch) continue;
      blocks.push({
        title: decodeHtml(titleMatch[1]),
        cards: mainMatch[1]
          .split(/\r?\n/)
          .map((line) => normalizeDeckLine(line))
          .filter(Boolean)
      });
    }

    return blocks;
  }

  toDeckFile(source, deckMeta, block) {
    const commander = block.cards[0];
    const mainboard = block.cards.slice(1);
    return [
      `// SET ${source.setName}`,
      `// SET_CODE ${source.setCode}`,
      `// RELEASE_DATE ${source.releaseDate}`,
      `// SOURCE_URL ${source.sourceUrl}`,
      `// COLOR_IDENTITY ${deckMeta.colorIdentity.join('')}`,
      '',
      '// COMMANDER',
      commander,
      '',
      '// DECK',
      ...mainboard,
      ''
    ].join('\n');
  }

  toGenericDeckFile({ articleTitle, sourceUrl, block }) {
    const commander = block.cards[0];
    const mainboard = block.cards.slice(1);
    return [
      `// SET ${articleTitle}`,
      `// SOURCE_URL ${sourceUrl}`,
      '',
      '// COMMANDER',
      commander,
      '',
      '// DECK',
      ...mainboard,
      ''
    ].join('\n');
  }

  async updateCardCache(options = {}) {
    const deckFiles = options.filePaths || (fs.existsSync(this.outputDir)
      ? fs.readdirSync(this.outputDir).filter((fileName) => fileName.endsWith('.txt')).map((fileName) => path.join(this.outputDir, fileName))
      : []);
    const names = new Set();
    for (const filePath of deckFiles) {
      const text = fs.readFileSync(filePath, 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) names.add(match[2].trim());
      }
    }

    const starterNames = new Set(new CardDatabase({ extraFilePaths: [] }).load().all().map((card) => card.name.toLowerCase()));
    const existing = readJsonArray(this.cardCachePath).filter((record) => !starterNames.has(record.name.toLowerCase()));
    const recordsByName = new Map(existing.map((record) => [record.name.toLowerCase(), record]));
    const missingNames = Array.from(names).filter((name) => {
      if (starterNames.has(name.toLowerCase())) return false;
      const existingRecord = recordsByName.get(name.toLowerCase());
      return !existingRecord || (options.refreshPlaceholders && existingRecord.placeholder);
    });

    const deckContexts = this.readDeckContexts();
    const namesToFetch = options.cardLimit ? missingNames.slice(0, options.cardLimit) : missingNames;
    const skippedNames = options.cardLimit ? missingNames.slice(options.cardLimit) : [];
    this.log(`Card cache has ${recordsByName.size} records; ${missingNames.length} card(s) need lookup.`);
    if (options.cardLimit) this.log(`Small test mode: looking up only ${namesToFetch.length} card(s).`);

    for (const name of skippedNames) {
      const context = deckContexts.get(name.toLowerCase()) || {};
      recordsByName.set(name.toLowerCase(), createPlaceholderCard(name, context));
    }
    if (skippedNames.length) {
      this.log(`Generated placeholders for ${skippedNames.length} skipped card lookup(s).`);
    }

    for (let index = 0; index < namesToFetch.length; index += 1) {
      const name = namesToFetch[index];
      this.log(`Scryfall ${index + 1}/${namesToFetch.length}: ${name}`);
      const card = await this.fetchScryfallCard(name);
      const context = deckContexts.get(name.toLowerCase()) || {};
      recordsByName.set(name.toLowerCase(), card || createPlaceholderCard(name, context));
      await sleep(80);
    }

    const records = Array.from(recordsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(this.cardCachePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    this.log(`Wrote card cache: ${this.cardCachePath} (${records.length} records).`);
  }

  readDeckContexts() {
    const contexts = new Map();
    if (!fs.existsSync(this.outputDir)) return contexts;

    for (const fileName of fs.readdirSync(this.outputDir).filter((name) => name.endsWith('.txt'))) {
      const text = fs.readFileSync(path.join(this.outputDir, fileName), 'utf8');
      const colorMatch = text.match(/^\/\/ COLOR_IDENTITY\s+([WUBRG]+)/m);
      const colors = colorMatch ? colorMatch[1].split('') : [];
      let inCommander = false;

      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '// COMMANDER') {
          inCommander = true;
          continue;
        }
        if (line === '// DECK') {
          inCommander = false;
          continue;
        }
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) continue;
        contexts.set(match[2].trim().toLowerCase(), {
          colorIdentity: colors,
          isCommander: inCommander
        });
      }
    }

    return contexts;
  }

  async fetchScryfallCard(name) {
    const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
    const response = await fetchWithTimeout(url, {
      timeoutMs: this.fetchTimeoutMs,
      headers: {
        'User-Agent': 'mtg-commander-simulator/0.1',
        Accept: 'application/json'
      }
    });
    if (!response.ok) return null;
    return mapScryfallCard(await response.json());
  }

  limitSources(sources, deckLimit) {
    if (!deckLimit) return sources;
    const selected = [];
    let remaining = deckLimit;
    for (const source of sources) {
      if (remaining <= 0) break;
      selected.push({
        ...source,
        decks: source.decks.slice(0, remaining)
      });
      remaining -= source.decks.length;
    }
    return selected;
  }

  log(message) {
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(message);
    }
  }
}

function normalizeWizardsUrl(url) {
  const parsed = new URL(String(url));
  if (parsed.hostname !== 'magic.wizards.com') {
    throw new Error('Only magic.wizards.com URLs are supported.');
  }
  return parsed.toString();
}

function extractArticleTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanupText(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return cleanupText(title[1]).replace(/\s*\|\s*Magic: The Gathering.*$/i, '');
  return null;
}

function cleanupText(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeDeckLine(line) {
  const withoutTags = decodeHtml(line)
    .replace(/<[^>]+>/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  if (!withoutTags) return '';
  if (/^\d+\s+/.test(withoutTags)) return withoutTags.replace(/\s+/g, ' ');
  return `1 ${withoutTags.replace(/\s+/g, ' ')}`;
}

function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timed out fetching ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === false || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function createPlaceholderCard(name, context = {}) {
  const isLand = looksLikeLand(name);
  const isCommander = Boolean(context.isCommander);
  const isCreature = isCommander || looksLikeCreature(name);
  const colorIdentity = isCommander || isBasicLandName(name) ? (context.colorIdentity || []) : [];
  const tags = new Set();
  if (isLand) tags.add('land');
  if (isCommander) {
    tags.add('commander');
  }
  if (isCreature) tags.add('creature');
  if (looksLikeRamp(name)) tags.add('ramp');
  if (looksLikeDraw(name)) tags.add('draw');
  if (looksLikeRemoval(name)) tags.add('removal');
  if (looksLikeProtection(name)) tags.add('protection');
  if (looksLikeCounters(name)) tags.add('counters');
  if (looksLikeBoardWipe(name)) tags.add('boardwipe');
  if (looksLikeCounterspell(name)) tags.add('counterspell');
  if (looksLikeWincon(name)) tags.add('wincon');

  const manaValue = inferPlaceholderManaValue(name, { isLand, isCommander, isCreature, tags });
  const power = isCreature ? String(Math.max(1, Math.min(7, manaValue))) : null;
  const toughness = isCreature ? String(Math.max(1, Math.min(7, manaValue))) : null;

  return {
    name,
    manaCost: '',
    manaValue,
    colors: isLand ? [] : colorIdentity,
    colorIdentity,
    typeLine: isLand ? 'Land' : isCommander ? 'Legendary Creature' : isCreature ? 'Creature' : 'Unknown',
    oracleText: 'Generated placeholder from imported precon decklist. Replace with exact card data when available.',
    power,
    toughness,
    legalities: { commander: 'legal' },
    imageUris: {
      small: null,
      normal: null,
      artCrop: null
    },
    tags: Array.from(tags),
    placeholder: true
  };
}

function isBasicLandName(name) {
  return ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].includes(name);
}

function looksLikeLand(name) {
  return /\b(tower|passage|expanse|wilds|ancestry|campus|plains|island|swamp|mountain|forest|peak|peaks|hall|sanctuary|field|fields|orchard|snarl|summit|divide|prairie|temple|coliseum|harbor|marsh|copse|crag|stadium|fen|thicket|slough|turf|farm|carnarium|overlook|garden|grove|moor|cityscape|landscape|gate|glade|grove|hollow)\b/i.test(name);
}

function looksLikeCreature(name) {
  return /\b(mentor|master|dame|king|queen|leader|brute|warrior|samurai|monk|yeti|mime|hound|assassin|swordsman|youth|machinist|hunter|plunderer|supplier|jailer|wizard|druid|dragon|hydra|ooze|giant|beast|spirit|goblin|elf|knight|demon|zombie|angel|elemental|pest|mutant|ninja|turtle|shaman|vampire|soldier|cleric|rogue|titan|primordial|gearhulk|golem)\b/i.test(name);
}

function looksLikeRamp(name) {
  return /\b(ramp|cultivate|growth|reach|lantern|signet|sol ring|stone|map|tax|treasure|mana|hierarch|druid|mystic|coin|sphere|talisman|bauble|simulacrum|millikin|plunderer)\b/i.test(name);
}

function looksLikeDraw(name) {
  return /\b(draw|rendezvous|research|insight|ponder|opt|cruise|harmonize|looting|whisper|greed|curiosity|study|welcome|storyteller|analysis|big score|key to the city|opportunist|laughing mad)\b/i.test(name);
}

function looksLikeRemoval(name) {
  return /\b(swords|path|swift demise|assassin|trophy|terminate|grasp|putrefy|naturalize|abrade|shock|bolt|doom|bedevil|mortify|ashes|ultimatum|tragic arrogance|snort|meteor golem|chaos warp|beast within|resculpt|reality shift|wave goodbye|vanquish|fire covenant|tarfire)\b/i.test(name);
}

function looksLikeProtection(name) {
  return /\b(heroic intervention|snakeskin veil|boots|greaves|protection|shield|veil|safekeeping)\b/i.test(name);
}

function looksLikeCounters(name) {
  return /\b(ozolith|hardened scales|branching evolution|doubling season|counter|counters|augmenter|rishkar|bristly|bill|walking ballista)\b/i.test(name);
}

function looksLikeBoardWipe(name) {
  return /\b(wrath|damnation|blasphemous act|chain reaction|wave of reckoning|vanquish the horde|massacre|zenith|aetherize|torrent)\b/i.test(name);
}

function looksLikeCounterspell(name) {
  return /\b(counterspell|negate|denial|cancel)\b/i.test(name);
}

function looksLikeWincon(name) {
  return /\b(overrun|behemoth|hoof|moonshaker|vigor|combo|game over|finale|triumph|surge|storm|mastering|all-powerful|dark realms|ultimatum|warring triad|dancing mad|valigarmanda|airship|archfiend|primordial|gearhulk|titan)\b/i.test(name);
}

function inferPlaceholderManaValue(name, context) {
  if (context.isLand) return 0;
  if (context.isCommander) return 4;
  if (context.tags.has('wincon')) return 6;
  if (context.tags.has('boardwipe')) return 5;
  if (context.tags.has('ramp')) return 2;
  if (context.tags.has('protection')) return 2;
  if (context.tags.has('draw')) return 3;
  if (context.tags.has('removal')) return 2;
  if (context.isCreature) return /titan|primordial|gearhulk|dragon|archfiend|demon|yeti|airship/i.test(name) ? 6 : 3;
  return 3;
}

module.exports = { WizardsDecklistFetcher, createPlaceholderCard };
