const { parseManaCost, COLORS } = require('../../rules/ManaCostParser');
const { commanderColorIdentity } = require('../../rules/ManaPayment');
const {
  isLand,
  isFetchLand,
  isShockLand,
  landColors,
  landColorless,
  canFetchLand,
  entersTappedNow,
  shouldShockUntapped
} = require('./LandProduction');
const { LandBehaviorRegistry } = require('./LandBehaviorRegistry');

class LandSequencer {
  constructor(options = {}) {
    this.registry = options.registry || new LandBehaviorRegistry();
  }

  chooseLand(player) {
    const lands = player.hand
      .map((card, index) => ({ card, index }))
      .filter((entry) => isLand(entry.card));
    if (!lands.length) return null;

    const context = buildSequencingContext(player);
    const scored = lands
      .map((entry) => this.scoreLand(entry, player, context))
      .sort((a, b) => b.score - a.score);
    return scored[0] || null;
  }

  scoreLand(entry, player, context) {
    const card = entry.card;
    const behavior = this.registry.behaviorFor(card);
    const colors = landColors(card, player);
    const colorless = landColorless(card, player);
    let score = 10;
    const reasons = [];
    if (isChannelLand(card) && shouldHoldChannelLand(card, player, context)) {
      score -= 45;
      reasons.push('held as channel interaction');
    }

    for (const color of colors) {
      if (context.missingColors.has(color)) {
        score += 42;
        reasons.push(`fixes missing ${color}`);
      } else if (context.neededColors.has(color)) {
        score += 18;
      } else if (context.commanderColors.includes(color)) {
        score += 7;
      }
    }

    if (colorless && context.genericPressure > 0) score += Math.min(18, colorless * 8 + context.genericPressure);
    if (colors.length >= 3) score += context.commanderColors.length >= 3 ? 16 : 8;
    if (colors.length >= 2) score += 7;

    const shockUntapped = shouldShockUntapped(card, {
      turn: player.turnCount,
      life: player.life,
      bracket: context.bracket,
      neededNow: colors.some((color) => context.missingColors.has(color) || context.earlyNeededColors.has(color))
    });
    const tapped = entersTappedNow(card, { forceUntapped: shockUntapped, turn: player.turnCount, bracket: context.bracket });
    if (tapped && player.turnCount <= 3) {
      score -= context.bracket >= 4 ? 22 : 10;
      reasons.push('enters tapped early');
    } else if (!tapped && player.turnCount <= 3) {
      score += 8;
      reasons.push('untapped early source');
    }

    if (isFetchLand(card)) {
      const fetch = this.bestFetchTarget(card, player, context);
      if (fetch) {
        score += fetch.score + 8;
        reasons.push(`fetches ${fetch.target.name}`);
        return { ...entry, score, behavior, colors, fetchTarget: fetch.target, targetEntersTapped: fetch.entersTapped, shockUntapped: fetch.shockUntapped, reasons };
      }
      score -= 35;
      reasons.push('no useful fetch target');
    }

    return { ...entry, score, behavior, colors, entersTapped: tapped, shockUntapped, reasons };
  }

  bestFetchTarget(fetchLand, player, context) {
    const candidates = player.library
      .filter((card) => isLand(card) && canFetchLand(fetchLand, card, player))
      .map((target) => {
        const colors = landColors(target, player);
        const neededNow = colors.some((color) => context.missingColors.has(color) || context.earlyNeededColors.has(color));
        const shockUntapped = shouldShockUntapped(target, {
          turn: player.turnCount,
          life: player.life,
          bracket: context.bracket,
          neededNow
        });
        const tapped = entersTappedNow(target, { forceUntapped: shockUntapped, turn: player.turnCount, bracket: context.bracket });
        let score = 0;
        for (const color of colors) {
          if (context.missingColors.has(color)) score += 36;
          else if (context.neededColors.has(color)) score += 16;
        }
        if (colors.length >= 2) score += 8;
        if (isShockLand(target) && shockUntapped) score += 9;
        if (tapped && player.turnCount <= 3) score -= context.bracket >= 4 ? 18 : 7;
        return { target, score, entersTapped: tapped, shockUntapped };
      })
      .sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }
}

function buildSequencingContext(player) {
  const commanderColors = commanderColorIdentity(player);
  const neededColors = new Set(commanderColors);
  const earlyNeededColors = new Set();
  let genericPressure = 0;

  for (const card of player.hand) {
    if (isLand(card)) continue;
    const cost = parseManaCost(card.manaCost || '');
    const manaValue = Number(card.manaValue || cost.generic || 0);
    genericPressure += Math.max(0, (cost.generic || 0) - 1);
    for (const color of COLORS) {
      if (cost[color] > 0) {
        neededColors.add(color);
        if (manaValue <= 3) earlyNeededColors.add(color);
      }
    }
  }

  for (const commander of player.commandZone || []) {
    const cost = parseManaCost(commander.manaCost || '');
    for (const color of COLORS) {
      if (cost[color] > 0) neededColors.add(color);
    }
  }

  const existingColors = new Set();
  for (const land of player.battlefield.filter(isLand)) {
    for (const color of landColors(land, player)) existingColors.add(color);
  }
  const missingColors = new Set(Array.from(earlyNeededColors).filter((color) => !existingColors.has(color)));

  return {
    commanderColors,
    neededColors,
    earlyNeededColors,
    missingColors,
    genericPressure,
    bracket: Number((player.strategyProfile || {}).estimatedBracket || 1)
  };
}

function isChannelLand(card) {
  return [
    'Boseiju, Who Endures',
    'Otawara, Soaring City',
    'Takenuma, Abandoned Mire',
    'Sokenzan, Crucible of Defiance',
    'Eiganjo, Seat of the Empire'
  ].includes(card.name);
}

function shouldHoldChannelLand(card, player, context) {
  const existingLands = (player.battlefield || []).filter(isLand).length;
  if (existingLands < 2) return false;
  if (context.missingColors.size > 0 && landColors(card, player).some((color) => context.missingColors.has(color))) return false;
  const profile = player.strategyProfile || {};
  if (['Boseiju, Who Endures', 'Otawara, Soaring City', 'Eiganjo, Seat of the Empire'].includes(card.name)) return true;
  return profile.primaryArchetype === 'control' || profile.estimatedBracket >= 4;
}

module.exports = { LandSequencer, buildSequencingContext };
