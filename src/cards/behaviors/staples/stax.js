const { StapleBehavior } = require('./StapleBehavior');

function registerStax(registry) {
  const stax = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'stax',
    basePriority: 28,
    earlyPriority: 22,
    archetypePriority: { stax: 42, control: 12, combo: -35 },
    hurtsCombo: true,
    threat: 3,
    drag: 2,
    explain,
    ...extra
  }));

  stax('Drannith Magistrate', 'early lock piece against commanders and cascade-style plans');
  stax('Opposition Agent', 'punishes tutors and fetch effects, strong against combo');
  stax('Dauthi Voidwalker', 'graveyard hate plus value pressure', { archetypePriority: { stax: 28, midrange: 18 } });
  stax('Rule of Law', 'stax decks prioritize early; combo decks avoid hurting themselves');
  stax('Deafening Silence', 'cheap Rule of Law effect that slows spell-heavy decks');
  stax('Winter Orb', 'stax lock piece that slows mana development', { drag: 3 });
  stax('Collector Ouphe', 'artifact mana hate, strongest against fast mana/combo pods');
  stax('Rest in Peace', 'graveyard hate for reanimator and recursion decks', { archetypePriority: { stax: 24, control: 18, combo: -20 } });
  stax('Grafdigger\'s Cage', 'graveyard/library hate for reanimator and creature-combo decks', { archetypePriority: { stax: 24, control: 16, combo: -18 } });
}

module.exports = { registerStax };
