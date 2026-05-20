class CommanderPlanResolver {
  constructor(cardDatabase, options = {}) {
    this.cardDatabase = cardDatabase;
    this.roleResolver = options.roleResolver || null;
  }

  resolve(deck, profile = {}) {
    const commanderEntry = deck.commanders[0];
    const commander = commanderEntry ? this.cardDatabase.get(commanderEntry.name) || commanderEntry : null;
    if (!commander) {
      return { role: 'support commander', castTiming: 'normal', protect: false, recast: false, reasons: ['No commander found.'] };
    }
    const text = String(commander.oracleText || '').toLowerCase();
    const tags = new Set(commander.tags || []);
    const roles = this.roleResolver ? this.roleResolver.rolesFor(commander) : [];
    const role = classifyCommander({ text, tags, roles, profile });
    const plan = {
      role,
      castTiming: castTiming(role, profile),
      protect: shouldProtect(role, profile),
      recast: shouldRecast(role, profile),
      neededForWin: ['combo commander', 'voltron commander', 'aristocrats commander', 'token commander'].includes(role),
      reasons: commanderReasons(role, commander)
    };
    return plan;
  }
}

function classifyCommander({ text, tags, roles, profile }) {
  if (profile.primaryArchetype === 'voltron' || tags.has('commander-damage')) return 'voltron commander';
  if (profile.primaryArchetype === 'combo' || roles.includes('combo-piece') || tags.has('combo-piece')) return 'combo commander';
  if (profile.primaryArchetype === 'stax' || tags.has('stax')) return 'stax commander';
  if (profile.primaryArchetype === 'aristocrats' || text.includes('dies') || text.includes('sacrifice')) return 'aristocrats commander';
  if (profile.primaryArchetype === 'tokens' || text.includes('token')) return 'token commander';
  if (profile.primaryArchetype === 'reanimator' || text.includes('graveyard')) return 'reanimator commander';
  if (text.includes('draw')) return 'draw commander';
  if (text.includes('add') && text.includes('mana')) return 'ramp commander';
  if (text.includes('creatures you control') || text.includes('choose a creature type')) return 'tribal commander';
  return 'support commander';
}

function castTiming(role, profile) {
  if (role === 'voltron commander' || role === 'draw commander' || role === 'stax commander') return 'early';
  if (role === 'combo commander') return 'when combo/protection is close';
  if (role === 'ramp commander') return 'after early ramp';
  if ((profile.estimatedBracket || 1) >= 4) return 'with protection if possible';
  return 'normal';
}

function shouldProtect(role, profile) {
  return ['voltron commander', 'combo commander', 'draw commander', 'stax commander'].includes(role) || (profile.commanderPriority || 0) >= 70;
}

function shouldRecast(role, profile) {
  return shouldProtect(role, profile) || (profile.commanderPriority || 0) >= 60;
}

function commanderReasons(role, commander) {
  return [`${commander.name} is classified as ${role}.`];
}

module.exports = { CommanderPlanResolver };
