const { WizardsDecklistFetcher } = require('./WizardsDecklistFetcher');

const SITEMAP_URL = 'https://magic.wizards.com/sitemap.xml';

class WizardsDeckSearch {
  constructor(options = {}) {
    this.fetchTimeoutMs = Number(options.fetchTimeoutMs || 12000);
  }

  async search(query, options = {}) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return [];

    const limit = Number(options.limit || 10);
    const sitemap = await this.fetchSitemap();
    const urls = this.extractUrls(sitemap)
      .filter((url) => url.includes('/en/news/'))
      .filter((url) => /decklists?|commander|challenger|starter|jumpstart|precon/i.test(url));

    const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = urls
      .map((url) => ({ url, score: scoreUrl(url, terms) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const fetcher = new WizardsDecklistFetcher({ fetchTimeoutMs: this.fetchTimeoutMs, logger: { info() {} } });
    const enriched = [];
    for (const result of scored) {
      const html = await fetcher.fetchPage(result.url);
      const deckBlocks = fetcher.extractDeckBlocks(html);
      enriched.push({
        url: result.url,
        title: extractTitle(html) || titleFromUrl(result.url),
        deckCount: deckBlocks.length,
        deckTitles: deckBlocks.map((deck) => deck.title)
      });
    }

    return enriched.filter((result) => result.deckCount > 0);
  }

  async fetchSitemap() {
    const response = await fetchWithTimeout(SITEMAP_URL, { timeoutMs: this.fetchTimeoutMs });
    if (!response.ok) {
      throw new Error(`Failed to fetch Wizards sitemap: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  extractUrls(xml) {
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => decodeXml(match[1]));
  }
}

function scoreUrl(url, terms) {
  const haystack = decodeURIComponent(url).toLowerCase().replace(/[-_/]+/g, ' ');
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += term.length;
  }
  if (haystack.includes('decklist')) score += 10;
  if (haystack.includes('commander')) score += 8;
  if (haystack.includes('/announcements/')) score += 3;
  return score;
}

function extractTitle(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanText(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return cleanText(title[1]).replace(/\s*\|\s*Magic: The Gathering.*$/i, '');
  return '';
}

function titleFromUrl(url) {
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || url;
  return slug.replace(/-/g, ' ');
}

function cleanText(value) {
  return decodeXml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timed out fetching ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { WizardsDeckSearch };
