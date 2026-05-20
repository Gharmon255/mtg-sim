const { ManaSource } = require('./ManaSource');
const { parseManaCost, COLORS } = require('../rules/ManaCostParser');
const { MANA_ARTIFACTS, MANA_CREATURES, knownProduction, producedColors } = require('../rules/ManaProduction');

class ManaSourceManager {
  constructor(player) {
    this.player = player;
  }

  availableSources(cardToPay = null, options = {}) {
    return this.allSources(cardToPay, options).filter((source) => source.available);
  }

  allSources(cardToPay = null, options = {}) {
    const sources = [];
    const commanderColors = commanderColorIdentity(this.player);
    const context = {
      commanderColors,
      commanderOnline: this.player.commanderPermanentNames && this.player.commanderPermanentNames.size > 0,
      player: this.player
    };

    for (const permanent of this.player.battlefield || []) {
      if (options.excludePermanentId && permanent.id === options.excludePermanentId) continue;
      const source = sourceFromPermanent(permanent, context, cardToPay, { ...options, player: this.player, commanderOnline: context.commanderOnline });
      if (source) sources.push(source);
    }

    for (let index = 0; index < Number(this.player.rampMana || 0); index += 1) {
      const sourceId = `ramp-${index}`;
      sources.push(new ManaSource({
        sourceId,
        cardName: 'Stored ramp source',
        sourceType: 'special',
        produces: ['C'],
        colorless: 1,
        amount: 1,
        tappedRequired: false,
        priority: 35,
        available: !(this.player.exhaustedRampSources && this.player.exhaustedRampSources.has(sourceId)),
        unavailableReason: this.player.exhaustedRampSources && this.player.exhaustedRampSources.has(sourceId) ? 'exhausted' : null
      }));
    }

    for (let index = 0; index < Number(this.player.treasures || 0); index += 1) {
      sources.push(new ManaSource({
        sourceId: `treasure-legacy-${index}`,
        cardName: 'Treasure',
        sourceType: 'treasure',
        produces: ['any'],
        amount: 1,
        tappedRequired: false,
        sacrificeRequired: true,
        priority: 85
      }));
    }

    return sources;
  }

  canPayCard(card, options = {}) {
    return this.payCard(card, { ...options, simulate: true });
  }

  payCost(manaCost, options = {}) {
    const cost = parseManaCost(manaCost || '');
    const sources = this.allSources(options.card || null, options);
    const payment = choosePayment(sources, cost, { isCommander: Boolean(options.isCommander), life: this.player.life });
    payment.paidCost = manaCost || costToString(cost);
    payment.availableSources = sources.filter((source) => source.available).map((source) => source.cardName);
    payment.unusableSources = sources
      .filter((source) => !source.available)
      .map((source) => ({ cardName: source.cardName, reason: source.unavailableReason }));
    if (!payment.success || options.simulate) return payment;
    this.consumePayment(payment, options.card || { name: 'activated ability' }, options);
    this.player.lastManaPayment = payment;
    return payment;
  }

  payCard(card, options = {}) {
    const cost = options.cost || parseManaCost((card && card.manaCost) || '');
    if ((!card || !card.manaCost) && card) cost.generic = Number(card.manaValue || 0);
    const isCommander = Boolean(options.isCommander || (card && card.isCommander));
    const sources = this.allSources(card, options);
    const payment = choosePayment(sources, cost, { isCommander, life: this.player.life });
    payment.paidCost = (card && card.manaCost) || costToString(cost);
    payment.availableSources = sources.filter((source) => source.available).map((source) => source.cardName);
    payment.unusableSources = sources
      .filter((source) => !source.available)
      .map((source) => ({ cardName: source.cardName, reason: source.unavailableReason }));

    if (!payment.success || options.simulate) return payment;
    this.consumePayment(payment, card, options);
    this.player.lastManaPayment = payment;
    return payment;
  }

