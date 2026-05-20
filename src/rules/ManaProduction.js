const { COLORS } = require('./ManaCostParser');

const BASIC_LANDS = {
  Plains: ['W'],
  Island: ['U'],
  Swamp: ['B'],
  Mountain: ['R'],
  Forest: ['G'],
  Wastes: ['C']
};

const KNOWN_LANDS = {
  'Command Tower': ['COMMANDER'],
  'Exotic Orchard': ['ANY'],
  'City of Brass': ['ANY'],
  'Mana Confluence': ['ANY'],
  'Reflecting Pool': ['COMMANDER'],
  'Forbidden Orchard': ['ANY'],
  'Path of Ancestry': ['COMMANDER'],
  'Plaza of Heroes': ['COMMANDER'],
  'Cavern of Souls': ['COMMANDER'],
  'Unclaimed Territory': ['COMMANDER'],
  'Secluded Courtyard': ['COMMANDER'],
  'Ancient Tomb': ['C', 'C'],
  'Gemstone Caverns': ['ANY'],
  'Nykthos, Shrine to Nyx': ['ANY'],
  'Phyrexian Tower': ['B'],
  "Gaea's Cradle": ['G'],
  'Cabal Coffers': ['B'],
  'Urborg, Tomb of Yawgmoth': ['B'],
  'Hallowed Fountain': ['W', 'U'],
  'Watery Grave': ['U', 'B'],
  'Blood Crypt': ['B', 'R'],
  'Stomping Ground': ['R', 'G'],
  'Temple Garden': ['G', 'W'],
  'Godless Shrine': ['W', 'B'],
  'Steam Vents': ['U', 'R'],
  'Overgrown Tomb': ['B', 'G'],
  'Sacred Foundry': ['R', 'W'],
  'Breeding Pool': ['G', 'U'],
  'Tundra': ['W', 'U'],
  'Underground Sea': ['U', 'B'],
  'Badlands': ['B', 'R'],
  'Taiga': ['R', 'G'],
  'Savannah': ['G', 'W'],
  'Scrubland': ['W', 'B'],
  'Volcanic Island': ['U', 'R'],
  'Bayou': ['B', 'G'],
  'Plateau': ['R', 'W'],
  'Tropical Island': ['G', 'U'],
  'Sea of Clouds': ['W', 'U'],
  'Morphic Pool': ['U', 'B'],
  'Luxury Suite': ['B', 'R'],
  'Spire Garden': ['R', 'G'],
  'Bountiful Promenade': ['G', 'W'],
  'Vault of Champions': ['W', 'B'],
  'Training Center': ['U', 'R'],
  'Undergrowth Stadium': ['B', 'G'],
  'Spectator Seating': ['R', 'W'],
  'Rejuvenating Springs': ['G', 'U'],
  'Raugrin Triome': ['U', 'R', 'W'],
  'Zagoth Triome': ['B', 'G', 'U'],
  'Savai Triome': ['R', 'W', 'B'],
  'Ketria Triome': ['G', 'U', 'R'],
  'Indatha Triome': ['W', 'B', 'G'],
  "Xander's Lounge": ['U', 'B', 'R'],
  "Raffine's Tower": ['W', 'U', 'B'],
  "Ziatora's Proving Ground": ['B', 'R', 'G'],
  "Jetmir's Garden": ['R', 'G', 'W'],
  "Spara's Headquarters": ['G', 'W', 'U']
};

const FETCH_LANDS = {
  'Flooded Strand': ['W', 'U'],
  'Polluted Delta': ['U', 'B'],
  'Bloodstained Mire': ['B', 'R'],
  'Wooded Foothills': ['R', 'G'],
  'Windswept Heath': ['G', 'W'],
  'Marsh Flats': ['W', 'B'],
  'Scalding Tarn': ['U', 'R'],
  'Verdant Catacombs': ['B', 'G'],
  'Arid Mesa': ['R', 'W'],
  'Misty Rainforest': ['G', 'U'],
  'Prismatic Vista': COLORS,
  'Fabled Passage': COLORS,
  'Evolving Wilds': COLORS,
  'Terramorphic Expanse': COLORS
};

const MANA_ARTIFACTS = {
  'Sol Ring': { C: 2 },
  'Mana Crypt': { C: 2 },
  'Mana Vault': { C: 3 },
  'Grim Monolith': { C: 3 },
  'Basalt Monolith': { C: 3 },
  'Arcane Signet': { commander: 1 },
  'Fellwar Stone': { any: 1 },
  'Mind Stone': { C: 1 },
  'Thought Vessel': { C: 1 },
  "Commander's Sphere": { commander: 1 },
  'Chromatic Lantern': { any: 1 },
  'Lotus Petal': { any: 1, oneShot: true },
  'Chrome Mox': { commander: 1 },
  'Mox Diamond': { any: 1 },
  'Mox Opal': { any: 1 },
  'Mox Amber': { commander: 1, needsCommander: true },
  "Lion's Eye Diamond": { any: 3, oneShot: true },
  'Jeweled Lotus': { commanderOnly: 3 }
};

