// How an entity looks (docs/specs/009-elements/entity.md "How it looks"): the band and stripe tints, the
// type face, and the key gutter's glyphs in a 10 by 10 box, stroked. One copy for the canvas (EntityView)
// and the export (svgEntityRows), so the two draw the same thing.

// The band's tint of the border colour when no heading colour is set, and the stripe's of the ink.
export const ENTITY_BAND_TINT = 0.12;
export const ENTITY_STRIPE_TINT = 0.045;
// Types are 10px in the monospace face at this opacity (names are 11px; a primary key's semibold).
export const ENTITY_TYPE_OPACITY = 0.6;
export const ENTITY_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

import type { EntityKey } from './data-shapes';

// A key: the bow on the left, the shaft running right, two teeth.
const KEY = 'M5.1 5 H9.4 M7.6 5 V7 M9.1 5 V6.6 M3 2.9 A2.1 2.1 0 1 0 3 7.1 A2.1 2.1 0 1 0 3 2.9 Z';
// A chain link: two rounded links joined on the diagonal (a foreign key points elsewhere).
const LINK =
  'M4.1 5.9 L5.9 4.1 M4.6 2.9 L5.4 2.1 A1.9 1.9 0 0 1 8.1 4.8 L7.3 5.6 M5.4 7.1 L4.6 7.9 A1.9 1.9 0 0 1 1.9 5.2 L2.7 4.4';
// A U in a rounded square: unique.
const UNIQUE =
  'M2 1.5 H8 A1.5 1.5 0 0 1 9.5 3 V7 A1.5 1.5 0 0 1 8 8.5 H2 A1.5 1.5 0 0 1 0.5 7 V3 A1.5 1.5 0 0 1 2 1.5 Z M3.6 3.4 V5.4 A1.4 1.4 0 0 0 6.4 5.4 V3.4';

export type EntityKeyGlyph = 'key' | 'link' | 'unique';

export const ENTITY_KEY_GLYPH_PATHS: Readonly<Record<EntityKeyGlyph, string>> = {
  key: KEY,
  link: LINK,
  unique: UNIQUE,
};

// A primary key is amber, the colour every database tool gives it, on any paper; the others take the
// row's own ink, muted.
export const ENTITY_PRIMARY_KEY_INK = '#f59e0b';
export const ENTITY_KEY_GLYPH_STROKE = 1.3;
// Drawn size of one glyph in px, and the step between the two glyphs of a PK FK pair.
export const ENTITY_KEY_GLYPH_PX = 10;
export const ENTITY_KEY_GLYPH_STEP_PX = 10;

// What a key draws, left to right.
export function entityKeyGlyphs(key: EntityKey): readonly EntityKeyGlyph[] {
  switch (key) {
    case 'pk':
      return ['key'];
    case 'fk':
      return ['link'];
    case 'pk-fk':
      return ['key', 'link'];
    case 'uk':
      return ['unique'];
  }
}
