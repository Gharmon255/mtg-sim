class StapleBehavior {
  constructor(config = {}) {
    this.config = config;
    this.source = 'specific';
  }

  canCast(player, card) {
    if (card.name === 'Chrome Mox' && !chooseChromeMoxImprint(player)) return false;
    if (card.name === 'Mox Diamond' && !canDiscardLandForMoxDiamond(player)) return false;
    if (card.name === "Lion's Eye Diamond" && !canUseLedSafely(player)) return false;
    if (this.config.free) return true;
    return player.canPayCard ? player.canPayCard(card) : player.availableMana >= (card.manaValue || 0);
  }

  getCastPriority(context) {
    const { player, card, turn, opponents = [] } = context;
    const profile = player.strategyProfile || {};
    let score = Number(this.config.basePriority || 0);
    if (turn <= 3) score += Number(this.config.earlyPriority || 0);
    if (turn >= 6) score += Number(this.config.latePriority || 0);
    score += Number((this.config.archetypePriority || {})[profile.primaryArchetype] || 0);

    if (this.config.kind === 'dockside') score += Math.max(0, estimateTreasures(opponents) - 2) * 18;
    if (this.config.kind === 'draw-engine' && turn <= 4) score += 22;
    if (this.config.kind === 'stax' && profile.primaryArchetype === 'combo' && this.config.hurtsCombo) score -= 55;
    if (this.config.kind === 'overrun') score += boardWidth(player) >= 5 ? 55 : -45;
    if (this.config.kind === 'x-finisher') score += player.availableMana >= 8 ? 55 : -35;
    if (this.config.kind === 'ballista') score += hasInfiniteManaSignal(player) ? 70 : -25;
    return Math.round(score);
  }

  shouldHold(context) {
    const { player, turn, opponents = [] } = context;
    if (this.config.kind === 'dockside') return estimateTreasures(opponents) < 2 && turn < 5;
    if (this.config.kind === 'protection') return true;
    if (this.config.kind === 'overrun') return boardWidth(player) < 5;
    if (this.config.kind === 'x-finisher') return player.availableMana < 8;
    if (this.config.kind === 'ballista') return !hasInfiniteManaSignal(player) && player.availableMana < 6;
    if (this.config.kind === 'stax') {
      const archetype = (player.strategyProfile || {}).primaryArchetype;
      return archetype === 'combo' && this.config.hurtsCombo;
    }
    return false;
  }

  cast(context) {
    const { gameState, player, card, targeting } = context;
    if (!this.config.free) {
      if (player.payCard) {
        if (!player.payCard(card)) return { impact: 0, message: `${player.name} cannot pay for ${card.name}.` };
      } else {
        player.availableMana -= card.manaValue || 0;
      }
    }
    if (this.config.kind === 'fast-mana' || this.config.kind === 'ramp') return castRamp(context, this.config);
    if (this.config.kind === 'dockside') return castDockside(context);
    if (this.config.kind === 'draw-engine') return castDrawEngine(context, this.config);
    if (this.config.kind === 'stax') return castStax(context, this.config);
    if (this.config.kind === 'overrun') return castOverrun(context, this.config);
    if (this.config.kind === 'x-finisher') return castXFinisher(context, this.config);
    if (this.config.kind === 'ballista') return castBallista(context);
    if (this.config.kind === 'combo-piece') return castComboPiece(context, this.config);
    if (this.config.kind === 'protection') return castProtection(context, this.config);
    if (this.config.kind === 'boardwipe') return castBoardWipe(context, this.config);
    if (this.config.kind === 'removal') return castRemoval(context, this.config);
    if (this.config.kind === 'counterspell') return castCounterspell(context, this.config);

    player.metrics.spellsCast += 1;
    player.graveyard.push(card);
    return { impact: 0, message: `${player.name} casts ${card.name}.` };
  }

  getInteractionPriority(context) {
    return Number(this.config.interactionPriority || this.config.basePriority || 0);
  }

  getTutorPriority(context) {
    const profile = (context.player || {}).strategyProfile || {};
    return Number((this.config.archetypePriority || {})[profile.primaryArchetype] || this.config.basePriority || 0);
  }

  getComboContribution() {
    return this.config.comboContribution || null;
  }

  getWinAttempt(context) {
    if (this.config.kind === 'overrun' && boardWidth(context.player) >= 5) return { type: 'combat', confidence: 'medium' };
    if (this.config.kind === 'x-finisher' && context.player.availableMana >= 10) return { type: 'life-drain', confidence: 'medium' };
    if (this.config.kind === 'ballista' && hasInfiniteManaSignal(context.player)) return { type: 'damage', confidence: 'high' };
    return null;
  }

  explainDecision(context = {}) {
    if (typeof this.config.explain === 'function') return this.config.explain(context);
    return this.config.explain || `${this.config.kind || 'specific'} behavior`;
  }
}

