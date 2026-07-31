// Sticker catalogue types (spec/116). A sticker is NOT an icon: it is its own
// element kind, with its own catalogue, because the two answer different
// questions. An icon is a glyph you tint and fold into a shape's label; a
// sticker is a thing you slap on the board — die-cut, shadowed, tilted, never
// recoloured by the theme.
//
// Two flavours, and the badge is the reason this can't be an IconDef: a word
// badge carries a word and a tone, not art, and nothing in the icon catalogue
// can express that.

export type StickerTone = 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'teal' | 'pink' | 'slate';

type StickerBase = {
  id: string;
  label: string;
  // Extra search terms beyond the label, so "celebrate" finds the party
  // popper and "wip" finds the IN PROGRESS badge.
  keywords: string;
};

export type StickerDef =
  // A colour emoji on a die-cut white plate.
  | (StickerBase & { kind: 'emoji'; glyph: string })
  // A word on a coloured pill: APPROVED, BLOCKED, WIP. `text` is authored
  // catalogue content, never user input, and renders uppercase.
  | (StickerBase & { kind: 'badge'; text: string; tone: StickerTone });

// The pill colours, one per tone. Fixed hexes rather than theme colours: a
// sticker means the same thing on every board, and a green APPROVED that
// turned violet with the theme would be a worse APPROVED.
export const STICKER_TONE_COLOR: Record<StickerTone, string> = {
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  blue: '#2563eb',
  violet: '#7c3aed',
  teal: '#0d9488',
  pink: '#db2777',
  slate: '#475569',
};

// The natural aspect ratio of each flavour, used for the default drop size and
// the palette tile. An emoji sticker is square; a badge is a wide pill.
export const STICKER_ASPECT = { emoji: 1, badge: 2.5 } as const;
