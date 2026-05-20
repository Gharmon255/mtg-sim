const { StapleBehavior } = require('./StapleBehavior');

function registerTutors(registry) {
  const universal = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'tutor',
    basePriority: 30,
    earlyPriority: 8,
    archetypePriority: { combo: 35, control: 18, midrange: 20, reanimator: 26, aristocrats: 24, stax: 20 },
    explain,
    ...extra
  }));

  universal('Demonic Tutor', 'finds the best strategic target instead of a random card');
  universal('Vampiric Tutor', 'delayed tutor: best when setting up a combo or answer', { basePriority: 24 });
  universal('Imperial Seal', 'delayed tutor: best with a clear next-turn plan', { basePriority: 22 });
  universal('Enlightened Tutor', 'finds artifact or enchantment engines, protection, or combo pieces');
  universal('Mystical Tutor', 'finds instant or sorcery combo, interaction, or board reset');
  universal('Worldly Tutor', 'finds creature combo pieces, commander support, or finishers');
  universal('Gamble', 'cheap tutor with risk, best when combo density is high', { basePriority: 22 });
  universal('Finale of Devastation', 'creature tutor that can become a finisher at high mana', { latePriority: 20 });
  universal('Chord of Calling', 'instant creature tutor for combo, stax, or protection creatures', { latePriority: 14 });
  universal('Entomb', 'reanimator setup: put the best target into the graveyard', { archetypePriority: { reanimator: 45, combo: 22 } });
  universal('Buried Alive', 'reanimator setup: load multiple graveyard targets', { archetypePriority: { reanimator: 42, combo: 20 } });
}

module.exports = { registerTutors };
