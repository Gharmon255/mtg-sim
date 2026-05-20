class ActivatedAbility {
  constructor(values = {}) {
    this.id = values.id || `${normalize(values.sourceCardName)}-${values.abilityType || 'ability'}`;
    this.sourceCardName = values.sourceCardName || '';
    this.abilityType = values.abilityType || 'special';
    this.timing = values.timing || 'anytime';
    this.costs = {
      tap: false,
      mana: '',
      sacrificeSelf: false,
      discardCard: false,
      exileCardFromHand: false,
      payLife: 0,
      discardSelf: false,
      other: [],
      ...(values.costs || {})
    };
    this.produces = {
      W: 0,
      U: 0,
      B: 0,
      R: 0,
      G: 0,
      C: 0,
      any: 0,
      generic: 0,
      ...(values.produces || {})
    };
    this.restrictions = values.restrictions || [];
    this.effects = values.effects || [];
    this.oncePerTurn = Boolean(values.oncePerTurn);
    this.notes = values.notes || '';
  }
}

function abilitiesForCard(cardOrName) {
  const name = typeof cardOrName === 'string' ? cardOrName : (cardOrName && cardOrName.name) || '';
  const definitions = CARD_ABILITIES[name] || [];
  return definitions.map((definition, index) => new ActivatedAbility({
    id: `${normalize(name)}-${definition.abilityType || 'ability'}-${index}`,
    sourceCardName: name,
    ...definition
  }));
}

function staticRestrictionsForCard(cardOrName) {
  const name = typeof cardOrName === 'string' ? cardOrName : (cardOrName && cardOrName.name) || '';
  return STATIC_RESTRICTIONS[name] || {};
}

const STATIC_RESTRICTIONS = {
  'Mana Vault': { noNormalUntap: true, upkeepDamageIfTapped: 1, untapCost: '{4}' },
  'Grim Monolith': { noNormalUntap: true, untapCost: '{4}' },
  'Basalt Monolith': { noNormalUntap: true, untapCost: '{3}' }
};

const CARD_ABILITIES = {
  'Mana Vault': [
    {
      abilityType: 'mana',
      costs: { tap: true },
      produces: { C: 3, generic: 3 },
      notes: 'Add three colorless. Does not untap normally.'
    },
    {
      abilityType: 'untap',
      timing: 'upkeep',
      costs: { mana: '{4}' },
      effects: ['untap-self'],
      notes: 'Pay four to untap Mana Vault.'
    }
  ],
  'Grim Monolith': [
    {
      abilityType: 'mana',
      costs: { tap: true },
      produces: { C: 3, generic: 3 },
      notes: 'Add three colorless. Does not untap normally.'
    },
    {
      abilityType: 'untap',
      costs: { mana: '{4}' },
      effects: ['untap-self'],
      notes: 'Pay four to untap Grim Monolith.'
    }
  ],
  'Basalt Monolith': [
    {
      abilityType: 'mana',
      costs: { tap: true },
      produces: { C: 3, generic: 3 },
      notes: 'Add three colorless. Does not untap normally.'
    },
    {
      abilityType: 'untap',
      costs: { mana: '{3}' },
      effects: ['untap-self'],
      notes: 'Pay three to untap Basalt Monolith.'
    }
  ],
  'Lion\'s Eye Diamond': [
    {
      abilityType: 'mana',
      timing: 'anytime',
      costs: { sacrificeSelf: true, discardHand: true },
      produces: { any: 3 },
      restrictions: ['combo-or-empty-hand'],
      notes: 'Sacrifice and discard hand for three mana of one color.'
    }
  ],
  'Lotus Petal': [
    {
      abilityType: 'mana',
      costs: { sacrificeSelf: true },
      produces: { any: 1 },
      notes: 'Sacrifice for one mana of any color.'
    }
  ],
  'Jeweled Lotus': [
    {
      abilityType: 'mana',
      costs: { sacrificeSelf: true },
      produces: { any: 3 },
      restrictions: ['commander-only'],
      notes: 'Spend only to cast your commander.'
    }
  ],
  'Chrome Mox': [
    {
      abilityType: 'mana',
      costs: { tap: true },
      produces: { any: 1 },
      restrictions: ['requires-imprint'],
      notes: 'Produces a color from the imprinted card.'
    }
  ],
  'Mox Diamond': [
    {
      abilityType: 'mana',
      costs: { tap: true },
      produces: { any: 1 },
      restrictions: ['requires-land-discarded'],
      notes: 'Requires a discarded land to stay on the battlefield.'
    }
  ]
};

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = {
  ActivatedAbility,
  abilitiesForCard,
  staticRestrictionsForCard
};
