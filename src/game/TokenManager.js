class TokenManager {
  constructor(player) {
    this.player = player;
  }

  createTreasure(count = 1, sourceName = 'Treasure') {
    const created = [];
    for (let index = 0; index < count; index += 1) {
      const token = this.player.addPermanent({
        name: 'Treasure',
        manaCost: '',
        manaValue: 0,
        colors: [],
        colorIdentity: [],
        typeLine: 'Token Artifact - Treasure',
        oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
        tags: ['artifact', 'treasure', 'ramp']
      }, {
        isToken: true,
        tokenType: 'Treasure',
        summoningSick: false,
        metadata: { sourceName }
      });
      created.push(token);
    }
    this.player.metrics.treasuresCreated = (this.player.metrics.treasuresCreated || 0) + count;
    this.player.metrics.treasuresBySource = this.player.metrics.treasuresBySource || {};
    this.player.metrics.treasuresBySource[sourceName] = (this.player.metrics.treasuresBySource[sourceName] || 0) + count;
    return created;
  }

  treasureCount() {
    return this.player.battlefield.filter((permanent) => permanent.tokenType === 'Treasure' && !permanent.sacrificed).length;
  }
}

module.exports = { TokenManager };
