// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set four of a tab's existing
// settings at once, its theme, finish, tab font and canvas pattern. Not a stored concept: picking one writes those
// four ordinary fields, and a look reads as selected only while the tab still matches all four.
import {
  resolveFinish,
  spacePattern,
  type BackgroundPattern,
  type Finish,
  type Tab,
} from '@livehuddle/document';
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
  /** A seasonal look's season (lib/seasonal-looks.ts); unset on the year-round looks. */
  season?: Season;
};

/** The looks, in the order the dialog shows them after the Mashup card: with it, four carousel pages of six.
 *  Everyday stays first; the rest are in a fixed, interleaved order (never shuffled at runtime) that puts two
 *  multi-colour looks (Rainbow, Pastel, Tropical, UML) on every page and never sets two neighbours on a page in the
 *  same theme or finish. */
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
    label: 'Textbook',
    description: 'UML, Professional, Oswald, tiles',
    theme: 'uml',
    finish: 'professional',
    font: 'oswald',
    pattern: 'tiles',
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    description: 'Mono, Marker, plain white',
    theme: 'mono',
    // A whiteboard is drawn in marker; its letters in Shantell Sans itself.
    finish: 'marker',
    font: undefined,
    pattern: 'blank',
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
    label: 'Notebook',
    description: 'Mocha, Sketch, wood floor',
    theme: 'mocha',
    finish: 'sketch',
    font: undefined,
    pattern: 'wood',
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
    label: 'Doodle',
    description: 'Rainbow, Sketch, Kalam, plain paper',
    theme: 'rainbow',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'blank',
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
    label: 'Graph Paper',
    description: 'Indigo, Professional, Roboto Mono, tiles',
    theme: 'indigo',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'tiles',
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
    description: 'UML, Professional, Roboto Mono, carpet tiles',
    theme: 'uml',
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
    label: 'Sketchbook',
    description: 'Rose, Sketch, plain paper',
    theme: 'rose',
    finish: 'sketch',
    font: undefined,
    pattern: 'blank',
  },
  {
    id: 'greenboard',
    label: 'Greenboard',
    description: 'Pine, Marker, a green board',
    theme: 'pine',
    finish: 'marker',
    font: undefined,
    pattern: 'blank',
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
    label: 'Field Notes',
    description: 'Olive, Sketch, mud',
    theme: 'olive',
    finish: 'sketch',
    font: undefined,
    pattern: 'mud',
  },
];

/** How many looks one carousel page holds. */
export const LOOKS_PER_PAGE = 6;

// Every named look, year-round and seasonal: a tab wearing a seasonal look reads as that look too.
const ALL_LOOKS: readonly TabLook[] = [...TAB_LOOKS, ...SEASONAL_LOOKS];

export function tabLookById(id: string): TabLook | undefined {
  return ALL_LOOKS.find((l) => l.id === id);
}

/** The tab with a look applied: the theme exactly as picking it does, then the finish, font and pattern. */
export function withLookApplied(tab: Tab, look: TabLook): Tab {
  const themed = withThemeApplied(tab, look.theme);
  const next: Tab = { ...themed, finish: look.finish, backgroundPattern: look.pattern };
  // A look that sets a strength sets it; the rest leave the tab's own strength alone.
  if (look.patternOpacity !== undefined) next.backgroundOpacity = look.patternOpacity;
  if (look.font) next.font = look.font;
  else delete next.font;
  return next;
}

/** The four settings a look sets, as a tab holds them. */
export type LookSettings = Pick<
  Tab,
  'theme' | 'finish' | 'font' | 'backgroundPattern' | 'backgroundOpacity'
>;

/** Whether the tab's settings are the look's. Unset settings read as what they draw: the Default theme, Flexible,
 *  no font, the theme's floor (a retired diagram pattern reads as the floor it draws as). A pattern's strength counts only for a look that sets one (a template's softened grid is still
 *  Everyday). */
export function lookMatches(tab: LookSettings, look: TabLook): boolean {
  const opacity = tab.backgroundOpacity ?? 1;
  return (
    look.theme === (tab.theme ?? 'brand') &&
    look.finish === resolveFinish(tab.finish, undefined) &&
    look.font === (tab.font || undefined) &&
    spacePattern(look.pattern) === spacePattern(tab.backgroundPattern) &&
    (look.patternOpacity === undefined || Math.abs(look.patternOpacity - opacity) < 0.001)
  );
}

/** The look the tab's settings match, or undefined when it has its own mix. */
export function activeLookId(tab: LookSettings): TabLookId | undefined {
  return ALL_LOOKS.find((l) => lookMatches(tab, l))?.id;
}
