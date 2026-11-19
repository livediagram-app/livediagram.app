// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): shortcuts that set four of a tab's existing
// settings at once, its theme, finish, tab font and canvas pattern. Not a stored concept: picking one writes those
// four ordinary fields, and a look reads as selected only while the tab still matches all four.
import { type BackgroundPattern, type Finish, type Tab } from '@liveplanner/project';
import { createTabLooks } from '@liveworkspace/workbench/lib/tab-looks';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { SEASONAL_LOOKS, type Season } from '@liveworkspace/workbench/lib/seasonal-looks';

export type TabLookId =
  | 'everyday'
  | 'crown-jewels'
  | 'stand-up'
  | 'whiteboard'
  | 'spectrum'
  | 'terracotta'
  | 'boardroom'
  | 'doodle'
  | 'quayside'
  | 'editorial'
  | 'sweet-shop'
  | 'northern-lights'
  | 'poster'
  | 'notebook'
  | 'daydream'
  | 'graph-paper'
  | 'regatta'
  | 'lagoon'
  | 'quarterly'
  | 'gallery'
  | 'midnight'
  | 'flipchart'
  | 'textbook'
  | 'workshop'
  | 'allotment'
  | 'gelato'
  | 'greenboard'
  | 'night-shift'
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
  /** A built-in theme id (packages/project/src/themes-data.ts). */
  theme: string;
  finish: Finish;
  /** A font id (../packages/model-core/src/fonts.ts), or undefined for no tab font. */
  font: string | undefined;
  pattern: BackgroundPattern;
  /** The pattern's strength, the tab's existing backgroundOpacity (1 when omitted): a busy pattern drawn softly. */
  patternOpacity?: number;
  /** A seasonal look's season (lib/seasonal-looks.ts); unset on the year-round looks. */
  season?: Season;
};

