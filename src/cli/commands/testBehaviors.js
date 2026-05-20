const assert = require('assert');
const { createDefaultBehaviorRegistry } = require('../../cards/CardBehavior');
const { TutorResolver } = require('../../ai/TutorResolver');

function testBehaviorsCommand() {
  const engine = createDefaultBehaviorRegistry();
  const tests = [
    ['Sol Ring is prioritized early', () => priority(engine, 'Sol Ring', { turn: 1, archetype: 'ramp' }) >= 80],
    ['Rhystic Study is prioritized early by control decks', () => priority(engine, 'Rhystic Study', { turn: 2, archetype: 'control' }) >= 75],
    ['Dockside Extortionist is held when treasure estimate is low', () => shouldHold(engine, 'Dockside Extortionist', { turn: 2, opponents: [opponent(0)] })],
    ['Dockside Extortionist is released when treasures are available', () => !shouldHold(engine, 'Dockside Extortionist', { turn: 4, opponents: [opponent(24)] })],
    ['Demonic Tutor selects missing combo pieces', () => tutorFindsMissingComboPiece()],
    ['Counterspell has high interaction priority', () => engine.get(card('Counterspell', ['counterspell'])).getInteractionPriority({}) >= 75],
    ['Heroic Intervention is held until a real threat', () => shouldHold(engine, 'Heroic Intervention', { turn: 3, archetype: 'tokens' })],
    ['Craterhoof is held until board is wide', () => shouldHold(engine, 'Craterhoof Behemoth', { turn: 7, boardScore: 4 }) && !shouldHold(engine, 'Craterhoof Behemoth', { turn: 8, boardScore: 24 })],
    ['Torment of Hailfire is cast as a high-mana finisher', () => shouldHold(engine, 'Torment of Hailfire', { mana: 5 }) && !shouldHold(engine, 'Torment of Hailfire', { mana: 12 })],
    ['Rule of Law is prioritized by stax but held by combo', () => priority(engine, 'Rule of Law', { archetype: 'stax', turn: 2 }) > priority(engine, 'Rule of Law', { archetype: 'combo', turn: 2 }) && shouldHold(engine, 'Rule of Law', { archetype: 'combo', turn: 2 })],
    ['Walking Ballista is a wincon with infinite mana signals', () => shouldHold(engine, 'Walking Ballista', { mana: 4 }) && !shouldHold(engine, 'Walking Ballista', { mana: 12, battlefield: ['Basalt Monolith', 'Rings of Brighthearth'] })]
  ];

  console.log('Card Behavior Tests');
  console.log('===================');
  let passed = 0;
  for (const [name, fn] of tests) {
    try {
      assert.strictEqual(Boolean(fn()), true);
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.log(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Passed ${passed}/${tests.length} behavior checks.`);
  return 0;
}

function priority(engine, name, options = {}) {
  const player = fakePlayer(options);
  const behavior = engine.get(card(name, tagsFor(name)));
  return behavior.getCastPriority({
    player,
    card: card(name, tagsFor(name)),
    turn: options.turn || 1,
    opponents: options.opponents || [],
    gameState: { opponentsOf: () => options.opponents || [] }
  });
}

function shouldHold(engine, name, options = {}) {
  const player = fakePlayer(options);
  const behavior = engine.get(card(name, tagsFor(name)));
  return behavior.shouldHold({
    player,
    card: card(name, tagsFor(name)),
    turn: options.turn || 1,
    opponents: options.opponents || [],
    gameState: { opponentsOf: () => options.opponents || [] }
  });
}

function tutorFindsMissingComboPiece() {
  const resolver = new TutorResolver();
  const player = fakePlayer({ archetype: 'combo' });
  player.hand = [card('Demonic Consultation', ['combo-piece'])];
  player.library = [card('Forest', ['land']), card('Thassa\'s Oracle', ['combo-piece', 'wincon']), card('Counterspell', ['counterspell'])];
  player.strategyProfile.comboReport = {
    exactCombos: [{ name: 'Oracle Consultation', cardsRequired: ['Thassa\'s Oracle', 'Demonic Consultation'] }]
  };
  const target = resolver.chooseTarget(player, { turn: 3 }, card('Demonic Tutor', ['tutor']));
  return target && target.card.name === 'Thassa\'s Oracle';
}

function fakePlayer(options = {}) {
  return {
    availableMana: options.mana === undefined ? 3 : options.mana,
    rampMana: 0,
    boardScore: options.boardScore || 0,
    threatScore: 0,
    hand: [],
    battlefield: (options.battlefield || []).map((name) => card(name, tagsFor(name))),
    graveyard: [],
    commandZone: [],
    commanderPermanentNames: new Set(),
    metrics: {},
    strategyProfile: {
      primaryArchetype: options.archetype || 'midrange',
      estimatedBracket: 3,
      comboPriority: options.archetype === 'combo' ? 90 : 30,
      comboReport: { exactCombos: [] }
    }
  };
}

function opponent(boardScore) {
  return { boardScore, battlefield: [], strategyProfile: {}, hand: [], availableMana: 0 };
}

function card(name, tags = []) {
  return { name, manaValue: manaValueFor(name), tags, typeLine: typeLineFor(name), power: '1', toughness: '1' };
}

function tagsFor(name) {
  const lower = String(name).toLowerCase();
  if (lower.includes('ring') || lower.includes('crypt') || lower.includes('vault') || lower.includes('signet')) return ['ramp', 'fast-mana', 'artifact'];
  if (lower.includes('study') || lower.includes('remora')) return ['draw', 'high-impact'];
  if (lower.includes('dockside')) return ['ramp', 'combo-piece', 'creature'];
  if (lower.includes('tutor')) return ['tutor'];
  if (lower.includes('counterspell')) return ['counterspell'];
  if (lower.includes('intervention')) return ['protection'];
  if (lower.includes('craterhoof') || lower.includes('torment') || lower.includes('ballista')) return ['wincon'];
  if (lower.includes('rule of law')) return ['stax'];
  return [];
}

function manaValueFor(name) {
  return {
    'Sol Ring': 1,
    'Rhystic Study': 3,
    'Dockside Extortionist': 2,
    'Demonic Tutor': 2,
    Counterspell: 2,
    'Heroic Intervention': 2,
    'Craterhoof Behemoth': 8,
    'Torment of Hailfire': 2,
    'Rule of Law': 3,
    'Walking Ballista': 0
  }[name] || 2;
}

function typeLineFor(name) {
  if (['Sol Ring', 'Walking Ballista', 'Basalt Monolith', 'Rings of Brighthearth'].includes(name)) return 'Artifact';
  if (['Dockside Extortionist', 'Craterhoof Behemoth'].includes(name)) return 'Creature';
  if (['Rhystic Study', 'Rule of Law'].includes(name)) return 'Enchantment';
  return 'Instant';
}

module.exports = { testBehaviorsCommand };
