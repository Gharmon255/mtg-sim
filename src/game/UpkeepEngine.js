const { AbilityResolver } = require('./AbilityResolver');

class UpkeepEngine {
  constructor(options = {}) {
    this.abilityResolver = options.abilityResolver || new AbilityResolver({ interactionEngine: options.interactionEngine });
  }

  run(gameState, player) {
    for (const permanent of player.battlefield.slice()) {
      if (!permanent || permanent.sacrificed) continue;
      this.handleManaVault(gameState, player, permanent);
      this.handleManaCrypt(gameState, player, permanent);
      this.handleMysticRemora(gameState, player, permanent);
      this.handleNoNormalUntap(gameState, player, permanent);
    }
    player.refreshManaPool();
  }

  handleNoNormalUntap(gameState, player, permanent) {
    if (permanent.metadata && permanent.metadata.noNormalUntap && permanent.tapped) {
      gameState.recordDebug && gameState.recordDebug(`${permanent.name} did not untap during untap step.`);
      if (shouldPayUntap(player, permanent)) {
        const result = this.abilityResolver.activate(player, permanent, 'untap', {
          turn: gameState.turn,
          gameState,
          recordDebug: (message) => gameState.recordDebug && gameState.recordDebug(`${player.name}: ${message}`)
        });
        if (result.success) {
          gameState.recordDebug && gameState.recordDebug(`${player.name} paid ${permanent.metadata.untapCost || ''} to untap ${permanent.name}.`);
        }
      }
    }
  }

  handleManaVault(gameState, player, permanent) {
    if (permanent.name !== 'Mana Vault' || !permanent.tapped) return;
    const damage = Number((permanent.metadata || {}).upkeepDamageIfTapped || 1);
    player.life -= damage;
    player.metrics.manaVaultDamage = (player.metrics.manaVaultDamage || 0) + damage;
    gameState.recordDebug && gameState.recordDebug(`${permanent.name} dealt ${damage} damage during upkeep because it was tapped.`);
  }

  handleManaCrypt(gameState, player, permanent) {
    if (permanent.name !== 'Mana Crypt') return;
    const roll = player.random ? player.random.next() : Math.random();
    if (roll < 0.5) {
      player.life -= 3;
      player.metrics.manaCryptDamage = (player.metrics.manaCryptDamage || 0) + 3;
      gameState.recordDebug && gameState.recordDebug(`Mana Crypt dealt 3 damage during upkeep.`);
    }
  }

  handleMysticRemora(gameState, player, permanent) {
    if (permanent.name !== 'Mystic Remora') return;
    permanent.metadata.remoraAge = Number(permanent.metadata.remoraAge || 0) + 1;
    const upkeepCost = permanent.metadata.remoraAge;
    if (upkeepCost <= 2 && player.manaSourceManager && player.manaSourceManager.payCost(`{${upkeepCost}}`).success) {
      player.metrics.upkeepCostsPaid = (player.metrics.upkeepCostsPaid || 0) + upkeepCost;
      gameState.recordDebug && gameState.recordDebug(`${player.name} paid Mystic Remora cumulative upkeep ${upkeepCost}.`);
      return;
    }
    player.zoneManager.movePermanentToGraveyard(permanent);
    gameState.recordDebug && gameState.recordDebug(`${player.name} let Mystic Remora go when upkeep reached ${upkeepCost}.`);
  }
}

function shouldPayUntap(player, permanent) {
  const cost = permanent.metadata && permanent.metadata.untapCost;
  if (!cost || !player.manaSourceManager) return false;
  if (permanent.name === 'Mana Vault' && player.life <= 8) return true;
  if (permanent.name === 'Basalt Monolith' && hasComboPartner(player)) return true;
  return player.availableMana >= 6 && player.manaSourceManager.payCost(cost, { simulate: true, excludePermanentId: permanent.id }).success;
}

function hasComboPartner(player) {
  return player.battlefield.concat(player.hand).some((card) => ['Rings of Brighthearth', 'Power Artifact'].includes(card.name));
}

module.exports = { UpkeepEngine };
