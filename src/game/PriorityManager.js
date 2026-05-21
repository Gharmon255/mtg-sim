const { ACTION_TYPES, WINDOW_TYPES, createInteractionWindow } = require('./InteractionWindow');
const { StackObject } = require('./StackObject');

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
      const nested = this.resolveOneDeepResponse(gameState, stackObject, sourcePlayer, responder, answer, attempt, interactionEngine);
      response.result = summarizeResult(nested.result);
      response.stackObjectId = nested.responseObject && nested.responseObject.id;
      if (nested.counterplay) response.counterplay = nested.counterplay;
      const result = nested.result;
      if (result.stopped) {
        recordDebug(gameState, `Priority pass complete: ${stackObject.label()} has a stopping response.`);
        return completePriority(stackObject, priority, result, 'stopped');
      }
      recordDebug(gameState, `Priority pass complete: ${stackObject.label()} continues after one-deep counterplay.`);
      return completePriority(stackObject, priority, result, 'passed');
    }

    const result = { stopped: false, reason: 'all_players_passed' };
    recordDebug(gameState, `Interaction window closes: ${stackObject.label()} resolves.`);
    recordDebug(gameState, `Priority pass complete: all responders passed for ${stackObject.label()}.`);
    return completePriority(stackObject, priority, result, 'passed');
  }

  resolveOneDeepResponse(gameState, stackObject, sourcePlayer, responder, answer, originalAttempt, interactionEngine) {
    if (isNestedResponseDepthLimit(stackObject)) {
      const result = {
        stopped: false,
        reason: 'nested_response_depth_limit',
        by: responder && responder.name,
        card: answer && answer.name
      };
      if (stackObject && stackObject.priority) {
        stackObject.priority.depthLimit = {
          reason: result.reason,
          attemptedBy: result.by,
          card: result.card
        };
      }
      recordDebug(gameState, `Nested response refused: nested_response_depth_limit for ${stackObject ? stackObject.label() : 'unknown object'}.`);
      return {
        responseObject: null,
        counterplay: { stoppedResponse: false, reason: result.reason },
        result
      };
    }
    const responseObject = pushResponseStackObject(gameState, stackObject, responder, answer, originalAttempt);
    const committed = interactionEngine.commitPriorityResponse(gameState, responder, answer, originalAttempt);
    if (!committed.ok) {
      responseObject.priorityResult = {
        stopped: false,
        reason: committed.result.reason || 'response_payment_failed',
        by: responder.name,
        card: answer.name,
        parentStackObjectId: stackObject.id
      };
      recordDebug(gameState, `Nested response could not be committed: ${answer.name}.`);
      resolveResponseObject(gameState, interactionEngine);
      return { responseObject, counterplay: null, result: committed.result };
    }
    const counterplay = interactionEngine.attemptCounterplay
      ? interactionEngine.attemptCounterplay(gameState, sourcePlayer, responseObject, responder, answer, originalAttempt)
      : { stoppedResponse: false, reason: 'counterplay_unavailable' };
    recordCounterplayPriority(responseObject, sourcePlayer, counterplay);

    if (counterplay.stoppedResponse) {
      responseObject.priorityResult = {
        stopped: true,
        by: counterplay.by,
        card: counterplay.card,
        reason: counterplay.reason || 'counterplay_stopped_response',
        parentStackObjectId: stackObject.id
      };
      recordDebug(gameState, `Nested response resolved first: ${responseObject.label()} was stopped by ${counterplay.card}.`);
      resolveResponseObject(gameState, interactionEngine);
      return {
        responseObject,
        counterplay,
        result: {
          stopped: false,
          protected: Boolean(counterplay.protected),
          by: responder.name,
          card: answer.name,
          protection: counterplay.card,
          reason: 'response_stopped_by_counterplay'
        }
      };
    }

    const result = interactionEngine.finalizePriorityStop(gameState, sourcePlayer, responder, answer, originalAttempt);
    responseObject.priorityResult = {
      stopped: false,
      by: responder.name,
      card: answer.name,
      reason: result.stopped ? 'response_resolved_and_stops_parent' : result.reason || 'response_resolved',
      parentStackObjectId: stackObject.id
    };
    recordDebug(gameState, `Nested response resolved first: ${answer.name} resolves before ${stackObject.label()}.`);
    resolveResponseObject(gameState, interactionEngine);
    return { responseObject, counterplay, result };
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

function isNestedResponseDepthLimit(parentObject) {
  if (!parentObject) return true;
  return Boolean(parentObject.isResponse || Number(parentObject.responseDepth || 0) >= 1);
}

function pushResponseStackObject(gameState, parentObject, responder, answer, originalAttempt) {
  const responseWindow = createInteractionWindow(responder, {
    windowType: WINDOW_TYPES.SPELL_CAST,
    actionType: originalAttempt.kind || ACTION_TYPES.HIGH_IMPACT,
    label: answer.name,
    sourceCard: answer,
    targetPlayer: parentObject.sourcePlayer,
    impactScore: answer.answerPriorityScore || answer.counterPriorityScore || parentObject.impactScore || 60,
    canBeCountered: true,
    canBeRemoved: false,
    canBeProtected: originalAttempt.canBeProtected,
    reason: `${answer.name} responds to ${parentObject.label()}`,
    debug: {
      respondsTo: parentObject.id,
      responseDepth: 1
    }
  });
  const responseObject = StackObject.fromWindow(responseWindow, gameState, {
    parentStackObjectId: parentObject.id,
    respondsTo: parentObject.id,
    isResponse: true,
    responseDepth: 1,
    debug: {
      respondsTo: parentObject.id,
      responseDepth: 1,
      responseToCard: parentObject.sourceCard && parentObject.sourceCard.name
    }
  });
  responseObject.priority = initializePriority(responseObject);
  responseObject.priority.status = 'response-pending';
  responseObject.priority.parentStackObjectId = parentObject.id;
  responseObject.priority.ordering = 'one-deep-counterplay';
  gameState.stackManager.push(responseObject);
  recordDebug(gameState, `Nested response object pushed: ${responseObject.id} ${answer.name} responds to ${parentObject.id}. Stack size ${gameState.stackManager.size()}.`);
  return responseObject;
}

function recordCounterplayPriority(responseObject, sourcePlayer, counterplay) {
  if (!responseObject || !responseObject.priority) return;
  const playerName = sourcePlayer ? sourcePlayer.name : 'Unknown player';
  responseObject.priority.order = [playerName];
  if (counterplay && counterplay.stoppedResponse) {
    responseObject.priority.responses.push({
      player: playerName,
      card: counterplay.card,
      reason: counterplay.reason || 'one-deep counterplay'
    });
    responseObject.priority.status = 'stopped';
    responseObject.priority.result = {
      stopped: true,
      by: counterplay.by,
      card: counterplay.card,
      reason: counterplay.reason || 'counterplay_stopped_response'
    };
    return;
  }
  responseObject.priority.passes.push({
    player: playerName,
    role: 'counterplay',
    reason: counterplay && counterplay.reason ? counterplay.reason : 'no legal counterplay'
  });
  responseObject.priority.status = 'passed';
  responseObject.priority.result = { stopped: false, reason: 'response_resolved' };
}

function resolveResponseObject(gameState, interactionEngine) {
  if (!gameState || !gameState.stackManager) return { stopped: false, reason: 'missing_stack_manager' };
  const result = gameState.stackManager.resolvePending(gameState, interactionEngine);
  recordDebug(gameState, `Nested response moved through LIFO resolution: ${result.reason || (result.stopped ? 'stopped' : 'resolved')}.`);
  return result;
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
