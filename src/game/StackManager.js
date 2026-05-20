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

  resolveTop(gameState, interactionEngine) {
    const object = this.peek();
    if (!object) return { stopped: false };
    recordDebug(gameState, `Stack object resolving: ${object.id} ${object.label()}.`);
    const result = interactionEngine.resolveStackObject
      ? interactionEngine.resolveStackObject(gameState, object)
      : { stopped: false };
    object.markResolved(result);
    this.pop();
    this.resolvedObjects.push(object);
    if (object.stopped) {
      recordDebug(gameState, `Stack object stopped: ${object.id} ${object.label()} by ${result.by || 'interaction'}.`);
    } else {
      recordDebug(gameState, `Stack object resolved: ${object.id} ${object.label()}.`);
    }
    recordDebug(gameState, `Stack object moved to history: ${object.id}.`);
    return result;
  }
}

function recordDebug(gameState, message) {
  if (gameState && gameState.recordDebug) gameState.recordDebug(message);
}

module.exports = { StackManager };
