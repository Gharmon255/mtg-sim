let nextStackObjectId = 1;

class StackObject {
  constructor(values = {}) {
    const window = values.window || values.interactionWindow || null;
    this.id = values.id || `stack-${nextStackObjectId++}`;
    this.controller = values.controller || values.sourcePlayer || (window && window.sourcePlayer) || null;
    this.sourcePlayer = values.sourcePlayer || this.controller;
    this.sourceCard = values.sourceCard || (window && window.sourceCard) || null;
    this.window = window;
    this.actionType = values.actionType || (window && window.actionType) || null;
    this.windowType = values.windowType || (window && window.windowType) || null;
    this.targetPlayer = values.targetPlayer || (window && window.targetPlayer) || null;
    this.targetPermanent = values.targetPermanent || (window && window.targetPermanent) || null;
    this.impactScore = Number(values.impactScore || (window && window.impactScore) || 0);
    this.threatScore = Number(values.threatScore || (window && window.threatScore) || this.impactScore);
    this.resolved = Boolean(values.resolved);
    this.stopped = Boolean(values.stopped);
    this.result = values.result || null;
    this.priority = values.priority || null;
    this.priorityResult = values.priorityResult || null;
    this.parentStackObjectId = values.parentStackObjectId || values.respondsTo || null;
    this.respondsTo = values.respondsTo || this.parentStackObjectId;
    this.isResponse = Boolean(values.isResponse || this.respondsTo);
    this.responseDepth = Number(values.responseDepth || (this.isResponse ? 1 : 0));
    this.createdAtTurn = values.createdAtTurn;
    this.turnIndex = values.turnIndex !== undefined ? values.turnIndex : values.createdAtTurn;
    this.debug = values.debug || (window && window.debug) || {};
  }

  static fromWindow(window, gameState = null, values = {}) {
    if (!window || typeof window !== 'object') {
      return new StackObject({
        ...values,
        window: null,
        createdAtTurn: values.createdAtTurn !== undefined ? values.createdAtTurn : gameState && gameState.turn,
        turnIndex: values.turnIndex !== undefined ? values.turnIndex : gameState && gameState.turn,
        debug: {
          ...(values.debug || {}),
          invalidWindow: true,
          invalidReason: 'missing or malformed interaction window'
        }
      });
    }
    return new StackObject({
      ...values,
      window,
      sourcePlayer: values.sourcePlayer || window.sourcePlayer,
      sourceCard: values.sourceCard || window.sourceCard,
      actionType: values.actionType || window.actionType,
      windowType: values.windowType || window.windowType,
      targetPlayer: values.targetPlayer || window.targetPlayer,
      targetPermanent: values.targetPermanent || window.targetPermanent,
      impactScore: values.impactScore || window.impactScore,
      threatScore: values.threatScore || window.threatScore,
      createdAtTurn: values.createdAtTurn !== undefined ? values.createdAtTurn : gameState && gameState.turn,
      turnIndex: values.turnIndex !== undefined ? values.turnIndex : gameState && gameState.turn
    });
  }

  label() {
    return (this.window && this.window.label) || (this.sourceCard && this.sourceCard.name) || this.actionType || this.id;
  }

  isValid() {
    return Boolean(this.window && typeof this.window.toAttempt === 'function' && this.sourcePlayer);
  }

  markResolved(result = {}) {
    this.resolved = true;
    this.result = result;
    this.stopped = Boolean(result.stopped);
    return this;
  }
}

module.exports = { StackObject };
