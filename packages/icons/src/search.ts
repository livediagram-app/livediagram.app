// Icon search over the line-art and Technology catalogues (docs/specs/015-api/blueprints/cli.md CLI74): ranked by
// paletteRank over each icon's label and keywords, ties in catalogue order, line art first. Imports the catalogue
// data, so it is its own subpath, as `resolve` is.

import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';
import { paletteRank } from './search-rank';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

export const ICON_SEARCH_MAX_LIMIT = 50;
export const ICON_QUERY_MAX = 60;

export type IconSet = 'line' | 'technology';
export type IconHit = { id: string; label: string; set: IconSet };

const CATALOGUE: readonly (IconHit & { keywords: string })[] = [
  ...[...ICON_CATALOG_1, ...ICON_CATALOG_2].map((i) => ({
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

// The best `limit` icons for a query, and how many more matched.
export function searchIcons(query: string, limit: number): { icons: IconHit[]; more: number } {
  const ranked = CATALOGUE.map((icon, order) => ({
    icon,
    order,
    rank: paletteRank(query, { name: icon.label, keywords: icon.keywords }),
  }))
    .filter((r) => r.rank < 4)
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
