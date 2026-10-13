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
  /** A font id (packages/document/src/fonts.ts), or undefined for no tab font. */
  font: string | undefined;
  pattern: BackgroundPattern;
  /** The pattern's strength, the tab's existing backgroundOpacity (1 when omitted): a busy pattern drawn softly. */
  patternOpacity?: number;
};

/** The looks, in the order the dialog shows them: three carousel pages of six. Everyday stays first; the rest are in
 *  a fixed, interleaved order (never shuffled at runtime) that puts two multi-colour looks (Rainbow, Pastel, Tropical,
 *  UML) on every page and never sets two neighbours on a page in the same theme or finish. */
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
    description: 'Sketch, handwriting, plain white',
    theme: 'mono',
    finish: 'sketch',
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
    id: 'workshop',
    label: 'Workshop',
    description: 'Sand, Sketch, marker pen, soft grid',
    theme: 'sand',
    finish: 'sketch',
    font: 'permanent-marker',
    pattern: 'grid',
    patternOpacity: 0.6,
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
];

/** How many looks one carousel page holds. */
export const LOOKS_PER_PAGE = 6;

export function tabLookById(id: string): TabLook | undefined {
  return TAB_LOOKS.find((l) => l.id === id);
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
  return TAB_LOOKS.find((l) => lookMatches(tab, l))?.id;
}
