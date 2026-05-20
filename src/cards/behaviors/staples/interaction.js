const { StapleBehavior } = require('./StapleBehavior');

function registerInteraction(registry) {
  const counter = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'counterspell',
    basePriority: 12,
    interactionPriority: 80,
    archetypePriority: { control: 18, combo: 14 },
    explain,
    ...extra
  }));
  const removal = (name, strength, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'removal',
    basePriority: 14,
    interactionPriority: 70,
    strength,
    archetypePriority: { control: 16, aggro: 8, midrange: 10 },
    explain,
    ...extra
  }));
  const wipe = (name, explain, extra = {}) => registry.register(name, new StapleBehavior({
    kind: 'boardwipe',
    basePriority: 8,
    latePriority: 18,
    interactionPriority: 85,
    archetypePriority: { control: 24, stax: 16 },
    explain,
    ...extra
  }));

  counter('Counterspell', 'held for combo wins, wincons, major tutors, and draw engines');
  counter('Swan Song', 'efficient answer to combo, tutors, draw engines, and board wipes');
  counter('Fierce Guardianship', 'free counter when commander plan is online', { free: true, interactionPriority: 88 });
  counter('Force of Will', 'free counter for game-winning or high-impact spells', { free: true, interactionPriority: 92 });
  counter('Pact of Negation', 'free emergency counter for win attempts', { free: true, interactionPriority: 94 });
  counter('Mana Drain', 'premium counter that can swing tempo', { interactionPriority: 90 });

  removal('Swords to Plowshares', 5, 'answers key commanders, combo creatures, or lethal attackers');
  removal('Path to Exile', 5, 'answers key commanders, combo creatures, or lethal attackers');
  removal('Beast Within', 4, 'answers any high-value permanent');
  removal('Chaos Warp', 4, 'answers difficult permanents and commanders');
  removal('Vandalblast', 6, 'artifact sweeper, strongest against mana rocks and combo artifacts', { archetypePriority: { control: 18, stax: 18 } });
  removal('Cyclonic Rift', 7, 'targeted bounce early or overload-style reset when behind', { kind: 'boardwipe', latePriority: 38, retain: 0.05 });

  wipe('Toxic Deluge', 'board wipe used when behind or facing lethal pressure', { retain: 0.15 });
  wipe('Blasphemous Act', 'large creature-board reset when opponents are ahead', { retain: 0.12 });
}

module.exports = { registerInteraction };
