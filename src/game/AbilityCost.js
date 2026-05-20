const { parseManaCost } = require('../rules/ManaCostParser');

class AbilityCost {
  constructor(costs = {}) {
    this.costs = costs;
  }

  canPay(player, permanent, context = {}) {
    if (this.costs.tap && permanent.tapped) return { success: false, reason: 'source tapped' };
    if (this.costs.payLife && player.life <= this.costs.payLife) return { success: false, reason: 'not enough life' };
    if (this.costs.mana && player.manaSourceManager) {
      const result = player.manaSourceManager.payCost(this.costs.mana, {
        simulate: true,
        excludePermanentId: permanent && permanent.id,
        isCommander: context.isCommander
      });
      if (!result.success) return { success: false, reason: result.reason, payment: result };
    }
    return { success: true };
  }

  pay(player, permanent, context = {}) {
    const canPay = this.canPay(player, permanent, context);
    if (!canPay.success) return canPay;
    if (this.costs.payLife) player.life -= Number(this.costs.payLife || 0);
    if (this.costs.mana && player.manaSourceManager) {
      const payment = player.manaSourceManager.payCost(this.costs.mana, {
        excludePermanentId: permanent && permanent.id,
        isCommander: context.isCommander
      });
      if (!payment.success) return { success: false, reason: payment.reason, payment };
      player.lastManaPayment = payment;
    }
    if (this.costs.tap && permanent) permanent.tapped = true;
    if (this.costs.sacrificeSelf && permanent && player.zoneManager) player.zoneManager.movePermanentToGraveyard(permanent);
    if (this.costs.discardSelf && permanent && player.zoneManager) player.zoneManager.movePermanentToGraveyard(permanent);
    if (this.costs.discardHand) {
      const discarded = player.hand.splice(0, player.hand.length);
      player.graveyard.push(...discarded);
      player.metrics.discardCostsPaid = (player.metrics.discardCostsPaid || 0) + discarded.length;
    }
    if (this.costs.discardCard) {
      const card = chooseDiscard(player, context);
      if (!card) return { success: false, reason: 'no card to discard' };
      player.removeFromHand(card);
      player.graveyard.push(card);
      player.metrics.discardCostsPaid = (player.metrics.discardCostsPaid || 0) + 1;
    }
    if (this.costs.exileCardFromHand) {
      const card = chooseDiscard(player, context);
      if (!card) return { success: false, reason: 'no card to exile' };
      player.removeFromHand(card);
      player.exile.push(card);
      player.metrics.imprintCostsPaid = (player.metrics.imprintCostsPaid || 0) + 1;
    }
    return { success: true };
  }
}

function canPayAbilityCost(player, permanent, costs, context = {}) {
  return new AbilityCost(costs).canPay(player, permanent, context);
}

function payAbilityCost(player, permanent, costs, context = {}) {
  return new AbilityCost(costs).pay(player, permanent, context);
}

function chooseDiscard(player, context = {}) {
  if (context.discardCard) return context.discardCard;
  return (player.hand || [])
    .filter((card) => !(card.tags || []).includes('land') || context.allowDiscardLand)
    .sort((a, b) => (a.manaValue || 0) - (b.manaValue || 0))[0] || null;
}

function parsedAbilityManaCost(cost) {
  return parseManaCost(cost || '');
}

module.exports = {
  AbilityCost,
  canPayAbilityCost,
  payAbilityCost,
  parsedAbilityManaCost
};
