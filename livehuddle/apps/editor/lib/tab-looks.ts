// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set four of a tab's existing
// settings at once, its theme, finish, tab font and canvas pattern. Not a stored concept: picking one writes those
// four ordinary fields, and a look reads as selected only while the tab still matches all four.
import { spacePattern, type BackgroundPattern, type Finish, type Tab } from '@livehuddle/document';
import { createTabLooks } from '@liveworkspace/workbench/lib/tab-looks';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { SEASONAL_LOOKS, type Season } from '@/lib/seasonal-looks';

export type TabLookId =
  | 'everyday'
  | 'whiteboard'
  | 'graph-paper'
  | 'boardroom'
  | 'notebook'
  | 'midnight'
  | 'seaside'
  | 'editorial'
  | 'engineer'
  | 'workshop'
  | 'garden'
  | 'studio'
  | 'spectrum'
  | 'doodle'
  | 'daydream'
  | 'lagoon'
  | 'textbook'
  | 'poster'
  | 'billboard'
  | 'patchwork'
  | 'northern-lights'
  | 'coffeehouse'
  | 'schematic'
  | 'flipchart'
  | 'sketchbook'
  | 'greenboard'
  | 'picnic'
  | 'mural'
  | 'field-notes'
  // Seasonal looks (lib/seasonal-looks.ts): shown only behind the carousel's Seasonal toggle.
  | 'countdown'
  | 'egg-hunt'
  | 'haunted'
  | 'christmas-morning'
  | 'winter-wonderland'
  | 'fireside'
  // The Mashup card's random look (lib/look-mashup.ts): never in TAB_LOOKS, so never an activeLookId answer.
  | 'mashup';

export type TabLook = {
  id: TabLookId;
  label: string;
  /** One line under the name on its card. */
  description: string;
  /** A built-in theme id (packages/document/src/themes-data.ts). */
  theme: string;
  finish: Finish;
  /** A font id (../packages/model-core/src/fonts.ts), or undefined for no tab font. */
  font: string | undefined;
  /** The floor (docs/specs/011-theme/floors.md), None, or a seasonal look's motif. */
  pattern: BackgroundPattern;
  /** The pattern's strength, the tab's existing backgroundOpacity (1 when omitted): a busy pattern drawn softly. */
  patternOpacity?: number;
  /** The 3D view's walls (docs/specs/008-canvas/3d-view.md "Themes"); unset puts the plaster back. Not matched on. */
  wallColor?: string;
  /** A seasonal look's season (lib/seasonal-looks.ts); unset on the year-round looks. */
  season?: Season;
};

/** The looks, in the order the dialog shows them after the Mashup card: with it, four carousel pages of six.
 *  Everyday stays first; the rest are in a fixed, interleaved order (never shuffled at runtime) that puts one or two
 *  of the eight multi-colour looks (Rainbow, Pastel, Tropical) on every page and never sets two neighbours on a
 *  page in the same theme or finish. Textbook and Schematic wear Mono: UML is retired here. */
