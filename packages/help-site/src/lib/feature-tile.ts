import { topCategorySlug } from '@liveworkspace/help-registry';
import type { CSSProperties, ReactNode } from 'react';
import type { HelpArt } from '../types';

// A feature's hue and glyph (docs/specs/018-help/help-app.md): the home and features grids, the category
// indexes and the MDX <Feature> cards tint each feature with a distinct hue, so the index reads as a colourful
// catalogue. The hues and glyphs are the product's (its lib/featureColours.ts and lib/featureIcons.tsx); the
// lookup and the tile's paint are the same for every product.

/** The hue a feature without one of its own, in a category without one, falls back to: slate-500. */
export const FEATURE_FALLBACK_HEX = '#64748b';

/** A feature's hue: its own, else its top-level category's, else the fallback. */
export function featureColour(art: HelpArt, slug: string, categorySlug?: string): string {
  return (
    art.featureHex[slug] ??
    art.categoryHex[topCategorySlug(categorySlug ?? '')] ??
    FEATURE_FALLBACK_HEX
  );
}

/** A feature's glyph: its own, else its top-level category's, else the product's fallback glyph. */
export function featureIcon(art: HelpArt, slug: string, categorySlug?: string): ReactNode {
  return (
    art.featureIcons[slug] ??
    art.categoryIcons[topCategorySlug(categorySlug ?? '')] ??
    art.featureFallback
  );
}

/** A feature card's icon tile: the hue at 12% behind a glyph in the hue. In dark mode the glyph
 *  lifts toward white, so the muted hues (slate, indigo) still read on a dark card. */
export const FEATURE_TILE_CLASS =
  'text-(--feature) dark:text-[color-mix(in_oklab,var(--feature)_70%,white)]';

export function featureTileStyle(colour: string): CSSProperties {
  return { backgroundColor: `${colour}1f`, '--feature': colour } as CSSProperties;
}
