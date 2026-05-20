function analyzeDeckStrategy(deck, cardDatabase) {
  const signals = {
    ramp: 0,
    draw: 0,
    removal: 0,
    creatures: 0,
    tokens: 0,
    graveyard: 0,
    artifacts: 0,
    spellslinger: 0,
    sacrifice: 0,
    counters: 0,
    protection: 0,
    equipment: 0,
    lifegain: 0,
    bigMana: 0
  };
  const comboHints = [];

  for (const entry of deck.cards) {
    const card = cardDatabase.get(entry.name);
    const name = entry.name.toLowerCase();
    const text = String((card && card.oracleText) || '').toLowerCase();
    const type = String((card && card.typeLine) || '').toLowerCase();
    const tags = new Set((card && card.tags) || []);
    const isLand = tags.has('land') || type.includes('land');
    const quantity = entry.quantity;

    if (!isLand && tags.has('ramp')) signals.ramp += quantity;
    if (tags.has('draw')) signals.draw += quantity;
    if (tags.has('removal') || tags.has('counterspell') || tags.has('boardwipe')) signals.removal += quantity;
    if (tags.has('creature')) signals.creatures += quantity;
    if (type.includes('artifact')) signals.artifacts += quantity;
    if (type.includes('instant') || type.includes('sorcery')) signals.spellslinger += quantity;
    if (text.includes('token') || name.includes('token')) signals.tokens += quantity;
    if (text.includes('graveyard') || text.includes('return target creature') || text.includes('reanimate')) signals.graveyard += quantity;
    if (text.includes('sacrifice') || name.includes('sacrifice')) signals.sacrifice += quantity;
    if (text.includes('+1/+1 counter') || text.includes('proliferate')) signals.counters += quantity;
    if (tags.has('counters')) signals.counters += quantity;
    if (tags.has('protection')) signals.protection += quantity;
    if (type.includes('equipment') || name.includes('boots') || name.includes('sword')) signals.equipment += quantity;
    if (text.includes('gain life') || text.includes('lifelink')) signals.lifegain += quantity;
    if ((card && card.manaValue >= 6) || tags.has('wincon')) signals.bigMana += quantity;
  }

  const archetype = pickArchetype(signals);
  addComboHints(comboHints, deck.cards.map((entry) => entry.name));

  return {
    archetype,
    signals,
    comboHints,
    priorities: priorityFor(archetype)
  };
}

function pickArchetype(signals) {
  const scores = [
    ['graveyard', signals.graveyard * 3 + signals.sacrifice],
    ['spellslinger', signals.spellslinger * 2 + signals.draw + signals.removal],
    ['go-wide tokens', signals.tokens * 4 + signals.creatures],
    ['artifact value', signals.artifacts * 3 + signals.ramp],
    ['counters', signals.counters * 4 + signals.creatures + signals.protection * 2],
    ['equipment combat', signals.equipment * 4 + signals.creatures],
    ['big mana', signals.ramp * 2 + signals.bigMana * 3],
    ['creature combat', signals.creatures * 2 + signals.bigMana]
  ];
  return scores.sort((a, b) => b[1] - a[1])[0][0];
}

function priorityFor(archetype) {
  if (archetype === 'spellslinger') return ['draw', 'removal', 'counterspell', 'ramp', 'wincon', 'creature'];
  if (archetype === 'graveyard') return ['draw', 'creature', 'ramp', 'removal', 'protection', 'wincon', 'counterspell'];
  if (archetype === 'go-wide tokens') return ['ramp', 'creature', 'draw', 'wincon', 'protection', 'removal', 'counterspell'];
  if (archetype === 'artifact value') return ['ramp', 'draw', 'creature', 'protection', 'removal', 'wincon', 'counterspell'];
  if (archetype === 'equipment combat') return ['ramp', 'creature', 'protection', 'draw', 'removal', 'wincon', 'counterspell'];
  if (archetype === 'big mana') return ['ramp', 'draw', 'wincon', 'creature', 'protection', 'removal', 'counterspell'];
  if (archetype === 'counters') return ['ramp', 'creature', 'counters', 'protection', 'draw', 'wincon', 'removal', 'counterspell'];
  return ['ramp', 'creature', 'protection', 'draw', 'removal', 'wincon', 'counterspell'];
}

function addComboHints(comboHints, cardNames) {
  const names = new Set(cardNames.map((name) => name.toLowerCase()));
  const combos = [
    {
      cards: ['Sol Ring', 'Arcane Signet'],
      note: 'Fast mana package: accelerates commander and high-impact plays.'
    },
    {
      cards: ['Sun Titan', 'Reanimate'],
      note: 'Graveyard recursion package: repeated permanent value and recovery.'
    },
    {
      cards: ['Pitiless Plunderer', 'Stitcher\'s Supplier'],
      note: 'Sacrifice/graveyard setup: fuels death triggers and recursion lines.'
    },
    {
      cards: ['Craterhoof Behemoth', 'Avenger of Zendikar'],
      note: 'Go-wide finisher package: token board converts into lethal pressure.'
    },
    {
      cards: ['Counterspell', 'Aetherize'],
      note: 'Control shell: protects game plan with stack and combat interaction.'
    }
  ];

  for (const combo of combos) {
    const present = combo.cards.filter((card) => names.has(card.toLowerCase()));
    if (present.length >= Math.min(2, combo.cards.length)) {
      comboHints.push({ cards: present, note: combo.note });
    }
  }
}

module.exports = { analyzeDeckStrategy };
