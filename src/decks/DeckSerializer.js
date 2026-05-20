function serializeDeck(deck) {
  const lines = [];
  for (const [key, value] of Object.entries(deck.metadata || {})) {
    lines.push(`// ${key.toUpperCase()} ${value}`);
  }
  if (lines.length) lines.push('');
  lines.push('// COMMANDER');
  for (const entry of deck.commanders) lines.push(`${entry.quantity} ${entry.name}`);
  lines.push('');
  lines.push('// DECK');
  for (const entry of deck.mainboard) lines.push(`${entry.quantity} ${entry.name}`);
  lines.push('');
  return lines.join('\n');
}

module.exports = { serializeDeck };
