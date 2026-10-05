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
