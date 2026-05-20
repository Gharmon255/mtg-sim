const { COLORS } = require('../rules/ManaCostParser');

class ManaPool {
  constructor(values = {}) {
    for (const color of COLORS) this[color] = Number(values[color] || 0);
    this.C = Number(values.C || 0);
    this.treasures = Number(values.treasures || 0);
    this.floating = Number(values.floating || 0);
    this.flex = Array.isArray(values.flex) ? values.flex.map((source) => Array.from(source)) : [];
  }

  clone() {
    return new ManaPool(this);
  }

  add(values = {}) {
    for (const color of COLORS) this[color] += Number(values[color] || 0);
    this.C += Number(values.C || 0);
    this.treasures += Number(values.treasures || 0);
    this.floating += Number(values.floating || 0);
    if (Array.isArray(values.flex)) this.flex.push(...values.flex.map((source) => Array.from(source)));
    return this;
  }

  total() {
    return COLORS.reduce((sum, color) => sum + this[color], 0) + this.C + this.treasures + this.floating + this.flex.length;
  }

  coloredTotal() {
    return COLORS.reduce((sum, color) => sum + this[color], 0);
  }

  canPay(cost) {
    return this.clone().pay(cost);
  }

  pay(cost) {
    for (const color of COLORS) {
      let needed = Number(cost[color] || 0);
      const paidColored = Math.min(this[color], needed);
      this[color] -= paidColored;
      needed -= paidColored;
      while (needed > 0 && this.payFlexColor(color)) needed -= 1;
      const paidTreasure = Math.min(this.treasures, needed);
      this.treasures -= paidTreasure;
      needed -= paidTreasure;
      if (needed > 0) return false;
    }

    let colorlessNeeded = Number(cost.C || 0);
    const paidColorless = Math.min(this.C, colorlessNeeded);
    this.C -= paidColorless;
    colorlessNeeded -= paidColorless;
    if (colorlessNeeded > 0) return false;

    for (const options of cost.hybrid || []) {
      if (!this.payHybrid(options)) return false;
    }

    let genericNeeded = Number(cost.generic || 0);
    genericNeeded += Number(cost.X || 0);
    if (this.total() < genericNeeded) return false;
    this.payGeneric(genericNeeded);
    return true;
  }

  payHybrid(options) {
    for (const color of options) {
      if (COLORS.includes(color) && this[color] > 0) {
        this[color] -= 1;
        return true;
      }
    }
    if (this.treasures > 0) {
      this.treasures -= 1;
      return true;
    }
    if (options.some((option) => /^\d+$/.test(option))) {
      return this.payGeneric(1);
    }
    return false;
  }

  payGeneric(amount) {
    let remaining = Number(amount || 0);
    const colorless = Math.min(this.C, remaining);
    this.C -= colorless;
    remaining -= colorless;
    const floating = Math.min(this.floating, remaining);
    this.floating -= floating;
    remaining -= floating;
    const treasure = Math.min(this.treasures, remaining);
    this.treasures -= treasure;
    remaining -= treasure;
    const flex = Math.min(this.flex.length, remaining);
    this.flex.splice(0, flex);
    remaining -= flex;
    for (const color of COLORS) {
      const paid = Math.min(this[color], remaining);
      this[color] -= paid;
      remaining -= paid;
      if (remaining <= 0) return true;
    }
    return remaining <= 0;
  }

  missingColors(cost) {
    const missing = [];
    for (const color of COLORS) {
      const need = Number(cost[color] || 0);
      const flexible = this.flex.filter((source) => source.includes(color)).length;
      if (need > this[color] + flexible + this.treasures) missing.push(color);
    }
    if (Number(cost.C || 0) > this.C) missing.push('C');
    return missing;
  }

  payFlexColor(color) {
    const index = this.flex.findIndex((source) => source.includes(color));
    if (index < 0) return false;
    this.flex.splice(index, 1);
    return true;
  }
}

module.exports = { ManaPool };