function castRamp({ player, card }, config) {
  const ramp = Number(config.rampAmount || 1);
  if (!isReusableManaPermanent(card)) player.rampMana += ramp;
  player.threatScore += Number(config.threat || 0);
  player.boardScore += Number(config.board || 0);
  player.metrics.rampPlayed += 1;
  player.metrics.spellsCast += 1;
  putAfterCast(player, card);
  return { impact: ramp, message: `${player.name} accelerates with ${card.name}.` };
}

function isReusableManaPermanent(card) {
  const type = String((card && card.typeLine) || '').toLowerCase();
  return type.includes('artifact') || type.includes('creature');
}

function castDockside({ gameState, player, card }) {
  const treasures = Math.max(1, estimateTreasures(gameState.opponentsOf(player)));
  if (player.createTreasures) player.createTreasures(treasures, card.name);
  else player.treasures = (player.treasures || 0) + treasures;
  player.boardScore += 1;
  player.threatScore += Math.min(8, treasures);
  player.metrics.rampPlayed += 1;
  player.metrics.spellsCast += 1;
  if (player.addPermanent) player.addPermanent(card);
  else player.battlefield.push(card);
  return { impact: treasures, message: `${player.name} makes about ${treasures} Treasure with ${card.name}.` };
}

function castDrawEngine({ player, card }, config) {
  const cards = Number(config.drawNow || 1);
  player.draw(cards);
  player.threatScore += Number(config.threat || 2);
  player.metrics.drawSpellsCast += 1;
  player.metrics.spellsCast += 1;
  if (player.addPermanent) player.addPermanent(card);
  else player.battlefield.push(card);
  return { impact: cards + 2, message: `${player.name} establishes ${card.name} as a draw engine.` };
}

function castStax({ gameState, player, card }, config) {
  player.metrics.staxPiecesCast = (player.metrics.staxPiecesCast || 0) + 1;
  player.metrics.spellsCast += 1;
  player.threatScore += Number(config.threat || 3);
  if (player.addPermanent) player.addPermanent(card);
  else player.battlefield.push(card);
  for (const opponent of gameState.opponentsOf(player)) {
    opponent.threatScore = Math.max(0, opponent.threatScore - Number(config.drag || 1));
  }
  return { impact: 4, message: `${player.name} constrains the table with ${card.name}.` };
}

function castOverrun({ gameState, player, card }, config) {
  const damage = Math.max(8, boardWidth(player) * Number(config.damagePerBody || 3));
  const target = gameState.opponentsOf(player).sort((a, b) => b.life - a.life)[0];
  if (target) {
    target.life -= damage;
    player.damageDealt += damage;
  }
  player.metrics.spellsCast += 1;
  player.graveyard.push(card);
  return { impact: damage, message: `${player.name} converts a wide board into ${damage} pressure with ${card.name}.` };
}

function castXFinisher({ gameState, player, card }, config) {
  const x = Math.max(0, player.availableMana);
  const damage = Math.max(0, x * Number(config.damageRate || 2));
  for (const opponent of gameState.opponentsOf(player)) opponent.life -= damage;
  player.damageDealt += damage * gameState.opponentsOf(player).length;
  player.metrics.spellsCast += 1;
  player.graveyard.push(card);
  player.availableMana = 0;
  return { impact: damage, message: `${player.name} spends big mana on ${card.name} for about ${damage} to each opponent.` };
}

function castBallista({ player, card }) {
  const impact = hasInfiniteManaSignal(player) ? 20 : Math.max(1, Math.floor(player.availableMana / 2));
  player.threatScore += impact;
  player.boardScore += Math.max(1, Math.floor(impact / 3));
  player.metrics.comboPiecesSeen = (player.metrics.comboPiecesSeen || 0) + 1;
  player.metrics.spellsCast += 1;
  if (player.addPermanent) player.addPermanent(card);
  else player.battlefield.push(card);
  return { impact, message: `${player.name} deploys ${card.name} as a scalable win condition.` };
}

function castComboPiece({ player, card }, config) {
  player.metrics.comboPiecesSeen = (player.metrics.comboPiecesSeen || 0) + 1;
  player.metrics.spellsCast += 1;
  player.threatScore += Number(config.threat || 3);
  putAfterCast(player, card);
  return { impact: 4, message: `${player.name} advances a combo line with ${card.name}.` };
}

