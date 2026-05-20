const { CardRoleResolver } = require('../cards/CardRoleResolver');

class PlayScorer {
  constructor(options = {}) {
    this.roleResolver = options.roleResolver || new CardRoleResolver(options);
  }

  score(action, context) {
    const { player, gameState } = context;
    const profile = player.strategyProfile || {};
    const card = action.card || {};
    const turn = gameState.turn;
    const tags = new Set(card.tags || []);
    let score = action.base || 0;
    score += (((profile.fixture || {}).actionWeights || {})[action.type] || 0);
    score += this.roleResolver.archetypePriority(card, profile.primaryArchetype, 0) * 0.18;
    if (action.behavior && action.behavior.getCastPriority) {
      score += action.behavior.getCastPriority({
        gameState,
        player,
        card,
        turn,
        archetype: profile.primaryArchetype,
        bracket: profile.estimatedBracket,
        opponents: gameState.opponentsOf(player)
      });
    }

    score += manaCurveBonus(card, turn);
    score += bracketBonus(profile);
    if (action.type === 'cast_fast_mana') score += profile.comboPriority * 0.25 + profile.rampPriority * 0.35 + earlyBonus(turn, 20);
    if (action.type === 'cast_ramp') score += profile.rampPriority * 0.45 + earlyBonus(turn, 18);
    if (action.type === 'cast_commander') score += commanderScore(profile, player, turn);
    if (action.type === 'cast_draw') score += 15 + (profile.controlPriority + profile.comboPriority) * 0.15;
    if (action.type === 'cast_tutor') score += profile.tutorPriority * 0.75 + profile.comboPriority * 0.3;
    if (action.type === 'cast_combo_piece') score += profile.comboPriority * 0.8 + (hasProtection(player) ? 10 : -6);
    if (action.type === 'cast_protection') score += profile.protectionPriority * 0.6 + (player.commanderPermanentNames.size ? 12 : 0);
    if (action.type === 'cast_removal') score += profile.removalPriority * 0.5 + threatGap(context);
    if (action.type === 'cast_counterspell') score += profile.counterspellPriority * 0.7 + holdUpBonus(profile);
    if (action.type === 'cast_boardwipe') score += profile.boardwipePriority * 0.8 + boardWipeNeed(context);
    if (action.type === 'cast_stax_piece') score += profile.staxPriority * 0.8 + antiComboBonus(context);
    if (action.type === 'cast_creature') score += profile.aggressionLevel * 0.45 + creatureBonus(card);
    if (action.type === 'cast_wincon') score += 35 + profile.aggressionLevel * 0.3 + (turn >= 7 ? 20 : 0);
    if (action.type === 'hold_up_interaction') score += holdUpBonus(profile) + threatGap(context) * 0.3;
    if (action.type === 'setup_graveyard') score += profile.primaryArchetype === 'reanimator' ? 55 : 8;
    if (action.type === 'reanimate_threat') score += profile.primaryArchetype === 'reanimator' ? 70 : 20;
    if (action.type === 'sacrifice_for_value') score += profile.primaryArchetype === 'aristocrats' ? 60 : 10;

    if (tags.has('free-spell')) score += 10;
    if (tags.has('high-impact')) score += 8;
    if (this.roleResolver.shouldHold(card, 'clear-purpose') && !hasClearPurpose(action, context)) score -= 35;
    return Math.round(score);
  }
}

function manaCurveBonus(card, turn) {
  const manaValue = Number(card.manaValue || 0);
  if (turn <= 3 && manaValue <= 2) return 12;
  if (turn <= 5 && manaValue <= 4) return 8;
  if (turn >= 7 && manaValue >= 5) return 10;
  return 0;
}

function bracketBonus(profile) {
  return Math.max(0, (profile.estimatedBracket || 1) - 2) * 2;
}

function earlyBonus(turn, amount) {
  return Math.max(0, amount - turn * 3);
}

function hasProtection(player) {
  return player.hand.some((card) => (card.tags || []).some((tag) => ['counterspell', 'protection', 'free-spell'].includes(tag)));
}

function commanderScore(profile, player, turn) {
  const plan = profile.commanderPlan || {};
  let score = profile.commanderPriority * 0.65 + (turn <= 5 ? 10 : 0);
  if (plan.castTiming === 'early') score += 25;
  if (plan.castTiming === 'after ramp' && player.availableMana < 6) score -= 15;
  if (plan.castTiming === 'with protection' && !hasProtection(player) && turn < 6) score -= 25;
  if (plan.protect && hasProtection(player)) score += 10;
  return score;
}

function hasClearPurpose(action, { player, gameState }) {
  if (action.type !== 'cast_tutor') return true;
  const profile = player.strategyProfile || {};
  if (profile.primaryArchetype === 'combo' && profile.comboPriority >= 60) return true;
  if (gameState.turn >= 5) return true;
  if (profile.primaryArchetype === 'control' && threatGap({ player, gameState }) >= 8) return true;
  return false;
}

function threatGap({ player, gameState }) {
  const highest = gameState.opponentsOf(player).sort((a, b) => b.threatScore - a.threatScore || b.boardScore - a.boardScore)[0];
  if (!highest) return 0;
  return Math.max(0, highest.threatScore + highest.boardScore - player.threatScore - player.boardScore);
}

function boardWipeNeed({ player, gameState }) {
  const opponents = gameState.opponentsOf(player);
  const opponentBoard = opponents.reduce((sum, opponent) => sum + opponent.boardScore, 0);
  return Math.max(0, opponentBoard - player.boardScore * 2);
}

function holdUpBonus(profile) {
  if (profile.primaryArchetype === 'control') return 70;
  if (profile.primaryArchetype === 'combo') return 45;
  if (profile.estimatedBracket >= 4) return 32;
  if (profile.aggressionLevel >= 70) return -15;
  return 5;
}

function antiComboBonus({ gameState, player }) {
  return gameState.opponentsOf(player).some((opponent) => (opponent.strategyProfile || {}).comboPriority >= 70) ? 20 : 0;
}

function creatureBonus(card) {
  const power = Number(card.power || 0);
  return Number.isFinite(power) ? power * 2 : 3;
}

module.exports = { PlayScorer };
