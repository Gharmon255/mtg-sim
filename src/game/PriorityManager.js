class PriorityManager {
  getPriorityOrder(gameState, sourcePlayer) {
    return priorityOrder(gameState, sourcePlayer);
  }

  getResponderOrder(gameState, sourcePlayer) {
    return this.getPriorityOrder(gameState, sourcePlayer)
      .filter((player) => !sourcePlayer || player.id !== sourcePlayer.id);
  }

  runPriority(gameState, stackObject, interactionEngine) {
    const priority = initializePriority(stackObject);
    if (stackObject) stackObject.priority = priority;

    if (!stackObject || typeof stackObject.isValid !== 'function' || !stackObject.isValid()) {
      const result = { stopped: false, reason: 'invalid_stack_object' };
      recordDebug(gameState, 'Priority pass skipped: invalid stack object.');
      return completePriority(stackObject, priority, result, 'skipped');
    }

    const sourcePlayer = stackObject.sourcePlayer;
    const prepared = interactionEngine.preparePriorityWindow(gameState, sourcePlayer, stackObject.window);
    if (!prepared.ok) {
      const result = prepared.result || { stopped: false, reason: 'invalid_window' };
      recordDebug(gameState, `Priority pass skipped for ${stackObject.label()}: ${prepared.result.reason || 'invalid window'}.`);
      return completePriority(stackObject, priority, result, 'skipped');
    }

    const attempt = prepared.attempt;
    priority.attempt = {
      kind: attempt.kind,
      label: attempt.label,
      impactScore: attempt.impactScore
    };

    recordDebug(gameState, `Priority pass begins: ${stackObject.id} ${stackObject.label()}.`);
    priority.ordering = 'source-then-table-order';
    const order = this.getPriorityOrder(gameState, sourcePlayer);
    priority.order = order.map((player) => player.name);
    recordDebug(gameState, `Priority order: ${priority.order.join(' -> ') || 'none'}.`);

    if (sourcePlayer) {
      const sourcePass = {
        player: sourcePlayer.name,
        role: 'source',
        reason: 'source player receives the represented first priority context in v1'
      };
      priority.passes.push(sourcePass);
      recordDebug(gameState, `Priority pass: ${sourcePlayer.name} passes as source/controller for ${stackObject.label()}.`);
    }

    for (const responder of order.filter((player) => !sourcePlayer || player.id !== sourcePlayer.id)) {
      const answer = interactionEngine.choosePriorityAnswer(responder, attempt);
      if (!answer) {
        const pass = {
          player: responder.name,
          role: 'opponent',
          reason: 'no suitable response'
        };
        priority.passes.push(pass);
        recordDebug(gameState, `Priority pass: ${responder.name} passes on ${stackObject.label()}: no suitable response.`);
        continue;
      }

      const response = {
        player: responder.name,
        card: answer.name,
        reason: answer.responseReason || 'highest available response score'
      };
      priority.responses.push(response);
      recordDebug(gameState, `Priority response: ${responder.name} chooses ${answer.name} for ${stackObject.label()}: ${response.reason}.`);
      const result = interactionEngine.applyPriorityAnswer(gameState, sourcePlayer, responder, answer, attempt);
      response.result = summarizeResult(result);
      if (result.protected) {
        continue;
      }
      if (result.stopped) {
        recordDebug(gameState, `Priority pass complete: ${stackObject.label()} has a stopping response.`);
        return completePriority(stackObject, priority, result, 'stopped');
      }
    }

    const result = { stopped: false, reason: 'all_players_passed' };
    recordDebug(gameState, `Interaction window closes: ${stackObject.label()} resolves.`);
    recordDebug(gameState, `Priority pass complete: all responders passed for ${stackObject.label()}.`);
    return completePriority(stackObject, priority, result, 'passed');
  }
}

function initializePriority(stackObject) {
  return {
    status: 'pending',
    stackObjectId: stackObject ? stackObject.id : null,
    order: [],
    passes: [],
    responses: [],
    result: null,
    ordering: null,
    attempt: null
  };
}

function completePriority(stackObject, priority, result, status) {
  priority.status = status || (result && result.stopped ? 'stopped' : 'passed');
  priority.result = result || { stopped: false, reason: 'no_priority_result' };
  if (stackObject) stackObject.priorityResult = priority.result;
  return priority.result;
}

function priorityOrder(gameState, sourcePlayer) {
  const players = typeof gameState.activePlayers === 'function'
    ? gameState.activePlayers()
    : (gameState.players || []).filter((player) => !player.eliminated);
  const source = sourcePlayer ? players.find((player) => player.id === sourcePlayer.id) || sourcePlayer : null;
  const opponents = players.filter((player) => !source || player.id !== source.id);
  return source ? [source].concat(opponents) : opponents;
}

function summarizeResult(result = {}) {
  if (result.stopped) return 'stopped';
  if (result.protected) return 'protected';
  return result.reason || 'continued';
}

function recordDebug(gameState, message) {
  if (gameState && gameState.recordDebug) gameState.recordDebug(message);
}

module.exports = { PriorityManager };
