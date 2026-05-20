class Random {
  constructor(seed) {
    this.seed = Random.normalizeSeed(seed);
  }

  static normalizeSeed(seed) {
    if (seed === undefined || seed === null || seed === '') {
      return Math.floor(Math.random() * 2147483646) + 1;
    }

    const text = String(seed);
    let value = 0;
    for (let i = 0; i < text.length; i += 1) {
      value = (value * 31 + text.charCodeAt(i)) % 2147483647;
    }
    return value || 1;
  }

  next() {
    this.seed = (this.seed * 48271) % 2147483647;
    return this.seed / 2147483647;
  }

  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    if (!items.length) return null;
    return items[this.int(items.length)];
  }

  shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(i + 1);
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }
}

module.exports = { Random };
