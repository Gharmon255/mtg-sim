const { CardRoleResolver } = require('../cards/CardRoleResolver');

class TutorResolver {
  constructor(options = {}) {
    this.roleResolver = options.roleResolver || new CardRoleResolver(options);
  }

  chooseTarget(player, gameState, tutorCard = null) {
    const profile = player.strategyProfile || {};
    const candidates = player.library.filter((card) => !(card.tags || []).includes('land'));
    const scored = candidates.map((card) => ({
      card,
      reason: reasonFor(card, profile, gameState.turn, player, this.roleResolver),
      score: targetScore(card, profile, gameState.turn, player, this.roleResolver, tutorCard)
    })).sort((a, b) => b.score - a.score);
    return scored[0] || null;
  }

  resolveTutor(player, gameState, tutorCard) {
    const choice = this.chooseTarget(player, gameState, tutorCard);
    player.metrics.tutorsUsed = (player.metrics.tutorsUsed || 0) + 1;
    if (!choice) return { target: null, message: `${player.name} casts ${tutorCard.name}, but finds no useful target.` };

    const index = player.library.indexOf(choice.card);
    if (index >= 0) player.library.splice(index, 1);
    player.hand.push(choice.card);
    player.metrics.tutorTargets = player.metrics.tutorTargets || {};
    player.metrics.tutorTargets[choice.card.name] = (player.metrics.tutorTargets[choice.card.name] || 0) + 1;
    player.metrics.tutorReasons = player.metrics.tutorReasons || {};
    player.metrics.tutorReasons[choice.reason] = (player.metrics.tutorReasons[choice.reason] || 0) + 1;
    player.metrics.tutorEfficiencyTotal = (player.metrics.tutorEfficiencyTotal || 0) + Math.min(100, Math.max(20, choice.score));
    player.metrics.highValueTutorTargets = (player.metrics.highValueTutorTargets || 0) + (choice.score >= 70 ? 1 : 0);
    player.metrics.cardSequencingScoreTotal = (player.metrics.cardSequencingScoreTotal || 0) + Math.min(100, Math.max(20, choice.score));
    player.metrics.cardSequencingScoreCount = (player.metrics.cardSequencingScoreCount || 0) + 1;
    return {
      target: choice.card,
      message: `${player.name} tutors ${choice.card.name} with ${tutorCard.name} (${choice.reason}, score ${Math.round(choice.score)}).`
    };
  }
}

function targetScore(card, profile, turn, player, roleResolver, tutorCard) {
  const tags = new Set(card.tags || []);
  const roles = new Set(roleResolver.rolesFor(card));
  const preferences = roleResolver.targetPreferences(tutorCard || 'Demonic Tutor', profile.primaryArchetype);
  let score = 0;
  score += roleResolver.archetypePriority(card, profile.primaryArchetype, 0) * 0.35;
  score += preferenceScore(card, tags, roles, preferences, player, profile);
  score += missingComboPieceScore(card, player, profile);
  if (profile.primaryArchetype === 'combo') {
    if (tags.has('combo-piece') || tags.has('infinite-combo-piece') || roles.has('combo-piece')) score += 90;
    if (tags.has('protection') || tags.has('counterspell')) score += 45;
    if (tags.has('fast-mana')) score += turn <= 3 ? 65 : 20;
  }
  if (profile.primaryArchetype === 'control') {
    if (tags.has('boardwipe')) score += 70;
    if (tags.has('counterspell') || tags.has('removal')) score += 55;
    if (tags.has('wincon') && turn >= 8) score += 45;
  }
  if (profile.primaryArchetype === 'ramp') {
    if (turn <= 4 && tags.has('ramp')) score += 70;
    if (turn >= 5 && tags.has('wincon')) score += 75;
  }
  if (profile.primaryArchetype === 'voltron') {
    if (tags.has('protection') || tags.has('commander-damage')) score += 80;
  }
  if (profile.primaryArchetype === 'tokens') {
    if (tags.has('token-doubler') || tags.has('tokens') || tags.has('wincon')) score += 70;
  }
  if (profile.primaryArchetype === 'aristocrats') {
    if (tags.has('sacrifice-outlet') || tags.has('aristocrats') || tags.has('reanimation')) score += 70;
  }
  if (profile.primaryArchetype === 'reanimator') {
    if (tags.has('reanimation') || tags.has('graveyard-synergy') || tags.has('wincon')) score += 70;
  }
  if (tags.has('high-impact')) score += 15;
  if (tags.has('wincon')) score += 20;
  return score;
}

function reasonFor(card, profile, turn, player, roleResolver) {
  const tags = new Set(card.tags || []);
  const roles = new Set(roleResolver.rolesFor(card));
  if (isMissingComboPiece(card, player, profile)) return 'combo line needs this missing piece';
  if (tags.has('protection') || tags.has('counterspell')) return 'protect the game plan';
  if (tags.has('boardwipe')) return 'reset a stronger board';
  if (tags.has('removal')) return 'answer a threat';
  if (tags.has('ramp') && turn <= 4) return 'accelerate mana development';
  if (roles.has('graveyard-setup')) return 'set up graveyard plan';
  if (roles.has('reanimation')) return 'enable reanimation plan';
  if (roles.has('sacrifice-outlet')) return 'assemble sacrifice engine';
  if (tags.has('wincon')) return 'find a finisher';
  return 'best strategy target';
}

function preferenceScore(card, tags, roles, preferences, player, profile) {
  let score = 0;
  for (const preference of preferences || []) {
    if (preference === 'missing-combo-piece' && isMissingComboPiece(card, player, profile)) score += 100;
    if (preference === 'protection' && (tags.has('protection') || roles.has('protection') || tags.has('counterspell'))) score += 55;
    if (preference === 'fast-mana' && (tags.has('fast-mana') || roles.has('fast-mana'))) score += 45;
    if (preference === 'boardwipe' && tags.has('boardwipe')) score += 60;
    if (preference === 'counterspell' && tags.has('counterspell')) score += 55;
    if (preference === 'wincon' && tags.has('wincon')) score += 50;
    if (preference === 'ramp' && tags.has('ramp')) score += 45;
    if (preference === 'sacrifice-outlet' && tags.has('sacrifice-outlet')) score += 60;
    if (preference === 'payoff' && (tags.has('aristocrats') || tags.has('token-doubler') || tags.has('wincon'))) score += 50;
    if (preference === 'recursion' && (tags.has('reanimation') || roles.has('graveyard-setup'))) score += 45;
    if (preference === 'reanimation-target' && (tags.has('wincon') || roles.has('reanimation-target'))) score += 50;
    if (preference === 'reanimation-spell' && tags.has('reanimation')) score += 60;
    if (preference === 'stax-piece' && tags.has('stax')) score += 60;
  }
  return score;
}

function missingComboPieceScore(card, player, profile) {
  return isMissingComboPiece(card, player, profile) ? 90 : 0;
}

function isMissingComboPiece(card, player, profile) {
  if (!player || !profile.comboReport) return false;
  const name = normalizeName(card.name);
  const available = new Set(player.hand.concat(player.battlefield, player.graveyard, player.commandZone).map((item) => normalizeName(item.name)));
  for (const combo of profile.comboReport.exactCombos || []) {
    const required = (combo.cardsRequired || []).map(normalizeName);
    const missing = required.filter((comboName) => !available.has(comboName));
    if (missing.length === 1 && missing[0] === name) return true;
  }
  return false;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { TutorResolver };
