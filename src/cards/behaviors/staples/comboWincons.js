const { StapleBehavior } = require('./StapleBehavior');

function registerComboWincons(registry) {
  const combo = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'combo-piece',
    basePriority: 22,
    archetypePriority: { combo: 34, reanimator: 10 },
    threat: 4,
    explain,
    ...extra
  }));
  const overrun = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'overrun',
    basePriority: 10,
    latePriority: 28,
    archetypePriority: { tokens: 36, ramp: 24, aggro: 28 },
    explain,
    ...extra
  }));
  const xFinisher = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'x-finisher',
    basePriority: 8,
    latePriority: 34,
    archetypePriority: { ramp: 28, control: 18, midrange: 18 },
    explain,
    ...extra
  }));

  combo('Thassa\'s Oracle', 'win attempt only when Consultation/Pact style support is available', { comboContribution: 'oracle-win' });
  combo('Demonic Consultation', 'pairs with Thassa\'s Oracle as a compact win line', { comboContribution: 'oracle-enabler' });
  combo('Tainted Pact', 'pairs with Thassa\'s Oracle as a compact win line', { comboContribution: 'oracle-enabler' });
  combo('Underworld Breach', 'graveyard combo engine, best with Brain Freeze and LED', { threat: 6 });
  combo('Brain Freeze', 'storm/combo win piece, strongest with Underworld Breach', { threat: 5 });
  combo('Isochron Scepter', 'combo piece with Dramatic Reversal and mana rocks');
  combo('Dramatic Reversal', 'combo piece with Isochron Scepter and nonland mana');
  combo('Kiki-Jiki, Mirror Breaker', 'creature combo engine with untappers', { threat: 6 });
  combo('Zealous Conscripts', 'Kiki-Jiki combo partner');
  combo('Splinter Twin', 'combo aura for Pestermite/Deceiver Exarch');
  combo('Pestermite', 'Splinter Twin combo creature');
  combo('Deceiver Exarch', 'Splinter Twin combo creature');
  combo('Basalt Monolith', 'mana rock and infinite-mana combo piece', { kind: 'fast-mana', rampAmount: 3, earlyPriority: 22, comboContribution: 'infinite-mana-piece' });
  combo('Rings of Brighthearth', 'combo piece with Basalt Monolith');
  combo('Heliod, Sun-Crowned', 'Walking Ballista combo partner');
  combo('Bolas\'s Citadel', 'topdeck combo/value engine', { threat: 7 });
  combo('Sensei\'s Divining Top', 'selection and combo piece with Citadel');
  combo('Aetherflux Reservoir', 'storm/lifegain win condition', { threat: 7 });
  registry.register('Walking Ballista', new StapleBehavior({
    kind: 'ballista',
    basePriority: 12,
    latePriority: 20,
    archetypePriority: { combo: 28, ramp: 24, counters: 20 },
    explain: 'held until infinite mana, Heliod combo, or enough mana to matter'
  }));

  overrun('Craterhoof Behemoth', 'held until board is wide enough for lethal combat', { damagePerBody: 4 });
  overrun('Triumph of the Hordes', 'cast when a wide board can threaten lethal poison-style damage', { damagePerBody: 3 });
  xFinisher('Torment of Hailfire', 'big-mana finisher, not a low-value early spell', { damageRate: 2.5 });
  xFinisher('Exsanguinate', 'big-mana drain finisher, strongest late', { damageRate: 2 });
}

module.exports = { registerComboWincons };
