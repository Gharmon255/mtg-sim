const {
  FETCH_LANDS,
  SHOCK_LANDS,
  TRIOMES,
  TAP_LANDS,
  isFetchLand,
  isShockLand,
  isTriome
} = require('./LandProduction');

class LandBehaviorRegistry {
  behaviorFor(card) {
    if (!card) return { kind: 'unknown-land', exact: false };
    if (isFetchLand(card)) return { kind: 'fetch', exact: true, fetchColors: FETCH_LANDS[card.name] || [] };
    if (isShockLand(card)) return { kind: 'shock', exact: true, canPayLife: true };
    if (isTriome(card)) return { kind: 'triome', exact: true, entersTapped: true };
    if (TAP_LANDS.has(card.name)) return { kind: 'tap-land', exact: true, entersTapped: true };
    if (/basic land/i.test(card.typeLine || '')) return { kind: 'basic', exact: true };
    if (/land/i.test(card.typeLine || '')) return { kind: 'known-or-produced-land', exact: true };
    return { kind: 'unknown-land', exact: false };
  }

  hasExactBehavior(card) {
    return this.behaviorFor(card).exact;
  }
}

module.exports = { LandBehaviorRegistry };
