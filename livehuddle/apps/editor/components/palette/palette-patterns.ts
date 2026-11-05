import {
  spacePattern,
  type BackgroundPattern,
  type FloorPattern,
  type SeasonalBackgroundPattern,
} from '@livehuddle/document';

// The Canvas panel's floors (docs/specs/011-theme/floors.md): None, then each floor, indoor first. Pure data: the
// picker (CanvasStyleControls, PatternCarousel) has no hard-coded ids, so a floor slots in by editing this list and
// the drawing in lib/floor-tiles.ts. Each tile in the picker is the floor itself, drawn on the tab's canvas colour.
export type PatternEntry = {
  id: FloorPattern | 'blank';
  label: string;
  shortLabel: string;
  description: string;
};

export const PATTERNS: PatternEntry[] = [
  {
    id: 'blank',
    label: 'None',
    shortLabel: 'None',
    description: 'No floor: just the canvas colour.',
  },
  {
    id: 'carpet',
    label: 'Carpet',
    shortLabel: 'Carpet',
    description: 'Soft flecked carpet, for lounges and quiet rooms.',
  },
  {
    id: 'carpet-tiles',
    label: 'Carpet Tiles',
    shortLabel: 'Carpet Tiles',
    description: 'Office carpet tiles, the pile turned on every other one.',
  },
  {
    id: 'wood',
    label: 'Wood Floor',
    shortLabel: 'Wood',
    description: 'Oak planks in staggered rows.',
  },
  {
    id: 'parquet',
    label: 'Parquet',
    shortLabel: 'Parquet',
    description: 'Wooden blocks laid in a basketweave.',
  },
  {
    id: 'tiles',
    label: 'Tiles',
    shortLabel: 'Tiles',
    description: 'Square ceramic tiles on fine grout.',
  },
  {
    id: 'marble',
    label: 'Marble',
    shortLabel: 'Marble',
    description: 'Veined marble slabs, for a lobby or a hall.',
  },
  {
    id: 'terrazzo',
    label: 'Terrazzo',
    shortLabel: 'Terrazzo',
    description: 'Chips of stone set in a pale floor.',
  },
  {
    id: 'concrete',
    label: 'Concrete',
    shortLabel: 'Concrete',
    description: 'Polished concrete slabs with saw-cut joints.',
  },
  {
    id: 'deck',
    label: 'Decking',
    shortLabel: 'Decking',
    description: 'Outdoor boards with gaps between them.',
  },
  {
    id: 'paving',
    label: 'Stone Paving',
    shortLabel: 'Paving',
    description: 'Flagstones of mixed sizes, for a terrace or a square.',
  },
  {
    id: 'cobbles',
    label: 'Cobbles',
    shortLabel: 'Cobbles',
    description: 'Rounded cobblestones in running rows.',
  },
  {
    id: 'grass',
    label: 'Grass',
    shortLabel: 'Grass',
    description: 'A lawn, for gardens and parks.',
  },
  {
    id: 'sand',
    label: 'Sand',
    shortLabel: 'Sand',
    description: 'Wind-rippled sand, for a beach.',
  },
  {
    id: 'mud',
    label: 'Mud',
    shortLabel: 'Mud',
    description: 'Bare, trodden earth with a few pebbles.',
  },
];

// The seasonal patterns' names (docs/specs/011-theme/canvas-and-theme-dialog.md "Seasonal looks"). They are not in
// PATTERNS because no picker lists them; a tab wears one only through a seasonal look, and its name still shows on
// the Canvas row and the look's card.
const SEASONAL_PATTERN_LABELS: Record<SeasonalBackgroundPattern, string> = {
  sparkles: 'Sparkles',
  eggs: 'Eggs',
  cobwebs: 'Cobwebs',
  snowflakes: 'Snowflakes',
  'candy-stripes': 'Candy Stripes',
};

/** A pattern's display name: a floor's, None, or a seasonal motif's. A retired diagram pattern is named as the floor
 *  it draws as. */
export function patternLabel(id: BackgroundPattern): string {
  const drawn = spacePattern(id);
  return (
    PATTERNS.find((p) => p.id === drawn)?.label ??
    (SEASONAL_PATTERN_LABELS as Record<string, string>)[drawn] ??
    drawn
  );
}
