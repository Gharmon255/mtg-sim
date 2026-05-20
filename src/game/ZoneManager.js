const { createPermanent } = require('./PermanentState');
const { AbilityResolver } = require('./AbilityResolver');

class ZoneManager {
  constructor(player) {
    this.player = player;
    this.abilityResolver = new AbilityResolver();
  }

  addToBattlefield(card, options = {}) {
    const permanent = createPermanent(card, {
      controllerId: this.player.id,
      enteredTurn: this.player.turnCount || 0,
      summoningSick: shouldEnterSummoningSick(card, options),
      ...options
    });
    this.abilityResolver.decoratePermanent(permanent);
    applyEntryCosts(this.player, permanent);
    permanent.zone = 'battlefield';
    this.player.battlefield.push(permanent);
    return permanent;
  }

  movePermanentToGraveyard(permanent) {
    const index = this.player.battlefield.indexOf(permanent);
    if (index >= 0) this.player.battlefield.splice(index, 1);
    permanent.zone = 'graveyard';
    permanent.tapped = false;
    permanent.exhausted = false;
    if (!permanent.isToken) this.player.graveyard.push(permanent.card || permanent);
    return permanent;
  }

  exilePermanent(permanent) {
    const index = this.player.battlefield.indexOf(permanent);
    if (index >= 0) this.player.battlefield.splice(index, 1);
    permanent.zone = 'exile';
    permanent.tapped = false;
    permanent.exhausted = false;
    if (!permanent.isToken) this.player.exile.push(permanent.card || permanent);
    return permanent;
  }

  untapStep(turn) {
    for (const permanent of this.player.battlefield) {
      if (permanent && typeof permanent.untapForTurn === 'function') permanent.untapForTurn(turn);
      else {
        permanent.tapped = false;
        permanent.exhausted = false;
        delete permanent.tappedUntilNextTurn;
        if ((permanent.enteredTurn || 0) < turn) permanent.summoningSick = false;
      }
    }
  }
}

function applyEntryCosts(player, permanent) {
  if (permanent.name === 'Chrome Mox') {
    const imprint = chooseChromeMoxImprint(player);
    if (!imprint) {
      permanent.disabledMana = true;
      permanent.metadata.entryCostFailed = 'no valid imprint';
      player.metrics.badActivationsAvoided = (player.metrics.badActivationsAvoided || 0) + 1;
      return;
    }
    player.removeFromHand(imprint);
    player.exile.push(imprint);
    permanent.metadata.imprintedCard = imprint.name;
    const commandZone = player.commandZone || [];
    permanent.metadata.imprintedColor = ((imprint.colors || imprint.colorIdentity || [])[0]) || ((commandZone[0] || {}).colorIdentity || [])[0] || 'C';
    player.metrics.imprintCostsPaid = (player.metrics.imprintCostsPaid || 0) + 1;
  }

  if (permanent.name === 'Mox Diamond') {
    const land = (player.hand || []).find((card) => (card.tags || []).includes('land') || /land/i.test(card.typeLine || ''));
    const totalLands = (player.hand || []).filter((card) => (card.tags || []).includes('land') || /land/i.test(card.typeLine || '')).length;
    if (!land || totalLands <= 1 && player.turnCount <= 3) {
      permanent.disabledMana = true;
      permanent.metadata.entryCostFailed = 'land discard too risky';
      player.metrics.badActivationsAvoided = (player.metrics.badActivationsAvoided || 0) + 1;
      return;
    }
    player.removeFromHand(land);
    player.graveyard.push(land);
    permanent.metadata.discardedLand = land.name;
    player.metrics.discardCostsPaid = (player.metrics.discardCostsPaid || 0) + 1;
  }
}

function chooseChromeMoxImprint(player) {
  return (player.hand || [])
    .filter((card) => !/artifact|land/i.test(card.typeLine || ''))
    .filter((card) => !((card.tags || []).includes('wincon') || (card.tags || []).includes('combo-piece') || (card.tags || []).includes('counterspell')))
    .sort((a, b) => (a.manaValue || 0) - (b.manaValue || 0))[0] || null;
}

function shouldEnterSummoningSick(card, options) {
  if (options.summoningSick !== undefined) return Boolean(options.summoningSick);
  return /creature/i.test((card && card.typeLine) || '');
}

module.exports = { ZoneManager };
