// Icon search over the line-art and Technology catalogues (docs/specs/015-api/blueprints/cli.md CLI74): ranked by
// paletteRank over each icon's label and keywords, ties in catalogue order, line art first. Imports the catalogue
// data, so it is its own subpath, as `resolve` is.

import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';
import { ICON_CATALOG_3 } from './icon-catalog-3';
import { paletteRank } from './search-rank';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

export const ICON_SEARCH_MAX_LIMIT = 50;
export const ICON_QUERY_MAX = 60;

export type IconSet = 'line' | 'technology';
export type IconHit = { id: string; label: string; set: IconSet };

const CATALOGUE: readonly (IconHit & { keywords: string })[] = [
  ...[...ICON_CATALOG_1, ...ICON_CATALOG_2, ...ICON_CATALOG_3].map((i) => ({
    id: i.id,
    label: i.label,
    keywords: i.keywords,
    set: 'line' as const,
  })),
  ...TECH_ICON_CATALOG.map((i) => ({
    id: i.id,
    label: i.label,
    keywords: i.keywords,
    set: 'technology' as const,
  })),
];

// Words a query carries that say nothing about the picture.
const FILLER = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'icon', 'logo', 'symbol']);
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const wordsOf = (q: string) =>
  q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));

// How well an icon answers a query, lower first; 7 or more is no match. The whole query ranks as the palette ranks
// it (0 to 3); then spacing aside ("route53" for Route 53, 3.5); then icons holding every word of a several-word
// query (4), then most of its words (5 to 6, by how many are missing), so "mobile phone" and "credit card" find
// what one word would.
function iconRank(query: string, icon: { label: string; keywords: string }): number {
  const whole = paletteRank(query, { name: icon.label, keywords: icon.keywords });
  if (whole < 4) return whole;
  const hay = `${icon.label} ${icon.keywords}`.toLowerCase();
  const needle = compact(query);
  if (needle.length > 2 && compact(icon.label).includes(needle)) return 3.5;
  const words = wordsOf(query);
  if (words.length < 2) return needle.length > 2 && compact(hay).includes(needle) ? 3.6 : 7;
  // A word counts where a word of the icon starts with it ("lock" is not in "clock", "load" not in "download").
  const hayWords = hay.split(/[^a-z0-9]+/);
  const has = (w: string) => hayWords.some((h) => h.startsWith(w));
  const found = words.filter((w) => has(w) || (w.endsWith('s') && has(w.slice(0, -1))));
  if (found.length === words.length) return 4;
  if (found.length === 0) return 7;
  return 5 + (words.length - found.length) / words.length;
}

// The best `limit` icons for a query, and how many more matched.
export function searchIcons(query: string, limit: number): { icons: IconHit[]; more: number } {
  const ranked = CATALOGUE.map((icon, order) => ({ icon, order, rank: iconRank(query, icon) }))
    .filter((r) => r.rank < 7)
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
  return {
    icons: ranked
      .slice(0, limit)
      .map(({ icon }) => ({ id: icon.id, label: icon.label, set: icon.set })),
    more: Math.max(0, ranked.length - limit),
  };
}

const KNOWN = new Set(CATALOGUE.map((i) => i.id));

/** Whether an id names an icon of the line-art or Technology catalogues. */
export function isIconId(id: string): boolean {
  return KNOWN.has(id);
}

/** Icons like an id that is not one (`flame` → fire, `book-open` → book, ...): the id read as words,
 *  then each word on its own, best first. For a refusal that teaches the next try. */
export function iconsLike(id: string, limit = 6): IconHit[] {
  const words = id
    .toLowerCase()
    .replace(/[-_.]+/g, ' ')
    .trim()
    .slice(0, ICON_QUERY_MAX);
  if (!words) return [];
  const seen = new Set<string>();
  const out: IconHit[] = [];
  for (const query of [words, ...words.split(' ').filter((w) => w.length > 2)]) {
    for (const hit of searchIcons(query, limit).icons) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      out.push(hit);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