/** The looks, in the order the dialog shows them after the Mashup card: with it, five carousel pages of six.
 *  Multi-colour looks are the majority (nineteen of twenty-nine): on a multi-colour theme each board column takes its
 *  own colour, which is usually the better look on a planner. Ten strong single-colour looks stay, Everyday first.
 *  After Everyday the rest are in a fixed, interleaved order (never shuffled at runtime) that puts three
 *  multi-colour looks on page one (the Mashup card and Everyday take two of its places) and four on every other page,
 *  and never sets two neighbours on a page in the same theme or finish. Canvases stay calm (boards are see-through and
 *  sheets sit on the canvas): blank, soft grids, lines and graph paper, and one softened animated look, Northern
 *  Lights. Textbook wears Mono: UML is retired here. */
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
    id: 'crown-jewels',
    label: 'Crown Jewels',
    description: 'Gemstone, Professional, Oswald, plain',
    theme: 'gemstone',
    finish: 'professional',
    font: 'oswald',
    pattern: 'blank',
  },
  {
    id: 'stand-up',
    label: 'Stand-up',
    description: 'Office, Flexible, Inter, soft dots',
    theme: 'office',
    finish: 'flexible',
    font: 'inter',
    pattern: 'grid',
    patternOpacity: 0.5,
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    description: 'Mono, Marker, plain white',
    theme: 'mono',
    finish: 'marker',
    // A whiteboard is drawn in marker; its letters in Shantell Sans itself.
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
  // Page two.
  {
    id: 'terracotta',
    label: 'Terracotta',
    description: 'Earth, Flexible, Poppins, soft dots',
    theme: 'earth',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'grid',
    patternOpacity: 0.4,
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
    id: 'doodle',
    label: 'Doodle',
    description: 'Rainbow, Sketch, Kalam, plain paper',
    theme: 'rainbow',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'blank',
  },
  {
    id: 'quayside',
    label: 'Quayside',
    description: 'Harbour, Flexible, Nunito, soft lines',
    theme: 'harbour',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'lines',
    patternOpacity: 0.4,
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
    id: 'sweet-shop',
    label: 'Sweet Shop',
    description: 'Sorbet, Sketch, Kalam, soft dots',
    theme: 'sorbet',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'grid',
    patternOpacity: 0.4,
  },
  // Page three.
  {
    id: 'northern-lights',
    label: 'Northern Lights',
    description: 'Nightfall, Flexible, Poppins, soft aurora',
    theme: 'nightfall',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'aurora',
    patternOpacity: 0.35,
  },
  {
    id: 'poster',
    label: 'Poster',
    description: 'Tropical, Professional, Bodoni, plain',
    theme: 'tropical',
    finish: 'professional',
    font: 'abril-fatface',
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
    id: 'graph-paper',
    label: 'Graph Paper',
    description: 'Indigo, Professional, mono type',
    theme: 'indigo',
    finish: 'professional',
    font: 'roboto-mono',
    pattern: 'graph',
  },
  {
    id: 'regatta',
    label: 'Regatta',
    description: 'Harbour, Marker, plain white',
    theme: 'harbour',
    finish: 'marker',
    // Marker letters in Shantell Sans itself.
    font: undefined,
    pattern: 'blank',
  },
  // Page four.
  {
    id: 'lagoon',
    label: 'Lagoon',
    description: 'Tropical, Flexible, Space Grotesk, soft dots',
    theme: 'tropical',
    finish: 'flexible',
    font: 'space-grotesk',
    pattern: 'grid',
    patternOpacity: 0.4,
  },
  {
    id: 'quarterly',
    label: 'Quarterly',
    description: 'Office, Professional, slab serif',
    theme: 'office',
    finish: 'professional',
    font: 'roboto-slab',
    pattern: 'blank',
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Gemstone, Sketch, Lora, plain paper',
    theme: 'gemstone',
    finish: 'sketch',
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
    id: 'flipchart',
    label: 'Flipchart',
    description: 'Rainbow, Marker, ruled pad',
    theme: 'rainbow',
    finish: 'marker',
    // Marker letters in Shantell Sans itself.
    font: undefined,
    pattern: 'lines',
    patternOpacity: 0.5,
  },
  {
    id: 'textbook',
    label: 'Textbook',
    description: 'Mono, Professional, Oswald, graph',
    theme: 'mono',
    finish: 'professional',
    font: 'oswald',
    pattern: 'graph',
    patternOpacity: 0.5,
  },
  // Page five.
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Office, Marker, soft grid',
    theme: 'office',
    finish: 'marker',
    // Marker letters in Shantell Sans itself.
    font: undefined,
    pattern: 'grid',
    patternOpacity: 0.6,
  },
  {
    id: 'allotment',
    label: 'Allotment',
    description: 'Earth, Sketch, Kalam, lined paper',
    theme: 'earth',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'lines',
    patternOpacity: 0.5,
  },
  {
    id: 'gelato',
    label: 'Gelato',
    description: 'Sorbet, Flexible, Poppins, plain',
    theme: 'sorbet',
    finish: 'flexible',
    font: 'poppins',
    pattern: 'blank',
  },
  {
    id: 'greenboard',
    label: 'Greenboard',
    description: 'Pine, Marker, a green board',
    theme: 'pine',
    finish: 'marker',
    // Marker letters in Shantell Sans itself.
    font: undefined,
    pattern: 'blank',
  },
  {
    id: 'night-shift',
    label: 'Night Shift',
    description: 'Nightfall, Professional, Space Grotesk, soft grid',
    theme: 'nightfall',
    finish: 'professional',
    font: 'space-grotesk',
    pattern: 'grid',
    patternOpacity: 0.4,
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

export { LOOKS_PER_PAGE } from '@liveworkspace/workbench/lib/tab-looks';

/** The four settings a look sets, as a tab holds them. */
export type LookSettings = Pick<
  Tab,
  'theme' | 'finish' | 'font' | 'backgroundPattern' | 'backgroundOpacity'
>;

// The lookup, apply and match are the shared ones (@liveworkspace/workbench/lib/tab-looks), over every named look,
// year-round and seasonal: a tab wearing a seasonal look reads as that look too.
export const { tabLookById, withLookApplied, lookMatches, activeLookId } = createTabLooks<
  Tab,
  TabLook
>({
  looks: [...TAB_LOOKS, ...SEASONAL_LOOKS],
  withThemeApplied,
});