  consumePayment(payment, card, options = {}) {
    for (const source of payment.sources) consumeSource(this.player, source, payment.allocations.get(source.sourceId) || []);
    const metrics = this.player.metrics;
    metrics.manaSourcesTapped = (metrics.manaSourcesTapped || 0) + payment.sources.filter((source) => source.tappedRequired).length;
    metrics.manaAbilitiesActivated = (metrics.manaAbilitiesActivated || 0) + payment.sources.length;
    metrics.activatedAbilitiesUsed = (metrics.activatedAbilitiesUsed || 0) + payment.sources.length;
    metrics.oneShotSourcesUsed = (metrics.oneShotSourcesUsed || 0) + payment.sources.filter((source) => source.sourceType === 'one-shot').length;
    metrics.dorkManaActivations = (metrics.dorkManaActivations || 0) + payment.sources.filter((source) => source.sourceType === 'dork').length;
    if (payment.sources.some((source) => source.sourceType === 'treasure' && payment.notes.some((note) => /colored/i.test(note)))) {
      metrics.treasureFixingEvents = (metrics.treasureFixingEvents || 0) + 1;
    }
    if (payment.sources.some((source) => source.sourceType === 'treasure')) {
      metrics.treasureTempoEvents = (metrics.treasureTempoEvents || 0) + 1;
    }
    this.player.refreshManaPool({ skipSourceRefresh: true });
  }
}

function sourceFromPermanent(permanent, context, cardToPay, options) {
  if (!permanent || permanent.sacrificed) return null;
  const card = permanent.card || permanent;
  const type = String(permanent.typeLine || card.typeLine || '').toLowerCase();
  const tags = new Set(permanent.tags || card.tags || []);
  const production = productionForCard(permanent, context);
  const isTreasure = permanent.tokenType === 'Treasure' || tags.has('treasure');
  const isDork = type.includes('creature') && (MANA_CREATURES[permanent.name] || tags.has('ramp'));
  const isRock = type.includes('artifact') && (MANA_ARTIFACTS[permanent.name] || tags.has('mana-rock') || tags.has('fast-mana') || tags.has('ramp'));
  const isLand = type.includes('land') || tags.has('land');
  if (!isTreasure && !isDork && !isRock && !isLand && !production.colors.length && !production.colorless && !production.commanderOnly) return null;

  const sourceType = isTreasure ? 'treasure' : isLand ? 'land' : isDork ? 'dork' : oneShotNames().has(permanent.name) ? 'one-shot' : isRock ? 'rock' : 'special';
  const source = new ManaSource({
    sourceId: permanent.id || permanent.cardName || permanent.name,
    cardName: permanent.name,
    sourceType,
    produces: production.commanderOnly ? context.commanderColors : sourceProduces(production),
    colorless: Number(production.colorless || 0),
    amount: Math.max(1, Number(production.generic || production.colorless || production.commanderOnly || 1)),
    tappedRequired: sourceType !== 'special',
    sacrificeRequired: sourceType === 'treasure' || Boolean(production.oneShot) || oneShotNames().has(permanent.name),
    summoningSicknessApplies: sourceType === 'dork',
    usableFor: production.commanderOnly ? 'commander' : 'any',
    priority: sourcePriority(sourceType, permanent, production),
    permanent,
    notes: production.commanderOnly ? ['commander-only'] : []
  });
  source.requiresCreatureSacrifice = Boolean(production.requiresCreatureSacrifice);

  if (production.disabled) {
    source.available = false;
    source.unavailableReason = 'condition not met';
  }
  const unavailable = unavailableReason(source, permanent, cardToPay, options);
  if (unavailable) {
    source.available = false;
    source.unavailableReason = unavailable;
  }
  return source;
}

function productionForCard(card, context = {}) {
  const dynamic = dynamicProduction(card, context);
  if (dynamic) return dynamic;
  const known = knownProduction(card, context);
  if (known.colors.length || known.colorless || known.generic || known.fetch || known.commanderOnly) return known;
  const colors = producedColors(card);
  if (colors.length) return { colors, colorless: 0, generic: 1, fetch: false };
  return { colors: [], colorless: 0, generic: 0, fetch: false };
}

