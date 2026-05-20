const { CommanderRules } = require('../rules/CommanderRules');
const { ACTION_TYPES, WINDOW_TYPES, createInteractionWindow } = require('./InteractionWindow');

class CombatEngine {
  constructor(options = {}) {
    this.interactionEngine = options.interactionEngine || null;
  }

  attack(gameState, player, targeting) {
    if (player.boardScore <= 0) return;
    const target = targeting.combatTarget(player);
    if (!target) return;

    const shieldReduction = Math.min(target.interactionShield, Math.ceil(player.boardScore / 2));
    target.interactionShield = Math.max(0, target.interactionShield - shieldReduction);
    const damage = Math.max(0, Math.ceil(player.boardScore / 2) - shieldReduction);
    const commanderLethal = wouldBeCommanderLethal(player, target, damage);
    if (this.interactionEngine && (damage >= target.life || commanderLethal)) {
      const actionType = commanderLethal ? ACTION_TYPES.COMMANDER_LETHAL : ACTION_TYPES.LETHAL;
      const stopped = this.interactionEngine.attemptToStop(gameState, player, createInteractionWindow(player, {
        windowType: WINDOW_TYPES.COMBAT,
        actionType,
        label: commanderLethal ? 'lethal commander attack' : 'lethal attack',
        targetPlayer: target,
        impactScore: commanderLethal ? 96 : 90,
        canBeCountered: true,
        canBeRemoved: true,
        canBeProtected: true,
        reason: commanderLethal ? 'commander damage would eliminate the defender' : 'combat damage would eliminate the defender'
      }));
      if (stopped.stopped) {
        return;
      }
    }
    target.life -= damage;
    player.damageDealt += damage;
    player.metrics.combatDamageDealt = (player.metrics.combatDamageDealt || 0) + damage;
    if (gameState.turn <= 4) player.metrics.earlyCombatDamage = (player.metrics.earlyCombatDamage || 0) + damage;
    this.applyCommanderDamage(gameState, player, target, damage);
    gameState.record(`${player.name} attacks ${target.name} for ${damage}.`);
  }

  applyCommanderDamage(gameState, player, target, damage) {
    if (damage <= 0 || player.commanderPermanentNames.size === 0) return;
    const activeCommanders = Array.from(player.commanderPermanentNames)
      .map((name) => ({ name, power: player.commanderCombatPower.get(name) || 1 }));
    const totalCommanderPower = activeCommanders.reduce((sum, commander) => sum + commander.power, 0);
    const commanderDamagePool = Math.min(damage, totalCommanderPower);
    const shieldedPool = Math.max(0, commanderDamagePool - target.commanderDamageShield);
    target.commanderDamageShield = Math.max(0, target.commanderDamageShield - commanderDamagePool);
    if (shieldedPool <= 0) return;
    for (const commander of activeCommanders) {
      const assignedDamage = Math.max(0, Math.floor(shieldedPool * (commander.power / totalCommanderPower)));
      if (assignedDamage <= 0) continue;
      const key = `${player.id}:${commander.name}`;
      const total = (target.commanderDamage.get(key) || 0) + assignedDamage;
      target.commanderDamage.set(key, total);
      if (total >= CommanderRules.commanderDamageLimit && !target.eliminated) {
        target.eliminated = true;
        target.metrics.lossReason = `21 commander damage from ${commander.name}`;
        gameState.record(`${target.name} loses to commander damage from ${commander.name}.`);
      }
    }
  }
}

function wouldBeCommanderLethal(player, target, damage) {
  if (damage <= 0 || player.commanderPermanentNames.size === 0) return false;
  const activeCommanders = Array.from(player.commanderPermanentNames)
    .map((name) => ({ name, power: player.commanderCombatPower.get(name) || 1 }));
  const totalCommanderPower = activeCommanders.reduce((sum, commander) => sum + commander.power, 0);
  if (totalCommanderPower <= 0) return false;
  const commanderDamagePool = Math.min(damage, totalCommanderPower);
  for (const commander of activeCommanders) {
    const assignedDamage = Math.max(0, Math.floor(commanderDamagePool * (commander.power / totalCommanderPower)));
    const key = `${player.id}:${commander.name}`;
    if ((target.commanderDamage.get(key) || 0) + assignedDamage >= CommanderRules.commanderDamageLimit) return true;
  }
  return false;
}

module.exports = { CombatEngine };
