const COLORS = ['W', 'U', 'B', 'R', 'G'];

function parseManaCost(manaCost = '') {
  const cost = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0, hybrid: [] };
  const symbols = String(manaCost || '').match(/\{[^}]+\}/g) || [];
  for (const raw of symbols) {
    const symbol = raw.replace(/[{}]/g, '').toUpperCase();
    if (/^\d+$/.test(symbol)) {
      cost.generic += Number(symbol);
    } else if (symbol === 'X') {
      cost.X += 1;
    } else if (symbol === 'C') {
      cost.C += 1;
    } else if (COLORS.includes(symbol)) {
      cost[symbol] += 1;
    } else if (symbol.includes('/')) {
      const options = symbol.split('/').filter((part) => COLORS.includes(part) || /^\d+$/.test(part));
      cost.hybrid.push(options);
    }
  }
  return cost;
}

function colorPipCount(cost) {
  const parsed = typeof cost === 'string' ? parseManaCost(cost) : cost;
  return COLORS.reduce((sum, color) => sum + Number(parsed[color] || 0), 0);
}

function totalManaValueFromCost(cost) {
  const parsed = typeof cost === 'string' ? parseManaCost(cost) : cost;
  return parsed.generic + parsed.C + parsed.X + parsed.hybrid.length + colorPipCount(parsed);
}

module.exports = { COLORS, parseManaCost, colorPipCount, totalManaValueFromCost };