function dynamicProduction(card, context = {}) {
  const name = String((card && card.name) || '');
  const player = context.player;
  if (!player) return null;
  if (name === 'Gaea\'s Cradle') {
    const count = (player.battlefield || []).filter((permanent) => /creature/i.test(permanent.typeLine || '') && !permanent.sacrificed).length;
    return { colors: ['G'], colorless: 0, generic: Math.max(0, count), fetch: false };
  }
  if (name === 'Nykthos, Shrine to Nyx') {
    const devotion = estimateDevotion(player);
    return { colors: commanderColorIdentity(player), colorless: 0, generic: Math.max(1, devotion), fetch: false };
  }
  if (name === 'Cabal Coffers') {
    const swampCount = (player.battlefield || []).filter((permanent) => /swamp/i.test(permanent.typeLine || '') || permanent.name === 'Urborg, Tomb of Yawgmoth').length;
    return { colors: ['B'], colorless: 0, generic: Math.max(1, swampCount), fetch: false };
  }
  if (name === 'Phyrexian Tower') {
    const creature = (player.battlefield || []).find((permanent) => permanent !== card && /creature/i.test(permanent.typeLine || '') && !permanent.sacrificed);
    if (creature) return { colors: ['B'], colorless: 0, generic: 2, fetch: false, requiresCreatureSacrifice: true };
  }
  if (name === 'Chrome Mox' && card.metadata && card.metadata.imprintedColor) {
    return { colors: [card.metadata.imprintedColor], colorless: 0, generic: 1, fetch: false };
  }
  return null;
}

function commanderColorIdentity(player) {
  const colors = new Set();
  for (const commander of player.commandZone || []) {
    for (const color of commander.colorIdentity || commander.colors || []) colors.add(color);
  }
  if (!colors.size && player.deck) {
    for (const entry of player.deck.commanders || []) {
      const card = player.cardDatabase && player.cardDatabase.get(entry.name);
      for (const color of (card && (card.colorIdentity || card.colors)) || []) colors.add(color);
    }
  }
  return Array.from(colors).filter((color) => COLORS.includes(color));
}

function sourceProduces(production) {
  if (production.colors && production.colors.length) return production.colors;
  if (production.colorless) return ['C'];
  return [];
}

function unavailableReason(source, permanent, cardToPay, options) {
  if (permanent.tapped) return 'tapped';
  if (permanent.exhausted) return 'exhausted';
  if (permanent.tappedUntilNextTurn) return 'enters tapped this turn';
  if (source.summoningSicknessApplies && permanent.summoningSick) return 'summoning sickness';
  if (source.usableFor === 'commander' && !(options.isCommander || (cardToPay && cardToPay.isCommander))) return 'commander-only';
  if (source.cardName === 'Mox Amber' && !(permanent.controllerHasLegendary || (options.commanderOnline || false))) return 'needs legendary/commander';
  if (source.cardName === 'Mox Opal' && artifactCount(permanent, options) < 3) return 'needs metalcraft';
  if (source.cardName === 'Chrome Mox' && !(permanent.metadata && permanent.metadata.imprintedColor)) return 'requires imprint';
  if (source.cardName === 'Mox Diamond' && !(permanent.metadata && permanent.metadata.discardedLand)) return 'requires discarded land';
  if (source.cardName === "Lion's Eye Diamond" && !canUseLed(options.player, options)) return 'hand too valuable';
  return null;
}

function artifactCount(permanent, options = {}) {
  const player = options.player;
  const battlefield = player ? player.battlefield || [] : [];
  if (!battlefield.length) return 3;
  return battlefield.filter((item) => /artifact/i.test(item.typeLine || '') && !item.sacrificed).length;
}

