const { parseManaCost, COLORS } = require('../rules/ManaCostParser');
const { landColors, isLand } = require('../cards/lands/LandProduction');
const { productionForCard, commanderColorIdentity } = require('../rules/ManaPayment');

class MulliganEngine {
  constructor(random) {
    this.random = random;
  }

  drawOpeningHand(player) {
    player.draw(7);
    let landCount = this.countLands(player.hand);
    let assessment = this.assessHand(player, player.hand);

    if (!assessment.keep && player.library.length >= 7) {
      player.metrics.mulligans += 1;
      if (landCount === 0) player.metrics.noLandMulligans += 1;
      if (assessment.reason === 'no-source') player.metrics.noSourceMulligans = (player.metrics.noSourceMulligans || 0) + 1;
      if (assessment.reason === 'color-risk' || assessment.reason === 'no-source') player.metrics.colorScrewMulligans += 1;
      player.library = this.random.shuffle(player.library.concat(player.hand));
      player.hand = [];
      player.draw(7);
      const bottomIndex = this.findWorstBottomCard(player.hand);
      if (bottomIndex >= 0) {
        player.library.push(player.hand.splice(bottomIndex, 1)[0]);
      }
      landCount = this.countLands(player.hand);
      assessment = this.assessHand(player, player.hand);
    }

    if (assessment.risky) player.metrics.riskyKeeps += 1;
    if (assessment.strategyKeep) player.metrics.strategyKeeps += 1;
    if (assessment.fixingKeep) player.metrics.fixingBasedKeeps = (player.metrics.fixingBasedKeeps || 0) + 1;
    if (assessment.fastManaKeep) player.metrics.fastManaKeeps = (player.metrics.fastManaKeeps || 0) + 1;
    player.metrics.openingHandLands = landCount;
  }

  countLands(cards) {
    return cards.filter((card) => (card.tags || []).includes('land')).length;
  }

  findWorstBottomCard(hand) {
    const expensive = hand.findIndex((card) => (card.manaValue || 0) >= 6);
    if (expensive >= 0) return expensive;
    return hand.length - 1;
  }

  assessHand(player, hand) {
    const profile = player.strategyProfile || {};
    const landCount = this.countLands(hand);
    const tags = hand.flatMap((card) => card.tags || []);
    const hasRamp = tags.includes('ramp') || tags.includes('fast-mana');
    const hasFastMana = tags.includes('fast-mana');
    const hasInteraction = tags.includes('counterspell') || tags.includes('removal');
    const hasDraw = tags.includes('draw') || tags.includes('card-draw');
    const hasTutor = tags.includes('tutor');
    const hasCombo = tags.includes('combo-piece') || tags.includes('infinite-combo-piece');
    const hasProtection = tags.includes('protection') || tags.includes('free-spell');
    const cheapPlay = hand.some((card) => !(card.tags || []).includes('land') && (card.manaValue || 0) <= 2);
    const colorProfile = assessOpeningColors(player, hand);

    if (landCount === 0 || landCount >= 6) return { keep: false, reason: landCount === 0 ? 'no-land' : 'flood' };
    if (landCount < 2 && !hasFastMana) return { keep: false, reason: 'low-land' };
    if (colorProfile.noSourcesForCommander && landCount >= 2 && !colorProfile.hasFixing) return { keep: false, reason: 'no-source' };
    if (colorProfile.missingEarlyColors.length >= 2 && !colorProfile.hasFixing && !hasFastMana) return { keep: false, reason: 'color-risk' };

    if (profile.primaryArchetype === 'combo' && landCount >= 1 && (hasFastMana || hasTutor || hasCombo) && (hasProtection || profile.estimatedBracket >= 4)) {
      return { keep: true, strategyKeep: true, risky: landCount < 2 || colorProfile.missingEarlyColors.length > 0, fastManaKeep: hasFastMana };
    }
    if (profile.primaryArchetype === 'control' && landCount >= 2 && (hasInteraction || hasDraw)) return { keep: true, strategyKeep: true };
    if (profile.primaryArchetype === 'aggro' && landCount >= 2 && landCount <= 4 && cheapPlay) return { keep: true, strategyKeep: true };
    if (profile.primaryArchetype === 'ramp' && landCount >= 2 && hasRamp) return { keep: true, strategyKeep: true, fixingKeep: colorProfile.hasFixing };
    if (profile.primaryArchetype === 'voltron' && landCount >= 2 && (hasProtection || cheapPlay)) return { keep: true, strategyKeep: true };

    if (landCount >= 2 && landCount <= 4 && (cheapPlay || hasRamp || hasDraw)) {
      return { keep: true, risky: colorProfile.missingEarlyColors.length > 0, fixingKeep: colorProfile.hasFixing };
    }
    return { keep: landCount >= 2 && landCount <= 5, risky: !cheapPlay && !hasRamp || colorProfile.missingEarlyColors.length > 0 };
  }
}

function assessOpeningColors(player, hand) {
  const needed = new Set();
  const early = new Set();
  const sources = new Set();
  const commanderColors = commanderColorIdentity(player);

  for (const color of commanderColors) needed.add(color);
  for (const card of hand) {
    if (isLand(card)) {
      for (const color of landColors(card, player)) sources.add(color);
      continue;
    }
    const production = productionForCard(card, { commanderColors, commanderOnline: false });
    for (const color of production.colors || []) if (COLORS.includes(color)) sources.add(color);
    const cost = parseManaCost(card.manaCost || '');
    for (const color of COLORS) {
      if (cost[color] > 0) {
        needed.add(color);
        if ((card.manaValue || 0) <= 3) early.add(color);
      }
    }
  }

  const missingEarlyColors = Array.from(early).filter((color) => !sources.has(color));
  const missingCommanderColors = commanderColors.filter((color) => !sources.has(color));
  return {
    needed: Array.from(needed),
    sources: Array.from(sources),
    missingEarlyColors,
    missingCommanderColors,
    noSourcesForCommander: commanderColors.length > 0 && missingCommanderColors.length === commanderColors.length,
    hasFixing: hand.some((card) => isLand(card) && landColors(card, player).length >= Math.min(2, Math.max(1, commanderColors.length)))
      || hand.some((card) => (card.tags || []).includes('fast-mana') || (card.tags || []).includes('mana-rock'))
  };
}

module.exports = { MulliganEngine };
