const { StapleBehavior } = require('./StapleBehavior');

function registerValue(registry) {
  const drawEngine = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'draw-engine',
    basePriority: 34,
    earlyPriority: 24,
    archetypePriority: { control: 24, combo: 14, midrange: 20, tokens: 14 },
    drawNow: 1,
    threat: 3,
    explain,
    ...extra
  }));

  drawEngine('Rhystic Study', 'priority 87: early draw engine that may draw counters');
  drawEngine('Mystic Remora', 'high early priority: taxes opponents and reloads combo/control hands', { earlyPriority: 30 });
  drawEngine('The One Ring', 'protected draw engine for midgame resource advantage', { basePriority: 42, earlyPriority: 6, drawNow: 2, threat: 5 });
  drawEngine('Esper Sentinel', 'early value creature that taxes noncreature spells', { earlyPriority: 28, threat: 2 });
  drawEngine('Skullclamp', 'draw engine when creature fodder or tokens exist', { archetypePriority: { tokens: 30, aristocrats: 34 } });
  drawEngine('Sylvan Library', 'early selection and card advantage engine');
  drawEngine('Necropotence', 'high-impact black card advantage engine', { basePriority: 45, threat: 5 });
  drawEngine('Guardian Project', 'creature deck value engine', { archetypePriority: { ramp: 20, midrange: 18 } });
  drawEngine('Beast Whisperer', 'creature chain draw engine', { archetypePriority: { ramp: 18, tokens: 18 } });
  drawEngine('Windfall', 'refill or combo setup draw spell', { basePriority: 26, earlyPriority: 0, drawNow: 4, archetypePriority: { combo: 24, control: 12 } });
}

module.exports = { registerValue };