function choosePayment(sources, cost, context = {}) {
  const available = sources.filter((source) => source.available);
  const allocations = new Map();
  const used = new Set();
  const notes = [];
  const colorsPaid = { generic: 0, C: 0, W: 0, U: 0, B: 0, R: 0, G: 0 };
  context.allocations = allocations;

  for (const color of COLORS) {
    for (let count = 0; count < Number(cost[color] || 0); count += 1) {
      const source = chooseColorSource(available, used, color, context);
      if (!source) return fail(`Not enough ${color} sources`, color, available, sources);
      useSource(source, used, allocations, color);
      colorsPaid[color] += 1;
      if (source.sourceType === 'treasure') notes.push(`Treasure fixed colored mana for ${color}.`);
    }
  }

  for (let count = 0; count < Number(cost.C || 0); count += 1) {
    const source = chooseColorlessSource(available, used, context);
    if (!source) return fail('Not enough true colorless sources', 'C', available, sources);
    useSource(source, used, allocations, 'C');
    colorsPaid.C += 1;
  }

  let generic = Number(cost.generic || 0) + Number(cost.X || 0);
  while (generic > 0) {
    const source = chooseGenericSource(available, used, context);
    if (!source) return fail('Not enough untapped mana sources', 'generic', available, sources);
    const amount = Math.min(generic, remainingCapacity(source, allocations), source.colorless || source.amount || 1);
    useSource(source, used, allocations, 'generic', amount);
    colorsPaid.generic += amount;
    generic -= amount;
  }

  const selected = Array.from(used).map((id) => available.find((source) => source.sourceId === id)).filter(Boolean);
  return {
    success: true,
    sources: selected,
    sourcesUsed: selected.map((source) => source.cardName),
    colorsPaid,
    allocations,
    remainingFloating: {},
    notes
  };
}

function chooseColorSource(sources, used, color, context) {
  return sources
    .filter((source) => remainingCapacity(source, context.allocations) > 0 && source.canProduceColor(color) && usableForContext(source, context))
    .sort((a, b) => colorSourceScore(a, color, context) - colorSourceScore(b, color, context))[0] || null;
}

function chooseColorlessSource(sources, used, context) {
  return sources
    .filter((source) => remainingCapacity(source, context.allocations) > 0 && source.canProduceColor('C') && usableForContext(source, context))
    .sort((a, b) => genericSourceScore(a, context) - genericSourceScore(b, context))[0] || null;
}

function chooseGenericSource(sources, used, context) {
  return sources
    .filter((source) => remainingCapacity(source, context.allocations) > 0 && source.canPayGeneric() && usableForContext(source, context))
    .sort((a, b) => genericSourceScore(a, context) - genericSourceScore(b, context))[0] || null;
}

function usableForContext(source, context) {
  return source.usableFor !== 'commander' || context.isCommander;
}

function colorSourceScore(source, color, context) {
  let score = source.priority;
  const exact = source.produces.length === 1 && source.produces[0] === color;
  if (exact) score -= 20;
  if (source.produces.includes('any') || source.produces.length >= 3) score += 16;
  if (source.sourceType === 'treasure') score += 25;
  if (source.sacrificeRequired) score += 12;
  return score;
}

function genericSourceScore(source, context) {
  let score = source.priority;
  if (source.colorless || source.produces.includes('C')) score -= 30;
  if (source.sourceType === 'land' && source.produces.length === 1) score += 4;
  if (source.produces.includes('any') || source.produces.length >= 2) score += 25;
  if (source.sourceType === 'treasure') score += 35;
  if (source.sacrificeRequired) score += 18;
  if (source.cardName === 'Ancient Tomb' && context.life <= 6) score += 80;
  return score;
}

function useSource(source, used, allocations, symbol, amount = 1) {
  used.add(source.sourceId);
  const current = allocations.get(source.sourceId) || [];
  current.push({ symbol, amount });
  allocations.set(source.sourceId, current);
}

function remainingCapacity(source, allocations = new Map()) {
  const used = (allocations.get(source.sourceId) || []).reduce((sum, entry) => sum + Number(entry.amount || 1), 0);
  return Math.max(0, Number(source.amount || source.colorless || 1) - used);
}

function fail(reason, symbol, available, allSources) {
  return {
    success: false,
    reason,
    missing: { [symbol]: 1 },
    sources: [],
    sourcesUsed: [],
    colorsPaid: {},
    allocations: new Map(),
    availableSources: available.map((source) => source.cardName),
    unusableSources: allSources.filter((source) => !source.available).map((source) => ({ cardName: source.cardName, reason: source.unavailableReason })),
    notes: []
  };
}