function castProtection({ player, card }, config) {
  player.interactionShield += Number(config.shield || 3);
  player.commanderDamageShield += Number(config.commanderShield || 3);
  player.metrics.protectionUsed = (player.metrics.protectionUsed || 0) + 1;
  player.metrics.spellsCast += 1;
  player.graveyard.push(card);
  return { impact: 3, message: `${player.name} protects their plan with ${card.name}.` };
}

function castBoardWipe({ gameState, player, card }, config) {
  const retain = Number(config.retain || 0.2);
  for (const opponent of gameState.activePlayers()) {
    opponent.boardScore = Math.floor(opponent.boardScore * retain);
    opponent.threatScore = Math.floor(opponent.threatScore * retain);
  }
  player.metrics.boardWipesCast += 1;
  player.metrics.spellsCast += 1;
  player.graveyard.push(card);
  return { impact: 8, message: `${player.name} resets the board with ${card.name}.` };
}

function castRemoval({ player, card, targeting }, config) {
  const target = targeting.highestThreatOpponent(player);
  const strength = Number(config.strength || 4);
  if (target) {
    target.boardScore = Math.max(0, target.boardScore - strength * 2);
    target.threatScore = Math.max(0, target.threatScore - strength * 2);
  }
  player.metrics.removalUsed += 1;
  player.metrics.spellsCast += 1;
  player.graveyard.push(card);
  return { impact: strength, message: `${player.name} answers a key threat with ${card.name}.` };
}

function castCounterspell({ player, card }, config) {
  player.interactionShield += Number(config.shield || 3);
  player.metrics.counterspellsHeld += 1;
  player.metrics.spellsCast += 1;
  player.graveyard.push(card);
  return { impact: 3, message: `${player.name} keeps ${card.name} available for a high-priority spell.` };
}

function putAfterCast(player, card) {
  if (isPermanent(card)) {
    if (player.addPermanent) player.addPermanent(card);
    else player.battlefield.push(card);
  }
  else player.graveyard.push(card);
}

function isPermanent(card) {
  const type = String((card && card.typeLine) || '').toLowerCase();
  return type.includes('artifact') || type.includes('creature') || type.includes('enchantment') || type.includes('planeswalker') || type.includes('battle');
}

function boardWidth(player) {
  const bodies = player.battlefield.filter((card) => String(card.typeLine || '').toLowerCase().includes('creature')).length;
  return bodies + Math.floor((player.boardScore || 0) / 4);
}

function estimateTreasures(opponents = []) {
  return opponents.reduce((sum, opponent) => {
    const permanents = opponent.battlefield || [];
    const realCount = permanents.filter((card) => /artifact|enchantment/i.test(card.typeLine || '')).length;
    return sum + realCount + Math.floor((opponent.boardScore || 0) / 8);
  }, 0);
}

function hasInfiniteManaSignal(player) {
  const names = new Set(player.battlefield.concat(player.hand, player.graveyard).map((card) => String(card.name || '').toLowerCase()));
  return names.has('basalt monolith') && names.has('rings of brighthearth')
    || names.has('isochron scepter') && names.has('dramatic reversal')
    || player.rampMana >= 10;
}

function chooseChromeMoxImprint(player) {
  return (player.hand || [])
    .filter((card) => !/artifact|land/i.test(card.typeLine || ''))
    .filter((card) => !((card.tags || []).includes('wincon') || (card.tags || []).includes('combo-piece') || (card.tags || []).includes('counterspell')))
    .sort((a, b) => (a.manaValue || 0) - (b.manaValue || 0))[0] || null;
}

function canDiscardLandForMoxDiamond(player) {
  const lands = (player.hand || []).filter((card) => (card.tags || []).includes('land') || /land/i.test(card.typeLine || ''));
  return lands.length > 1 || ((player.strategyProfile || {}).estimatedBracket >= 4 && lands.length > 0 && player.turnCount <= 2);
}

function canUseLedSafely(player) {
  const profile = player.strategyProfile || {};
  const hasBreach = player.hand.concat(player.battlefield, player.graveyard)
    .some((card) => String(card.name || '').toLowerCase() === 'underworld breach');
  const handValue = (player.hand || []).filter((card) => !(card.tags || []).includes('land')).length;
  const safe = profile.primaryArchetype === 'combo' && (hasBreach || handValue <= 2);
  if (!safe) player.metrics.badLedActivationsAvoided = (player.metrics.badLedActivationsAvoided || 0) + 1;
  return safe;
}

module.exports = { StapleBehavior, estimateTreasures, boardWidth, hasInfiniteManaSignal };
