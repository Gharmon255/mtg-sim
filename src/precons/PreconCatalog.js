const fs = require('fs');
const path = require('path');

class PreconCatalog {
  constructor(filePath = path.join(process.cwd(), 'data/precons.latest.json')) {
    this.filePath = filePath;
  }

  load() {
    return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
  }

  listDecks() {
    return this.load().sources.flatMap((source) => source.decks.map((deck) => ({
      ...deck,
      setName: source.setName,
      setCode: source.setCode,
      releaseDate: source.releaseDate,
      sourceUrl: source.sourceUrl,
      slug: slugify(`${source.setName}-${deck.title}`)
    })));
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { PreconCatalog, slugify };
