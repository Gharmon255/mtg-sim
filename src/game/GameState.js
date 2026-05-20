class GameState {
  constructor(players, options = {}) {
    this.players = players;
    this.turn = 0;
    this.maxTurns = options.maxTurns || 14;
    this.debug = Boolean(options.debug);
    this.events = [];
  }

  activePlayers() {
    return this.players.filter((player) => !player.eliminated);
  }

  opponentsOf(player) {
    return this.activePlayers().filter((candidate) => candidate.id !== player.id);
  }

  record(message) {
    this.events.push({ turn: this.turn, message });
  }

  recordDebug(message) {
    if (this.debug) this.record(message);
  }
}

module.exports = { GameState };
