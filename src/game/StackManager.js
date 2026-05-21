const { StackObject } = require('./StackObject');

class StackManager {
  constructor() {
    this.objects = [];
    this.resolvedObjects = [];
    this.history = this.resolvedObjects;
  }

  push(stackObject) {
    const object = stackObject instanceof StackObject ? stackObject : new StackObject(stackObject);
    this.objects.push(object);
    return object;
  }

  peek() {
    return this.objects[this.objects.length - 1] || null;
  }

  pop() {
    return this.objects.pop() || null;
  }

  size() {
    return this.objects.length;
  }

  clear() {
    this.objects = [];
  }

  resolvePending(gameState, interactionEngine) {
    const object = this.peek();
    if (!object) {
      recordDebug(gameState, 'Stack resolve skipped: no pending stack object.');
      return { stopped: false, reason: 'empty_stack' };
    }
    recordDebug(gameState, `Stack object resolving: ${object.id} ${object.label()}.`);
    const result = isResolvableStackObject(object)
      ? resolveObject(gameState, interactionEngine, object)
      : { stopped: false, reason: 'invalid_stack_object' };
    if (!isResolvableStackObject(object)) {
      recordDebug(gameState, `Stack object invalid: ${object.id} has no usable interaction window.`);
    }
    object.markResolved(result);
    this.pop();
    this.resolvedObjects.push(object);
    recordStackMetric(object);
    if (object.stopped) {
      recordDebug(gameState, `Stack object stopped: ${object.id} ${object.label()} by ${result.by || 'interaction'}.`);
    } else {
      recordDebug(gameState, `Stack object resolved: ${object.id} ${object.label()}.`);
    }
    recordDebug(gameState, `Stack object moved to history: ${object.id}.`);
    return result;
  }

  resolveTop(gameState, interactionEngine) {
    return this.resolvePending(gameState, interactionEngine);
  }
}

function recordDebug(gameState, message) {
  if (gameState && gameState.recordDebug) gameState.recordDebug(message);
}

function isResolvableStackObject(object) {
  return Boolean(object && typeof object.isValid === 'function' && object.isValid());
}

function resolveObject(gameState, interactionEngine, object) {
  if (!interactionEngine || typeof interactionEngine.resolveStackObject !== 'function') {
    recordDebug(gameState, `Stack object ${object.id} has no interaction resolver; resolving by default.`);
    return { stopped: false, reason: 'no_interaction_resolver' };
  }
  return interactionEngine.resolveStackObject(gameState, object) || { stopped: false };
}

function recordStackMetric(object) {
  const player = object && object.sourcePlayer;
  if (!player || !player.metrics) return;
  player.metrics.stackObjectsProcessed = (player.metrics.stackObjectsProcessed || 0) + 1;
  if (object.isValid && object.isValid() && !object.stopped) {
    player.metrics.stackObjectsResolved = (player.metrics.stackObjectsResolved || 0) + 1;
  }
}

module.exports = { StackManager };
