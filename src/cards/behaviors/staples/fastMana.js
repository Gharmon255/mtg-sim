const { StapleBehavior } = require('./StapleBehavior');

function registerFastMana(registry) {
  const fast = (rampAmount, earlyPriority, explain, extra = {}) => new StapleBehavior({
    kind: 'fast-mana',
    rampAmount,
    basePriority: 45,
    earlyPriority,
    archetypePriority: { combo: 20, ramp: 18, stax: 16 },
    explain,
    ...extra
  });
  const ramp = (rampAmount, earlyPriority, explain, extra = {}) => new StapleBehavior({
    kind: 'ramp',
    rampAmount,
    basePriority: 28,
    earlyPriority,
    archetypePriority: { ramp: 24, combo: 10, midrange: 10 },
    explain,
    ...extra
  });

  registry
    .register('Sol Ring', fast(2, 45, 'priority 98: early fast mana'))
    .register('Mana Crypt', fast(2, 50, 'priority 100: free early fast mana', { free: true }))
    .register('Mana Vault', fast(3, 38, 'early burst mana for high-impact turns'))
    .register('Grim Monolith', fast(3, 26, 'burst mana with paid untap restriction'))
    .register('Basalt Monolith', fast(3, 20, 'combo mana rock with paid untap restriction'))
    .register('Chrome Mox', fast(1, 38, 'fast imprint mana when a low-priority card can be exiled'))
    .register('Mox Diamond', fast(1, 38, 'fast mana when discarding a spare land is acceptable'))
    .register('Mox Opal', fast(1, 32, 'fast mana once metalcraft is online'))
    .register('Mox Amber', fast(1, 22, 'legendary-dependent fast mana'))
    .register('Lotus Petal', fast(1, 36, 'one-shot fixing or combo tempo'))
    .register('Jeweled Lotus', fast(3, 34, 'commander-only burst mana'))
    .register('Arcane Signet', fast(1, 30, 'early color fixing and ramp'))
    .register('Dockside Extortionist', new StapleBehavior({
      kind: 'dockside',
      basePriority: 28,
      earlyPriority: 10,
      archetypePriority: { combo: 30, midrange: 16, ramp: 18 },
      explain: 'treasure burst scales with opponent artifacts and enchantments'
    }))
    .register('Smothering Tithe', ramp(2, 8, 'long-game Treasure engine', { threat: 4, archetypePriority: { control: 22, midrange: 20, ramp: 24 } }))
    .register('Birds of Paradise', ramp(1, 24, 'one-mana color fixing creature', { board: 1 }))
    .register('Llanowar Elves', ramp(1, 22, 'one-mana mana creature', { board: 1 }))
    .register('Cultivate', ramp(1, 18, 'stable land ramp and fixing'))
    .register('Kodama\'s Reach', ramp(1, 18, 'stable land ramp and fixing'))
    .register('Nature\'s Lore', ramp(1, 24, 'efficient two-mana land ramp'))
    .register('Three Visits', ramp(1, 24, 'efficient two-mana land ramp'))
    .register('Lion\'s Eye Diamond', fast(3, 42, 'explosive combo mana', { archetypePriority: { combo: 40 }, comboContribution: 'fast-mana-combo' }));
}

module.exports = { registerFastMana };
