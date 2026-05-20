const fs = require('fs');
const path = require('path');

class DeckImporter {
  importFromFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const name = path.basename(filePath, path.extname(filePath));
    return this.importFromText(raw, { name, source: filePath });
  }

  importFromText(text, options = {}) {
    const errors = [];
    const commanders = [];
    const mainboard = [];
    const metadata = {};
    let section = 'deck';

    const lines = String(text).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const originalLine = lines[index];
      const line = originalLine.trim();
      if (!line) continue;

      if (line.startsWith('//')) {
        const comment = line.replace(/^\/\//, '').trim();
        const heading = comment.toLowerCase();
        const metadataMatch = comment.match(/^([A-Z_]+)\s+(.+)$/);
        if (metadataMatch) {
          metadata[metadataMatch[1].toLowerCase()] = metadataMatch[2].trim();
        }
        if (heading.includes('commander')) section = 'commander';
        if (heading.includes('deck') || heading.includes('main')) section = 'deck';
        continue;
      }

      const parsed = this.parseCardLine(line);
      if (!parsed) {
        errors.push(`Line ${index + 1}: expected a quantity followed by a card name.`);
        continue;
      }

      const target = section === 'commander' ? commanders : mainboard;
      target.push(parsed);
    }

    if (!commanders.length && mainboard.length) {
      commanders.push(mainboard.shift());
    }

    return {
      name: options.name || 'Imported Deck',
      source: options.source || null,
      commanders,
      mainboard,
      cards: commanders.concat(mainboard),
      metadata,
      errors,
      totalCards: commanders.concat(mainboard).reduce((sum, entry) => sum + entry.quantity, 0)
    };
  }

  parseCardLine(line) {
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) return null;

    const quantity = Number(match[1]);
    let name = match[2].trim();
    name = this.stripExportMetadata(name);
    name = name.replace(/\s+#\S+.*$/, '').trim();

    if (!quantity || !name) return null;
    return { quantity, name };
  }

  stripExportMetadata(value) {
    let name = repairCommonMojibake(String(value).trim());
    name = name.replace(/\s+\*[^*]+\*\s*$/g, '').trim();
    name = name.replace(/\s+\([A-Z0-9]{2,}\)\s+[\w.-]+.*$/i, '').trim();
    return name;
  }
}

function repairCommonMojibake(value) {
  return String(value)
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“|Ã¢â‚¬Â/g, '"')
    .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '-')
    .replace(/Ã…Â/g, 'ō')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú');
}

module.exports = { DeckImporter };
