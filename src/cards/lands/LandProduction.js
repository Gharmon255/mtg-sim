const {
  COLORS,
  BASIC_LANDS,
  KNOWN_LANDS,
  FETCH_LANDS,
  knownProduction,
  producedColors,
  entersTapped
} = require('../../rules/ManaProduction');
const { commanderColorIdentity } = require('../../rules/ManaPayment');

const SHOCK_LANDS = new Set([
  'Hallowed Fountain',
  'Watery Grave',
  'Blood Crypt',
  'Stomping Ground',
  'Temple Garden',
  'Godless Shrine',
  'Steam Vents',
  'Overgrown Tomb',
  'Sacred Foundry',
  'Breeding Pool'
]);

const TRIOMES = new Set([
  'Raugrin Triome',
  'Zagoth Triome',
  'Savai Triome',
  'Ketria Triome',
  'Indatha Triome',
  "Xander's Lounge",
  "Raffine's Tower",
  "Ziatora's Proving Ground",
  "Jetmir's Garden",
  "Spara's Headquarters"
]);

const TAP_LANDS = new Set([
  'Path of Ancestry',
  'Fabled Passage',
  'Evolving Wilds',
  'Terramorphic Expanse'
]);

const COLOR_LAND_TYPES = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest'
};

function isLand(card) {
  return (card.tags || []).includes('land') || /land/i.test(card.typeLine || '');
}

function isFetchLand(card) {
  return Boolean(FETCH_LANDS[card && card.name]);
}

function isShockLand(card) {
  return SHOCK_LANDS.has(card && card.name);
}

function isTriome(card) {
  return TRIOMES.has(card && card.name);
}

function landColors(card, player) {
  if (!card) return [];
  const commanderColors = player ? commanderColorIdentity(player) : COLORS;
  const production = knownProduction(card, { commanderColors, commanderOnline: true });
  if (production.colors.length) return production.colors.filter((color) => COLORS.includes(color));
  const produced = producedColors(card);
  if (produced.length) return produced;
  return [];
}

function landColorless(card, player) {
  const commanderColors = player ? commanderColorIdentity(player) : COLORS;
  const production = knownProduction(card, { commanderColors, commanderOnline: true });
  return Number(production.colorless || 0);
}

function fetchColors(card) {
  return FETCH_LANDS[card && card.name] || [];
}

function canFetchLand(fetchLand, target, player) {
  if (!isFetchLand(fetchLand) || !isLand(target)) return false;
  const allowed = new Set(fetchColors(fetchLand));
  const typeLine = String(target.typeLine || '');
  if (['Prismatic Vista', 'Fabled Passage', 'Evolving Wilds', 'Terramorphic Expanse'].includes(fetchLand.name)) {
    return /basic land/i.test(typeLine);
  }
  const basicTypeMatch = Array.from(allowed).some((color) => {
    const landType = COLOR_LAND_TYPES[color];
    return landType && new RegExp(`\\b${landType}\\b`, 'i').test(typeLine);
  });
  if (basicTypeMatch) return true;
  if (typeLine) return false;
  const colors = landColors(target, player);
  if (allowed.size >= COLORS.length && COLORS.every((color) => allowed.has(color))) return colors.length > 0;
  return colors.some((color) => allowed.has(color));
}

function entersTappedNow(card, context = {}) {
  if (!card) return false;
  if (context.forceUntapped) return false;
  if (isTriome(card)) return true;
  if (TAP_LANDS.has(card.name)) return true;
  return entersTapped(card);
}

function shouldShockUntapped(card, context = {}) {
  if (!isShockLand(card)) return false;
  const turn = Number(context.turn || 1);
  const life = Number(context.life || 40);
  const neededNow = Boolean(context.neededNow);
  const bracket = Number(context.bracket || 1);
  return life > 8 && (neededNow || turn <= 3 || bracket >= 4);
}

module.exports = {
  COLORS,
  BASIC_LANDS,
  KNOWN_LANDS,
  FETCH_LANDS,
  SHOCK_LANDS,
  TRIOMES,
  TAP_LANDS,
  COLOR_LAND_TYPES,
  isLand,
  isFetchLand,
  isShockLand,
  isTriome,
  landColors,
  landColorless,
  fetchColors,
  canFetchLand,
  entersTappedNow,
  shouldShockUntapped
};
