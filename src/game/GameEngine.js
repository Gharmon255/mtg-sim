const { Random } = require('../utils/random');
const { createDefaultBehaviorRegistry } = require('../cards/CardBehavior');
const { CommanderRules } = require('../rules/CommanderRules');
const { PlayerState } = require('./PlayerState');
const { GameState } = require('./GameState');
const { MulliganEngine } = require('./MulliganEngine');
const { TargetingEngine } = require('./TargetingEngine');
const { CombatEngine } = require('./CombatEngine');
const { TurnEngine } = require('./TurnEngine');
const { StrategyProfileBuilder } = require('../ai/StrategyProfileBuilder');
const { DecisionEngine } = require('../ai/DecisionEngine');
const { ThreatEvaluator } = require('../ai/ThreatEvaluator');
const { InteractionEngine } = require('./InteractionEngine');
const { CardTagger } = require('../cards/CardTagger');

class GameEngine {
  constructor({ cardDatabase, seed, maxTurns, logger, strategyProfiles, debug }) {
    this.cardDatabase = cardDatabase;
    this.random = new Random(seed);
    this.maxTurns = maxTurns || 14;
    this.logger = logger;
    this.behaviorRegistry = createDefaultBehaviorRegistry();
    this.strategyProfiles = strategyProfiles || null;
    this.tagger = new CardTagger();
    this.debug = Boolean(debug);
  }

  run(decks) {
    if (decks.length < CommanderRules.minPlayers || decks.length > CommanderRules.maxPlayers) {
      throw new Error(`Commander pods must have ${CommanderRules.minPlayers}-${CommanderRules.maxPlayers} players.`);
    }

    const profiles = this.strategyProfiles || buildProfiles(decks, this.cardDatabase);
    const players = decks.map((deck, index) => new PlayerState({
      id: index,
      name: deck.name,
      deck,
      cardDatabase: this.cardDatabase,
      random: this.random,
      strategyProfile: profiles[index],
      tagger: this.tagger
    }));

    for (const player of players) player.setup();

    const gameState = new GameState(players, { maxTurns: this.maxTurns, debug: this.debug });
    const mulligans = new MulliganEngine(this.random);
    for (const player of players) mulligans.drawOpeningHand(player);

    const threatEvaluator = new ThreatEvaluator();
    const interactionEngine = new InteractionEngine();
    const targeting = new TargetingEngine(gameState, threatEvaluator);
    const turnEngine = new TurnEngine({
      behaviorRegistry: this.behaviorRegistry,
      combatEngine: new CombatEngine({ interactionEngine }),
      decisionEngine: new DecisionEngine({ threatEvaluator }),
      interactionEngine
    });

    while (gameState.turn < gameState.maxTurns && gameState.activePlayers().length > 1) {
      gameState.turn += 1;
      for (const player of players) {
        turnEngine.takeTurn(gameState, player, targeting);
        if (gameState.activePlayers().length <= 1) break;
      }
    }

    const winner = this.determineWinner(gameState);
    for (const player of players) {
      if (player.id !== winner.id && !player.metrics.lossReason) {
        player.metrics.lossReason = player.life <= 0 ? 'life total reached 0' : 'behind at max turn limit';
      }
    }

    return {
      winnerId: winner.id,
      winnerName: winner.name,
      turns: gameState.turn,
      endedBy: gameState.activePlayers().length === 1 ? 'elimination' : 'max_turns',
      players: players.map((player) => this.snapshotPlayer(player, winner.id)),
      events: gameState.events
    };
  }

  determineWinner(gameState) {
    const active = gameState.activePlayers();
    if (active.length === 1) return active[0];
    return gameState.players
      .slice()
      .sort((a, b) => b.life - a.life || b.threatScore - a.threatScore || b.damageDealt - a.damageDealt)[0];
  }

  snapshotPlayer(player, winnerId) {
    return {
      id: player.id,
      name: player.name,
      won: player.id === winnerId,
      life: player.life,
      cardsDrawn: player.cardsDrawn,
      damageDealt: player.damageDealt,
      boardScore: player.boardScore,
      threatScore: player.threatScore,
      commanderDamage: Object.fromEntries(player.commanderDamage.entries()),
      metrics: { ...player.metrics }
    };
  }
}

function buildProfiles(decks, cardDatabase) {
  const builder = new StrategyProfileBuilder(cardDatabase);
  return decks.map((deck) => builder.build(deck));
}

module.exports = { GameEngine };
