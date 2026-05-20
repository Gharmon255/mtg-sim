const { ManaPool } = require('../game/ManaPool');
const { parseManaCost, COLORS } = require('./ManaCostParser');
const { knownProduction, producedColors } = require('./ManaProduction');
const { ManaSourceManager } = require('../game/ManaSourceManager');

function cardCost(card) {
  const parsed = parseManaCost(card && card.manaCost);
  if (!card || !card.manaCost) parsed.generic = Number(card && card.manaValue || 0);
  return parsed;
}

function buildAvailableManaPool(player, options = {}) {
  if (player && player.manaSourceManager && !options.legacyPool) {
    return poolFromSources(player.manaSourceManager.allSources(options.card || null, options));
  }
  const pool = new ManaPool();
  const commanderColors = commanderColorIdentity(player);
  const context = {
    commanderColors,
    commanderOnline: player.commanderPermanentNames && player.commanderPermanentNames.size > 0
  };

  for (const card of player.battlefield || []) {
    const production = productionForCard(card, context);
    if (production.disabled) continue;
    addProduction(pool, production, commanderColors);
  }

  pool.add({ C: Number(player.rampMana || 0) });
  pool.treasures += Number(player.treasures || 0);
  if (options.includeFloating !== false) pool.floating += Number(player.floatingMana || 0);
  return pool;
}

function canPayCard(player, card, options = {}) {
  if ((card.tags || []).includes('free-spell') || options.free) return true;
  if (player.manaSourceManager && !options.legacyPool) {
    return player.manaSourceManager.canPayCard(card, options).success;
  }
  const pool = currentPool(player, options);
  return pool.canPay(cardCost(card));
}

function payCard(player, card, options = {}) {
  player.lastManaPayment = null;
  if ((card.tags || []).includes('free-spell') || options.free) return true;
  if (player.manaSourceManager && !options.legacyPool) {
    const manager = player.manaSourceManager instanceof ManaSourceManager ? player.manaSourceManager : new ManaSourceManager(player);
    player.manaSourceManager = manager;
    const result = manager.payCard(card, options);
    player.metrics.manaPaymentsAttempted = (player.metrics.manaPaymentsAttempted || 0) + 1;
    if (!result.success) {
      recordSourcePaymentFailure(player, card, result);
      return false;
    }
    player.metrics.manaPaymentsSucceeded = (player.metrics.manaPaymentsSucceeded || 0) + 1;
    player.lastManaPayment = result;
    player.manaPool = buildAvailableManaPool(player);
    player.availableMana = player.manaPool.total();
    return true;
  }
  const pool = currentPool(player, options);
  const cost = cardCost(card);
  if (!pool.pay(cost)) {
    recordPaymentFailure(player, card, pool, cost);
    return false;
  }
  player.manaPool = pool;
  player.availableMana = pool.total();
  player.treasures = pool.treasures;
  player.floatingMana = pool.floating;
  return true;
}

function currentPool(player, options = {}) {
  if (options.pool) return options.pool.clone();
  if (player.manaPool) return player.manaPool.clone();
  return buildAvailableManaPool(player, options);
}

function missingColorsForCard(player, card) {
  const pool = buildAvailableManaPool(player);
  return pool.missingColors(cardCost(card));
}

function poolFromSources(sources) {
  const pool = new ManaPool();
  for (const source of sources) {
    if (!source.available) continue;
    if (source.colorless || source.produces.includes('C')) {
      pool.C += Math.max(1, Number(source.colorless || source.amount || 1));
    } else if (source.produces.includes('any') || source.produces.length > 1) {
      pool.flex.push(source.produces.includes('any') ? COLORS : source.produces.filter((color) => COLORS.includes(color)));
    } else if (source.produces.length === 1 && COLORS.includes(source.produces[0])) {
      pool[source.produces[0]] += Number(source.amount || 1);
    }
  }
  return pool;
}

function productionForCard(card, context = {}) {
  const known = knownProduction(card, context);
  if (known.colors.length || known.colorless || known.generic || known.fetch) return known;
  const colors = producedColors(card);
  if (colors.length) return { colors, colorless: 0, generic: 1, fetch: false };
  return { colors: [], colorless: 0, generic: 0, fetch: false };
}

function addProduction(pool, production, commanderColors) {
  if (production.fetch) {
    for (const color of production.colors) if (COLORS.includes(color)) pool[color] += 1;
    return;
  }
  const colors = (production.colors || []).filter((color) => COLORS.includes(color));
  if (colors.length) {
    if (colors.length === 1) pool[colors[0]] += 1;
    else pool.flex.push(colors);
  } else if (production.colorless || production.generic) {
    pool.C += Number(production.colorless || production.generic || 0);
  }
  if (production.commanderOnly) pool.floating += Number(production.commanderOnly || 0);
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

function recordPaymentFailure(player, card, pool, cost) {
  const missing = pool.missingColors(cost);
  if (missing.length) {
    player.metrics.colorStrandedCards = (player.metrics.colorStrandedCards || 0) + 1;
    player.metrics.missingColors = player.metrics.missingColors || {};
    for (const color of missing) player.metrics.missingColors[color] = (player.metrics.missingColors[color] || 0) + 1;
  } else {
    player.metrics.manaStrandedCards = (player.metrics.manaStrandedCards || 0) + 1;
  }
  if (card && card.isCommander) player.metrics.commanderColorFailureTurns = (player.metrics.commanderColorFailureTurns || 0) + 1;
}

function recordSourcePaymentFailure(player, card, result) {
  player.metrics.manaPaymentsFailed = (player.metrics.manaPaymentsFailed || 0) + 1;
  player.metrics.paymentFailureReasons = player.metrics.paymentFailureReasons || {};
  const reason = result.reason || 'unknown';
  player.metrics.paymentFailureReasons[reason] = (player.metrics.paymentFailureReasons[reason] || 0) + 1;
  if ((result.unusableSources || []).some((entry) => entry.reason === 'tapped' || entry.reason === 'exhausted')) {
    player.metrics.cardsStrandedByTappedSources = (player.metrics.cardsStrandedByTappedSources || 0) + 1;
    player.metrics.doubleSpendPreventionEvents = (player.metrics.doubleSpendPreventionEvents || 0) + 1;
  }
  if ((result.unusableSources || []).some((entry) => entry.reason === 'summoning sickness')) {
    player.metrics.dorkUnavailableDueToSummoningSickness = (player.metrics.dorkUnavailableDueToSummoningSickness || 0) + 1;
  }
  if (result.missing) {
    const missingColors = Object.keys(result.missing).filter((key) => COLORS.includes(key));
    if (missingColors.length) {
      player.metrics.colorStrandedCards = (player.metrics.colorStrandedCards || 0) + 1;
      player.metrics.missingColors = player.metrics.missingColors || {};
      for (const color of missingColors) player.metrics.missingColors[color] = (player.metrics.missingColors[color] || 0) + 1;
    } else {
      player.metrics.manaStrandedCards = (player.metrics.manaStrandedCards || 0) + 1;
    }
  }
  if (card && card.isCommander) player.metrics.commanderColorFailureTurns = (player.metrics.commanderColorFailureTurns || 0) + 1;
}

module.exports = {
  cardCost,
  buildAvailableManaPool,
  canPayCard,
  payCard,
  missingColorsForCard,
  commanderColorIdentity,
  productionForCard
};
