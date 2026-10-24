// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set four of a tab's existing
// settings at once, its theme, finish, tab font and canvas pattern. Not a stored concept: picking one writes those
// four ordinary fields, and a look reads as selected only while the tab still matches all four.
import {
  resolveFinish,
  type BackgroundPattern,
  type Finish,
  type Tab,
} from '@livediagram/document';
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
  /** A font id (../packages/document-core/src/fonts.ts), or undefined for no tab font. */
  font: string | undefined;
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
    description: 'Default colours, Flexible, grid',
    theme: 'brand',
    finish: 'flexible',
    font: undefined,
    pattern: 'grid',
  },
  {
    id: 'textbook',
    label: 'Textbook',
    description: 'UML, Professional, Oswald, graph',
    theme: 'uml',
    finish: 'professional',
    font: 'oswald',
    pattern: 'graph',
    patternOpacity: 0.5,
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    description: 'Mono, Marker, plain white',
    theme: 'mono',
    // A whiteboard is drawn in marker; its letters in Permanent Marker itself.
    finish: 'marker',
    font: undefined,
    pattern: 'blank',
  },
  {
    id: 'spectrum',
    label: 'Spectrum',
    description: 'Rainbow, Flexible, Inter, soft dots',
    theme: 'rainbow',
    finish: 'flexible',
    font: 'inter',
    pattern: 'grid',
    patternOpacity: 0.5,
  },
  {
    id: 'boardroom',
    label: 'Boardroom',
    description: 'Steel, Professional, Inter',
    theme: 'steel',
    finish: 'professional',
    font: 'inter',
    pattern: 'blank',
  },
  {
    id: 'notebook',
    label: 'Notebook',
    description: 'Mocha, Sketch, lined paper',
    theme: 'mocha',
    finish: 'sketch',
    font: undefined,
    pattern: 'lines',
  },
  {
    id: 'seaside',
    label: 'Seaside',
    description: 'Ocean, Flexible, Nunito, waves',
    theme: 'ocean',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'waves',
  },
  {
    id: 'doodle',
    label: 'Doodle',
    description: 'Rainbow, Sketch, Caveat, plain paper',
    theme: 'rainbow',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'blank',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Cream, Professional, Lora serif',
    theme: 'cream',
    finish: 'professional',
    font: 'lora',
    pattern: 'blank',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Midnight, Flexible, grid',
    theme: 'midnight',
    finish: 'flexible',
    font: undefined,
    pattern: 'grid',
  },
  {
    id: 'poster',
    label: 'Poster',
    description: 'Tropical, Professional, Abril, diagonal',
    theme: 'tropical',
    finish: 'professional',
    font: 'abril-fatface',
    pattern: 'diagonal',
    patternOpacity: 0.4,
  },
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Sand, Marker, soft grid',
    theme: 'sand',
    finish: 'marker',
    // Marker letters in Permanent Marker itself.
    font: undefined,
    pattern: 'grid',
    patternOpacity: 0.6,
  },
  {
    id: 'graph-paper',
    label: 'Graph Paper',
    description: 'Indigo, Professional, mono type',
    theme: 'indigo',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'graph',
  },
  {
    id: 'daydream',
    label: 'Daydream',
    description: 'Pastel, Flexible, Nunito, dotted paper',
    theme: 'pastel',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'grid',
    patternOpacity: 0.6,
  },
  {
    id: 'engineer',
    label: 'Engineer',
    description: 'Sky, Professional, engineering grid',
    theme: 'sky',
    finish: 'professional',
    font: 'space-grotesk',
    pattern: 'engineering',
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    description: 'Tropical, Flexible, Space Grotesk, ripples',
    theme: 'tropical',
    finish: 'flexible',
    font: 'space-grotesk',
    pattern: 'ripple',
    patternOpacity: 0.5,
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Lavender, Professional, slab serif',
    theme: 'lavender',
    finish: 'professional',
    font: 'roboto-slab',
    pattern: 'isometric',
  },
  {
    id: 'garden',
    label: 'Garden',
    description: 'Forest, Flexible, Poppins, hexagons',
    theme: 'forest',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'hexagonal',
    patternOpacity: 0.4,
  },
  {
    id: 'billboard',
    label: 'Billboard',
    description: 'Sunset, Professional, Oswald, stripes',
    theme: 'sunset',
    finish: 'professional',
    font: 'oswald',
    pattern: 'stripes',
    patternOpacity: 0.4,
  },
  {
    id: 'patchwork',
    label: 'Patchwork',
    description: 'Pastel, Sketch, Lora, soft checks',
    theme: 'pastel',
    finish: 'sketch',
    font: 'lora',
    pattern: 'checkerboard',
    patternOpacity: 0.3,
  },
  {
    id: 'northern-lights',
    label: 'Northern Lights',
    description: 'Abyss, Flexible, Poppins, aurora',
    theme: 'abyss',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'aurora',
    patternOpacity: 0.6,
  },
  {
    id: 'coffeehouse',
    label: 'Coffeehouse',
    description: 'Espresso, Sketch, Caveat, bricks',
    theme: 'espresso',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'bricks',
    patternOpacity: 0.4,
  },
  {
    id: 'schematic',
    label: 'Schematic',
    description: 'UML, Professional, Roboto Mono, crosshatch',
    theme: 'uml',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'crosshatch',
    patternOpacity: 0.4,
  },
  // The fifth page: Marker on a flip chart, a green board and a wall, between Sketch and Flexible looks.
  {
    id: 'flipchart',
    label: 'Flipchart',
    description: 'Rainbow, Marker, ruled pad',
    theme: 'rainbow',
    finish: 'marker',
    // Marker letters in Permanent Marker itself.
    font: undefined,
    pattern: 'lines',
    patternOpacity: 0.5,
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
    description: 'Pastel, Flexible, Poppins, gingham',
    theme: 'pastel',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'checkerboard',
    patternOpacity: 0.25,
  },
  {
    id: 'mural',
    label: 'Mural',
    description: 'Plum, Marker, soft dots',
    theme: 'plum',
    finish: 'marker',
    font: undefined,
    pattern: 'grid',
    patternOpacity: 0.5,
  },
  {
    id: 'field-notes',
    label: 'Field Notes',
    description: 'Olive, Sketch, lined paper',
    theme: 'olive',
    finish: 'sketch',
    font: undefined,
    pattern: 'lines',
    patternOpacity: 0.6,
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
 *  no font, the grid. A pattern's strength counts only for a look that sets one (a template's softened grid is still
 *  Everyday). */
export function lookMatches(tab: LookSettings, look: TabLook): boolean {
  const opacity = tab.backgroundOpacity ?? 1;
  return (
    look.theme === (tab.theme ?? 'brand') &&
    look.finish === resolveFinish(tab.finish, undefined) &&
    look.font === (tab.font || undefined) &&
    look.pattern === (tab.backgroundPattern ?? 'grid') &&
    (look.patternOpacity === undefined || Math.abs(look.patternOpacity - opacity) < 0.001)
  );
}

/** The look the tab's settings match, or undefined when it has its own mix. */
export function activeLookId(tab: LookSettings): TabLookId | undefined {
  return ALL_LOOKS.find((l) => lookMatches(tab, l))?.id;
}