export const TAB_LOOKS: readonly TabLook[] = [
  {
    id: 'everyday',
    label: 'Everyday',
    description: 'Default colours, Flexible, carpet tiles',
    theme: 'brand',
    finish: 'flexible',
    font: undefined,
    pattern: 'carpet-tiles',
  },
  {
    id: 'textbook',
    label: 'Gallery',
    description: 'Mono, Professional, Oswald, white tiles, white walls',
    theme: 'mono',
    finish: 'professional',
    font: 'oswald',
    pattern: 'tiles',
    wallColor: '#f5f5f4',
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    description: 'Rainbow, Flexible, Inter, terrazzo',
    theme: 'rainbow',
    finish: 'flexible',
    font: 'inter',
    pattern: 'terrazzo',
  },
  {
    id: 'whiteboard',
    label: 'Meeting Room',
    description: 'Mono, Marker, carpet tiles, grey walls',
    theme: 'mono',
    // A whiteboard is drawn in marker; its letters in Shantell Sans itself.
    finish: 'marker',
    font: undefined,
    pattern: 'carpet-tiles',
    wallColor: '#e5e7eb',
  },
  {
    id: 'boardroom',
    label: 'Boardroom',
    description: 'Steel, Professional, Inter, carpet',
    theme: 'steel',
    finish: 'professional',
    font: 'inter',
    pattern: 'carpet',
  },
  {
    id: 'notebook',
    label: 'Cabin',
    description: 'Mocha, Sketch, wood floor, timber walls',
    theme: 'mocha',
    finish: 'sketch',
    font: undefined,
    pattern: 'wood',
    wallColor: '#d6bc95',
  },
  {
    id: 'seaside',
    label: 'Seaside',
    description: 'Ocean, Flexible, Nunito, sand',
    theme: 'ocean',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'sand',
  },
  {
    id: 'doodle',
    label: 'Playroom',
    description: 'Rainbow, Sketch, Kalam, carpet, apricot walls',
    theme: 'rainbow',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'carpet',
    wallColor: '#f8dcb4',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Cream, Professional, Lora, parquet',
    theme: 'cream',
    finish: 'professional',
    font: 'lora',
    pattern: 'parquet',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Midnight, Flexible, marble',
    theme: 'midnight',
    finish: 'flexible',
    font: undefined,
    pattern: 'marble',
  },
  {
    id: 'poster',
    label: 'Poster',
    description: 'Tropical, Professional, Bodoni, decking',
    theme: 'tropical',
    finish: 'professional',
    font: 'abril-fatface',
    pattern: 'deck',
  },
  {
    id: 'workshop',
    label: 'Sandstone',
    description: 'Sand, Marker, concrete',
    theme: 'sand',
    finish: 'marker',
    // Marker letters in Shantell Sans itself.
    font: undefined,
    pattern: 'concrete',
  },
  {
    id: 'graph-paper',
    label: 'Lab',
    description: 'Indigo, Professional, Roboto Mono, tiles, blue walls',
    theme: 'indigo',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'tiles',
    wallColor: '#dfe6f3',
  },
  {
    id: 'daydream',
    label: 'Daydream',
    description: 'Pastel, Flexible, Nunito, soft carpet',
    theme: 'pastel',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'carpet',
    patternOpacity: 0.7,
  },
  {
    id: 'engineer',
    label: 'Engineer',
    description: 'Sky, Professional, Space Grotesk, concrete',
    theme: 'sky',
    finish: 'professional',
    font: 'space-grotesk',
    pattern: 'concrete',
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    description: 'Tropical, Flexible, Space Grotesk, sand',
    theme: 'tropical',
    finish: 'flexible',
    font: 'space-grotesk',
    pattern: 'sand',
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Lavender, Professional, Roboto Slab, wood floor',
    theme: 'lavender',
    finish: 'professional',
    font: 'roboto-slab',
    pattern: 'wood',
  },
  {
    id: 'garden',
    label: 'Garden',
    description: 'Forest, Flexible, Poppins, grass',
    theme: 'forest',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'grass',
  },
  {
    id: 'billboard',
    label: 'Billboard',
    description: 'Sunset, Professional, Oswald, stone paving',
    theme: 'sunset',
    finish: 'professional',
    font: 'oswald',
    pattern: 'paving',
  },
  {
    id: 'patchwork',
    label: 'Patchwork',
    description: 'Pastel, Sketch, Lora, soft carpet',
    theme: 'pastel',
    finish: 'sketch',
    font: 'lora',
    pattern: 'carpet',
    patternOpacity: 0.7,
  },
  {
    id: 'northern-lights',
    label: 'Northern Lights',
    description: 'Abyss, Flexible, Poppins, decking',
    theme: 'abyss',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'deck',
  },
  {
    id: 'coffeehouse',
    label: 'Coffeehouse',
    description: 'Espresso, Sketch, Kalam, terrazzo',
    theme: 'espresso',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'terrazzo',
  },
  {
    id: 'schematic',
    label: 'Schematic',
    description: 'Mono, Professional, Roboto Mono, carpet tiles',
    theme: 'mono',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'carpet-tiles',
  },
  // The fifth page: Marker on a flip chart, a green board and a wall, between Sketch and Flexible looks.
  {
    id: 'flipchart',
    label: 'Flipchart',
    description: 'Rainbow, Marker, carpet',
    theme: 'rainbow',
    finish: 'marker',
    // Marker letters in Shantell Sans itself.
    font: undefined,
    pattern: 'carpet',
  },
  {
    id: 'sketchbook',
    label: 'Atelier',
    description: 'Rose, Sketch, concrete, blush walls',
    theme: 'rose',
    finish: 'sketch',
    font: undefined,
    pattern: 'concrete',
    wallColor: '#efd9dc',
  },
  {
    id: 'greenboard',
    label: 'Classroom',
    description: 'Pine, Marker, parquet, sage walls',
    theme: 'pine',
    finish: 'marker',
    font: undefined,
    pattern: 'parquet',
    wallColor: '#d3e4d1',
  },
  {
    id: 'picnic',
    label: 'Picnic',
    description: 'Pastel, Flexible, Poppins, grass',
    theme: 'pastel',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'grass',
  },
  {
    id: 'mural',
    label: 'Mural',
    description: 'Plum, Marker, cobbles',
    theme: 'plum',
    finish: 'marker',
    font: undefined,
    pattern: 'cobbles',
  },
  {
    id: 'field-notes',
    label: 'Potting Shed',
    description: 'Olive, Sketch, mud, moss walls',
    theme: 'olive',
    finish: 'sketch',
    font: undefined,
    pattern: 'mud',
    wallColor: '#c9c3a0',
  },
];

export { LOOKS_PER_PAGE } from '@liveworkspace/workbench/lib/tab-looks';

/** The four settings a look sets, as a tab holds them. */
export type LookSettings = Pick<
  Tab,
  'theme' | 'finish' | 'font' | 'backgroundPattern' | 'backgroundOpacity'
>;

// The lookup, apply and match are the shared ones (@liveworkspace/workbench/lib/tab-looks), over every named look,
// year-round and seasonal: a tab wearing a seasonal look reads as that look too.
const shared = createTabLooks<Tab, TabLook>({
  looks: [...TAB_LOOKS, ...SEASONAL_LOOKS],
  withThemeApplied,
  // A pattern matches by the floor it draws as, so a retired diagram pattern reads as the floor it draws.
  samePattern: (look, tab) => spacePattern(look) === spacePattern(tab),
});

export const { tabLookById, lookMatches, activeLookId } = shared;

/** `tab` dressed in `look`: its four settings (the shared apply), then its walls, or the plaster for a look without. */
export function withLookApplied(tab: Tab, look: TabLook): Tab {
  const dressed = shared.withLookApplied(tab, look);
  if (look.wallColor) return { ...dressed, wallColor: look.wallColor };
  if (dressed.wallColor === undefined) return dressed;
  const { wallColor: _plaster, ...rest } = dressed;
  return rest;
}
