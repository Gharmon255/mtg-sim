function normalizeColors(colors) {
  if (!Array.isArray(colors)) return [];
  return colors.map((color) => String(color).toUpperCase()).filter(Boolean).sort();
}

function isSubset(colors, allowedColors) {
  const allowed = new Set(normalizeColors(allowedColors));
  return normalizeColors(colors).every((color) => allowed.has(color));
}

function unionColorIdentity(cards) {
  const identity = new Set();
  for (const card of cards) {
    for (const color of normalizeColors(card.colorIdentity)) {
      identity.add(color);
    }
  }
  return Array.from(identity).sort();
}

function formatColorIdentity(colors) {
  const normalized = normalizeColors(colors);
  return normalized.length ? normalized.join('') : 'Colorless';
}

module.exports = {
  normalizeColors,
  isSubset,
  unionColorIdentity,
  formatColorIdentity
};
