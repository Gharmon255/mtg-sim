const WINDOW_TYPES = Object.freeze({
  SPELL_CAST: 'spell-cast',
  ACTIVATED_ABILITY: 'activated-ability',
  TRIGGERED_ABILITY: 'triggered-ability',
  COMBAT: 'combat',
  COMBO_ATTEMPT: 'combo-attempt',
  BOARD_WIPE: 'board-wipe'
});

const ACTION_TYPES = Object.freeze({
  COMBO: 'combo',
  BOARDWIPE: 'boardwipe',
  LETHAL: 'lethal',
  COMMANDER_LETHAL: 'commander-lethal',
  STAX: 'stax',
  WINCON: 'wincon',
  HIGH_IMPACT: 'high-impact'
});

const WINDOW_TYPE_VALUES = new Set(Object.values(WINDOW_TYPES));

class InteractionWindow {
  constructor(input = {}) {
    this.windowType = normalizeWindowType(input.windowType || input.type || input.kind || input.actionType);
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
  if (WINDOW_TYPE_VALUES.has(type)) return type;
  if (type === ACTION_TYPES.COMBO) return WINDOW_TYPES.COMBO_ATTEMPT;
  if (type === ACTION_TYPES.BOARDWIPE) return WINDOW_TYPES.BOARD_WIPE;
  if (type === ACTION_TYPES.LETHAL || type === ACTION_TYPES.COMMANDER_LETHAL) return WINDOW_TYPES.COMBAT;
  if (type === 'activated' || type === 'mana-ability') return WINDOW_TYPES.ACTIVATED_ABILITY;
  if (type === 'triggered') return WINDOW_TYPES.TRIGGERED_ABILITY;
  return WINDOW_TYPES.SPELL_CAST;
}

function defaultThreatScore(actionType) {
  if (actionType === ACTION_TYPES.COMBO) return 95;
  if (actionType === ACTION_TYPES.COMMANDER_LETHAL || actionType === ACTION_TYPES.LETHAL) return 90;
  if (actionType === ACTION_TYPES.BOARDWIPE || actionType === ACTION_TYPES.WINCON) return 85;
  if (actionType === ACTION_TYPES.STAX || actionType === ACTION_TYPES.HIGH_IMPACT) return 72;
  return 50;
}

function defaultCounterable(window) {
  if (window.windowType === WINDOW_TYPES.ACTIVATED_ABILITY) return false;
  if (window.windowType === WINDOW_TYPES.TRIGGERED_ABILITY) return false;
  return true;
}

function defaultRemovable(window) {
  return [
    ACTION_TYPES.COMBO,
    ACTION_TYPES.LETHAL,
    ACTION_TYPES.COMMANDER_LETHAL,
    ACTION_TYPES.STAX,
    ACTION_TYPES.WINCON,
    ACTION_TYPES.HIGH_IMPACT
  ].includes(window.actionType)
    || window.windowType === WINDOW_TYPES.ACTIVATED_ABILITY;
}

function defaultProtectable(window) {
  return [
    ACTION_TYPES.COMBO,
    ACTION_TYPES.BOARDWIPE,
    ACTION_TYPES.LETHAL,
    ACTION_TYPES.COMMANDER_LETHAL,
    ACTION_TYPES.WINCON,
    ACTION_TYPES.HIGH_IMPACT
  ].includes(window.actionType);
}

function defaultReason(window) {
  if (window.windowType === WINDOW_TYPES.COMBO_ATTEMPT) return 'combo attempt may end the game';
  if (window.windowType === WINDOW_TYPES.COMBAT) return 'combat damage may be lethal';
  if (window.windowType === WINDOW_TYPES.BOARD_WIPE) return 'board wipe changes the battlefield';
  if (window.windowType === WINDOW_TYPES.ACTIVATED_ABILITY) return 'activated ability may create an important advantage';
  if (window.windowType === WINDOW_TYPES.TRIGGERED_ABILITY) return 'triggered ability may create an important advantage';
  return 'spell may meaningfully affect the game';
}

module.exports = {
  ACTION_TYPES,
  WINDOW_TYPES,
  InteractionWindow,
  createInteractionWindow
};