const MANA_CREATURES = {
  'Birds of Paradise': { any: 1 },
  'Llanowar Elves': { G: 1 },
  'Elvish Mystic': { G: 1 },
  'Fyndhorn Elves': { G: 1 },
  'Noble Hierarch': { any: 1 },
  'Ignoble Hierarch': { any: 1 },
  'Bloom Tender': { commander: 2 },
  'Faeburrow Elder': { commander: 2 },
  'Deathrite Shaman': { any: 1 }
};

function producedColors(card) {
  const known = knownProduction(card, { commanderColors: COLORS });
  if (known.colors.length) return known.colors.filter((color) => COLORS.includes(color));
  const produced = new Set(card.producedMana || card.produced_mana || []);
  const text = String(card.oracleText || '').toLowerCase();
  const type = String(card.typeLine || '').toLowerCase();

  for (const color of COLORS) {
    if (produced.has(color)) continue;
    if (text.includes(`{${color.toLowerCase()}}`)) produced.add(color);
  }
  if (text.includes('one mana of any color') || text.includes('mana of any color')) {
    for (const color of COLORS) produced.add(color);
  }
  if (type.includes('plains')) produced.add('W');
  if (type.includes('island')) produced.add('U');
  if (type.includes('swamp')) produced.add('B');
  if (type.includes('mountain')) produced.add('R');
  if (type.includes('forest')) produced.add('G');
  return Array.from(produced).filter((color) => COLORS.includes(color));
}

function knownProduction(card, context = {}) {
  const name = String((card && card.name) || '');
  if (card && (card.disabledMana || card.tappedUntilNextTurn)) {
    return { colors: [], colorless: 0, generic: 0, fetch: false, oneShot: false, commanderOnly: 0 };
  }
  const commanderColors = Array.from(context.commanderColors || COLORS);
  const knownLand = KNOWN_LANDS[name] || BASIC_LANDS[name];
  if (knownLand) return colorsFromSpec(knownLand, commanderColors);
  if (FETCH_LANDS[name]) return { colors: FETCH_LANDS[name], colorless: 0, generic: 0, fetch: true };
  const artifact = MANA_ARTIFACTS[name];
  if (artifact) return sourceFromObject(artifact, commanderColors, context);
  const creature = MANA_CREATURES[name];
  if (creature) return sourceFromObject(creature, commanderColors, context);
  return { colors: [], colorless: 0, generic: 0, fetch: false, oneShot: false, commanderOnly: 0 };
}

function colorsFromSpec(spec, commanderColors) {
  const colors = [];
  let colorless = 0;
  for (const item of spec) {
    if (item === 'ANY') colors.push(...COLORS);
    else if (item === 'COMMANDER') colors.push(...commanderColors);
    else if (item === 'C') colorless += 1;
    else colors.push(item);
  }
  return { colors: Array.from(new Set(colors)), colorless, generic: colorless, fetch: false, oneShot: false, commanderOnly: 0 };
}

function sourceFromObject(source, commanderColors, context) {
  const colors = [];
  let colorless = Number(source.C || 0);
  let generic = colorless;
  if (source.any) {
    for (let index = 0; index < source.any; index += 1) colors.push(...COLORS);
    generic += Number(source.any || 0);
  }
  if (source.commander) {
    for (let index = 0; index < source.commander; index += 1) colors.push(...commanderColors);
    generic += Number(source.commander || 0);
  }
  for (const color of COLORS) {
    for (let index = 0; index < Number(source[color] || 0); index += 1) colors.push(color);
    generic += Number(source[color] || 0);
  }
  return {
    colors: Array.from(new Set(colors)),
    colorless,
    generic,
    fetch: false,
    oneShot: Boolean(source.oneShot),
    commanderOnly: Number(source.commanderOnly || 0),
    disabled: source.needsCommander && !(context.commanderOnline || false)
  };
}

function entersTapped(card) {
  const text = String(card.oracleText || '').toLowerCase();
  return text.includes('enters tapped') || text.includes('enters the battlefield tapped');
}

function isManaSource(card, tags = []) {
  const tagSet = new Set(tags);
  const type = String(card.typeLine || '').toLowerCase();
  return tagSet.has('land') || tagSet.has('ramp') || tagSet.has('mana-rock') || tagSet.has('fast-mana') || type.includes('land');
}

module.exports = {
  COLORS,
  BASIC_LANDS,
  KNOWN_LANDS,
  FETCH_LANDS,
  MANA_ARTIFACTS,
  MANA_CREATURES,
  producedColors,
  knownProduction,
  entersTapped,
  isManaSource
};
