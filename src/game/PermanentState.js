let nextPermanentId = 1;

class PermanentState {
  constructor(card, options = {}) {
    Object.assign(this, card);
    this.id = options.id || `perm-${nextPermanentId++}`;
    this.cardName = card.name;
    this.card = card.card || card;
    this.controllerId = options.controllerId || card.controllerId || card.ownerId || null;
    this.zone = options.zone || 'battlefield';
    this.tapped = Boolean(options.tapped || card.tapped);
    this.summoningSick = Boolean(options.summoningSick);
    this.enteredTurn = options.enteredTurn === undefined ? 0 : options.enteredTurn;
    this.counters = { ...(options.counters || card.counters || {}) };
    this.attachedTo = options.attachedTo || card.attachedTo || null;
    this.isToken = Boolean(options.isToken || card.isToken);
    this.tokenType = options.tokenType || card.tokenType || null;
    this.exhausted = Boolean(options.exhausted || card.exhausted);
    this.sacrificed = Boolean(options.sacrificed || card.sacrificed);
    this.manaAbilities = options.manaAbilities || card.manaAbilities || [];
    this.activatedAbilities = options.activatedAbilities || card.activatedAbilities || [];
    this.metadata = { ...(options.metadata || card.metadata || {}) };
  }

  untapForTurn(turn) {
    const skipsNormalUntap = this.metadata && this.metadata.noNormalUntap && this.tapped;
    if (!this.sacrificed && !skipsNormalUntap) this.tapped = false;
    this.exhausted = false;
    delete this.tappedUntilNextTurn;
    if (this.enteredTurn < turn) this.summoningSick = false;
    return !skipsNormalUntap;
  }
}

function createPermanent(card, options = {}) {
  if (card instanceof PermanentState) return card;
  return new PermanentState(card, options);
}

module.exports = { PermanentState, createPermanent };
