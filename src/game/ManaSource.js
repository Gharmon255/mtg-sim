class ManaSource {
  constructor(values = {}) {
    this.sourceId = values.sourceId;
    this.cardName = values.cardName;
    this.sourceType = values.sourceType || 'special';
    this.produces = values.produces || [];
    this.amount = Number(values.amount || 1);
    this.colorless = Number(values.colorless || 0);
    this.tappedRequired = values.tappedRequired !== false;
    this.sacrificeRequired = Boolean(values.sacrificeRequired);
    this.summoningSicknessApplies = Boolean(values.summoningSicknessApplies);
    this.restrictions = values.restrictions || {};
    this.usableFor = values.usableFor || 'any';
    this.priority = Number(values.priority || 50);
    this.notes = values.notes || [];
    this.permanent = values.permanent || null;
    this.available = values.available !== false;
    this.unavailableReason = values.unavailableReason || null;
  }

  canProduceColor(color) {
    if (color === 'C') return this.colorless > 0 || this.produces.includes('C');
    return this.produces.includes(color) || this.produces.includes('any') || this.produces.includes('commander');
  }

  canPayGeneric() {
    return this.amount > 0 || this.colorless > 0 || this.produces.length > 0;
  }
}

module.exports = { ManaSource };
