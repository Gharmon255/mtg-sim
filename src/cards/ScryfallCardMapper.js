function mapScryfallCard(card) {
  const face = Array.isArray(card.card_faces) ? card.card_faces[0] : card;
  const typeLine = card.type_line || face.type_line || '';
  const oracleText = card.oracle_text || face.oracle_text || '';
  return {
    scryfallId: card.id || null,
    name: card.name,
    manaCost: card.mana_cost || face.mana_cost || '',
    manaValue: card.cmc || 0,
    colors: card.colors || face.colors || [],
    colorIdentity: card.color_identity || [],
    typeLine,
    oracleText,
    power: face.power || null,
    toughness: face.toughness || null,
    legalities: card.legalities || {},
    producedMana: card.produced_mana || face.produced_mana || [],
    keywords: card.keywords || face.keywords || [],
    layout: card.layout || null,
    faces: Array.isArray(card.card_faces) ? card.card_faces.map(mapFace) : [],
    edhrecRank: card.edhrec_rank || null,
    prices: card.prices || {},
    fetchedAt: new Date().toISOString(),
    imageUris: imageUrisFor(card, face),
    tags: inferTags(typeLine, oracleText)
  };
}

function mapFace(face) {
  return {
    name: face.name,
    manaCost: face.mana_cost || '',
    manaValue: face.cmc || 0,
    colors: face.colors || [],
    typeLine: face.type_line || '',
    oracleText: face.oracle_text || '',
    power: face.power || null,
    toughness: face.toughness || null,
    producedMana: face.produced_mana || [],
    keywords: face.keywords || []
  };
}

function imageUrisFor(card, face) {
  const images = card.image_uris || face.image_uris || {};
  return {
    small: images.small || null,
    normal: images.normal || null,
    artCrop: images.art_crop || null
  };
}

function inferTags(typeLine, oracleText) {
  const tags = new Set();
  const type = String(typeLine).toLowerCase();
  const text = String(oracleText).toLowerCase();
  const isLand = type.includes('land');

  if (isLand) tags.add('land');
  if (type.includes('creature')) tags.add('creature');
  if (type.includes('planeswalker')) tags.add('creature');
  if (type.includes('legendary creature') || text.includes('can be your commander')) tags.add('commander');
  if (!isLand && text.includes('add ') && (text.includes('mana') || /\{[wubrgc]\}/i.test(text))) tags.add('ramp');
  if (text.includes('search your library') && text.includes('land')) tags.add('ramp');
  if (text.includes('draw ') || text.includes('draw a card')) tags.add('draw');
  if (text.includes('destroy target') || text.includes('exile target') || text.includes('deals ') || text.includes('return target creature')) tags.add('removal');
  if (text.includes('prevent all damage') || text.includes('hexproof') || text.includes('indestructible') || text.includes('protection')) tags.add('protection');
  if (text.includes('+1/+1 counter') || text.includes('proliferate') || text.includes('double the number of counters')) tags.add('counters');
  if (text.includes('search your library') && !text.includes('land')) tags.add('tutor');
  if (text.includes('counter target')) tags.add('counterspell');
  if (text.includes('destroy all') || text.includes('exile all') || text.includes('return all')) tags.add('boardwipe');
  if ((type.includes('creature') && /[6-9]|\d{2,}/.test(String(typeLine))) || text.includes('creatures you control get')) tags.add('wincon');
  if (text.includes('win the game') || text.includes('loses the game')) tags.add('wincon');

  return Array.from(tags);
}

module.exports = { mapScryfallCard };
