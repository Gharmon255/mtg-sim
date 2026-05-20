const fs = require('fs');
const path = require('path');

class CardTagger {
  constructor(options = {}) {
    this.powerTagsPath = options.powerTagsPath || path.join(process.cwd(), 'data/card-power-tags.json');
    this.manualTags = loadManualTags(this.powerTagsPath);
  }

  tagsFor(cardOrName) {
    const card = typeof cardOrName === 'string' ? { name: cardOrName } : (cardOrName || {});
    const tags = new Set(card.tags || []);
    const manual = this.manualTags.get(normalizeName(card.name));
    if (manual) {
      for (const tag of manual) tags.add(tag);
    }
    for (const tag of inferTags(card)) tags.add(tag);
    normalizeTagAliases(tags);
    removeLandFalsePositiveInteractionTags(card, tags);
    return Array.from(tags).sort();
  }

  hasTag(card, tag) {
    return this.tagsFor(card).includes(tag);
  }
}

function inferTags(card) {
  const tags = new Set();
  const name = String(card.name || '').toLowerCase();
  const text = String(card.oracleText || '').toLowerCase();
  const type = String(card.typeLine || '').toLowerCase();
  const manaValue = Number(card.manaValue || 0);
  const isLand = type.includes('land');

  if (isLand) tags.add('land');
  if (!isLand && text.includes('add ') && (text.includes('mana') || /\{[wubrgc]\}/i.test(text))) tags.add('ramp');
  if (!isLand && type.includes('artifact') && text.includes('add ')) tags.add('mana-rock');
  if (text.includes('treasure')) tags.add('treasure');
  if (text.includes('search your library')) {
    if (/\bland\b/.test(text)) {
      tags.add('land-ramp');
      tags.add('ramp');
    } else {
      tags.add(text.includes('reveal') ? 'restricted-tutor' : 'unconditional-tutor');
      tags.add('tutor');
    }
  }
  if (!isLand && manaValue <= 1 && tags.has('ramp')) tags.add('fast-mana');
  if (text.includes('add ') && text.includes('spend this mana only')) tags.add('ritual');
  if (text.includes('draw ') || text.includes('draw a card')) tags.add('draw');
  if (text.includes('draw ') || text.includes('draw a card')) tags.add('card-draw');
  if (text.includes('whenever') && (text.includes('draw') || text.includes('draw a card'))) tags.add('repeatable-draw');
  if (text.includes('counter target')) tags.add('counterspell');
  if (text.includes('destroy target') || text.includes('exile target') || text.includes('return target')) tags.add('removal');
  if (text.includes('destroy target') || text.includes('exile target')) tags.add('single-target-removal');
  if (text.includes('destroy all') || text.includes('exile all') || text.includes('return all')) tags.add('boardwipe');
  if (text.includes('hexproof') || text.includes('indestructible') || text.includes('protection')) tags.add('protection');
  if (text.includes('players can\'t') || text.includes('opponents can\'t') || text.includes('each player can\'t')) tags.add('stax');
  if (text.includes('extra turn')) tags.add('extra-turn');
  if (text.includes('destroy all lands') || text.includes('sacrifice all lands')) tags.add('mass-land-denial');
  if (text.includes('win the game') || text.includes('loses the game')) tags.add('wincon');
  if (text.includes('+1/+1 counter') || text.includes('proliferate') || text.includes('double the number of counters')) tags.add('counters');
  if (text.includes('token')) tags.add('tokens');
  if (text.includes('double') && text.includes('token')) tags.add('token-doubler');
  if (text.includes('double') && text.includes('damage')) tags.add('damage-doubler');
  if (text.includes('graveyard')) tags.add('graveyard-synergy');
  if (text.includes('return target creature card from your graveyard') || text.includes('return target creature from your graveyard')) tags.add('reanimation');
  if (text.includes('whenever') && text.includes('dies')) tags.add('aristocrats');
  if (text.includes('sacrifice a creature') || text.includes('sacrifice another')) tags.add('sacrifice-outlet');
  if (text.includes('untap target') || text.includes('untap all')) tags.add('untapper');
  if (text.includes('costs') && text.includes('less to cast')) tags.add('cost-reducer');
  if (text.includes('gain life') || text.includes('lifelink')) tags.add('lifegain');
  if (text.includes('loses life') || text.includes('drain')) tags.add('lifedrain');
  if (type.includes('equipment') || name.includes('greaves') || name.includes('boots')) tags.add('commander-damage');
  if (type.includes('instant') || type.includes('sorcery')) tags.add('spellslinger');
  if (name.includes('storm') || text.includes('storm')) tags.add('storm');
  if (text.includes('blink') || text.includes('exile') && text.includes('return it to the battlefield')) tags.add('blink');
  if (text.includes('activate only as a sorcery') && text.includes('damage')) tags.add('mana-outlet');

  return Array.from(tags);
}

function normalizeTagAliases(tags) {
  if (tags.has('draw')) tags.add('card-draw');
  if (tags.has('card-draw')) tags.add('draw');
  if (tags.has('single-target-removal')) tags.add('removal');
  if (tags.has('unconditional-tutor')) tags.add('tutor');
  if (tags.has('mana-rock') || tags.has('land-ramp') || tags.has('treasure')) tags.add('ramp');
  if (tags.has('counter-doubler')) tags.add('counters');
  if (tags.has('graveyard-recursion')) tags.add('graveyard-synergy');
}

function removeLandFalsePositiveInteractionTags(card, tags) {
  const type = String(card.typeLine || '').toLowerCase();
  if (!type.includes('land') && !type.includes('artifact')) return;
  const text = String(card.oracleText || '').toLowerCase();
  const canActAsInteractionFromHand = text.includes('channel') && /target|counter/.test(text);
  const hasRealInteractionText = /counter target|destroy target|exile target|return target|prevent|protection from|phase out/.test(text);
  if (canActAsInteractionFromHand) return;
  if (hasRealInteractionText) return;
  tags.delete('counterspell');
  tags.delete('removal');
  tags.delete('single-target-removal');
  tags.delete('protection');
}

function loadManualTags(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return new Map(Object.entries(raw).map(([name, tags]) => [normalizeName(name), tags]));
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

module.exports = { CardTagger };
