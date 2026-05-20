const WINDOW_TYPES = new Set([
  'spell-cast',
  'activated-ability',
  'triggered-ability',
  'combat',
  'combo-attempt',
  'board-wipe'
]);

class InteractionWindow {
  constructor(input = {}) {
    this.windowType = normalizeWindowType(input.windowType || input.type || input.kind);
    this.sourcePlayer = input.sourcePlayer || input.actingPlayer || null;
    this.sourceCard = input.sourceCard || input.card || null;
    this.actionType = input.actionType || input.kind || this.windowType;
    this.label = input.label || (this.sourceCard && this.sourceCard.name) || this.actionType || 'unknown action';
    this.targetPlayer = input.targetPlayer || null;
    this.targetPermanent = input.targetPermanent || null;
    this.threatScore = Number(input.threatScore || input.impactScore || defaultThreatScore(this.actionType));
    this.impactScore = Number(input.impactScore || input.threatScore || this.threatScore);
    this.canBeCountered = input.canBeCountered !== undefined ? Boolean(input.canBeCountered) : defaultCounterable(this);
    this.canBeRemoved = input.canBeRemoved !== undefined ? Boolean(input.canBeRemoved) : defaultRemovable(this);
    this.canBeProtected = input.canBeProtected !== undefined ? Boolean(input.canBeProtected) : defaultProtectable(this);
    this.reason = input.reason || defaultReason(this);
    this.debug = input.debug || input.metadata || {};
    this.originalAttempt = input.originalAttempt || input;
  }

  is(kind) {
    return this.actionType === kind || this.windowType === kind;
  }

  toAttempt() {
    return {
      ...this.originalAttempt,
      kind: this.actionType,
      label: this.label,
      card: this.sourceCard || this.originalAttempt.card,
      sourcePlayer: this.sourcePlayer,
      targetPlayer: this.targetPlayer,
      targetPermanent: this.targetPermanent,
      threatScore: this.threatScore,
      impactScore: this.impactScore,
      canBeCountered: this.canBeCountered,
      canBeRemoved: this.canBeRemoved,
      canBeProtected: this.canBeProtected,
      reason: this.reason,
      interactionWindow: this
    };
  }
}

function createInteractionWindow(actingPlayer, attempt = {}) {
  if (attempt instanceof InteractionWindow) return attempt;
  if (attempt.interactionWindow instanceof InteractionWindow) return attempt.interactionWindow;
  return new InteractionWindow({
    ...attempt,
    sourcePlayer: attempt.sourcePlayer || actingPlayer,
    sourceCard: attempt.sourceCard || attempt.card,
    originalAttempt: attempt
  });
}

function normalizeWindowType(type) {
  if (WINDOW_TYPES.has(type)) return type;
  if (type === 'combo') return 'combo-attempt';
  if (type === 'boardwipe') return 'board-wipe';
  if (type === 'lethal' || type === 'commander-lethal') return 'combat';
  if (type === 'activated' || type === 'mana-ability') return 'activated-ability';
  if (type === 'triggered') return 'triggered-ability';
  return 'spell-cast';
}

function defaultThreatScore(actionType) {
  if (actionType === 'combo') return 95;
  if (actionType === 'commander-lethal' || actionType === 'lethal') return 90;
  if (actionType === 'boardwipe' || actionType === 'wincon') return 85;
  if (actionType === 'stax' || actionType === 'high-impact') return 72;
  return 50;
}

function defaultCounterable(window) {
  if (window.windowType === 'activated-ability') return false;
  if (window.windowType === 'triggered-ability') return false;
  if (window.actionType === 'lethal' || window.actionType === 'commander-lethal') return false;
  return true;
}

function defaultRemovable(window) {
  return ['combo', 'lethal', 'commander-lethal', 'stax', 'wincon', 'high-impact'].includes(window.actionType)
    || window.windowType === 'activated-ability';
}

function defaultProtectable(window) {
  return ['combo', 'boardwipe', 'lethal', 'commander-lethal', 'wincon', 'high-impact'].includes(window.actionType);
}

function defaultReason(window) {
  if (window.windowType === 'combo-attempt') return 'combo attempt may end the game';
  if (window.windowType === 'combat') return 'combat damage may be lethal';
  if (window.windowType === 'board-wipe') return 'board wipe changes the battlefield';
  if (window.windowType === 'activated-ability') return 'activated ability may create an important advantage';
  if (window.windowType === 'triggered-ability') return 'triggered ability may create an important advantage';
  return 'spell may meaningfully affect the game';
}

module.exports = {
  InteractionWindow,
  createInteractionWindow
};