function consumeSource(player, source, allocation) {
  const permanent = source.permanent;
  if (source.sourceType === 'treasure') player.metrics.treasuresUsed = (player.metrics.treasuresUsed || 0) + 1;
  if (source.cardName === "Lion's Eye Diamond") {
    const discarded = player.hand.splice(0, player.hand.length);
    player.graveyard.push(...discarded);
    player.metrics.ledActivations = (player.metrics.ledActivations || 0) + 1;
    player.metrics.discardCostsPaid = (player.metrics.discardCostsPaid || 0) + discarded.length;
  }
  if (source.cardName === 'Phyrexian Tower' && source.requiresCreatureSacrifice) {
    const victim = (player.battlefield || []).find((item) => item !== permanent && /creature/i.test(item.typeLine || '') && !item.sacrificed);
    if (victim && player.zoneManager) {
      player.zoneManager.movePermanentToGraveyard(victim);
      player.metrics.sacrificeActions = (player.metrics.sacrificeActions || 0) + 1;
    }
  }
  if (source.sacrificeRequired) {
    if (permanent && player.zoneManager) player.zoneManager.movePermanentToGraveyard(permanent);
    else if (source.sourceId.startsWith('treasure-legacy')) player.treasures = Math.max(0, (player.treasures || 0) - 1);
    return;
  }
  if (source.sourceId && source.sourceId.startsWith('ramp-')) {
    player.exhaustedRampSources = player.exhaustedRampSources || new Set();
    player.exhaustedRampSources.add(source.sourceId);
    return;
  }
  if (permanent && source.tappedRequired) permanent.tapped = true;
  if (source.cardName === 'Ancient Tomb') {
    player.life -= 2;
    player.metrics.ancientTombDamage = (player.metrics.ancientTombDamage || 0) + 2;
    player.metrics.lifePaidToAncientTomb = (player.metrics.lifePaidToAncientTomb || 0) + 2;
  }
  if (!permanent) source.exhausted = true;
  if (permanent && !source.tappedRequired) permanent.exhausted = true;
}

function canUseLed(player, options = {}) {
  if (!player) return false;
  const archetype = (player.strategyProfile || {}).primaryArchetype;
  const hasBreach = player.hand.concat(player.battlefield, player.graveyard)
    .some((card) => String(card.name || '').toLowerCase() === 'underworld breach');
  const handValue = (player.hand || []).filter((card) => !(card.tags || []).includes('land')).length;
  const allowed = options.comboActive || archetype === 'combo' && (hasBreach || handValue <= 2);
  if (!allowed) player.metrics.badLedActivationsAvoided = (player.metrics.badLedActivationsAvoided || 0) + 1;
  return allowed;
}

function estimateDevotion(player) {
  const colors = commanderColorIdentity(player);
  const primary = colors[0] || 'G';
  return (player.battlefield || []).reduce((sum, permanent) => {
    const cost = String(permanent.manaCost || '');
    return sum + (cost.match(new RegExp(`\\{${primary}\\}`, 'g')) || []).length;
  }, 0);
}

function costToString(cost) {
  const pieces = [];
  if (cost.generic) pieces.push(`{${cost.generic}}`);
  for (const color of COLORS) for (let i = 0; i < cost[color]; i += 1) pieces.push(`{${color}}`);
  for (let i = 0; i < cost.C; i += 1) pieces.push('{C}');
  return pieces.join('');
}

function sourcePriority(sourceType, permanent, production) {
  if (sourceType === 'rock' && production.colorless) return 10;
  if (sourceType === 'land' && production.colorless) return 14;
  if (sourceType === 'land') return 35;
  if (sourceType === 'rock') return 32;
  if (sourceType === 'dork') return 45;
  if (sourceType === 'treasure') return 80;
  if (sourceType === 'one-shot') return 82;
  return 50;
}

function oneShotNames() {
  return new Set(['Lotus Petal', "Lion's Eye Diamond", 'Jeweled Lotus']);
}

module.exports = { ManaSourceManager, choosePayment };
