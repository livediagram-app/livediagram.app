import {
  lucideAppWindow,
  lucideListTree,
  lucideNetwork,
  lucidePencil,
  lucideHighlighter,
  lucideShapes,
  lucideStickyNote,
  lucideWorkflow,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// How each competitor is drawn on the comparison pages (docs/specs/019-marketing/comparison-pages.md): a generic
// glyph of what the tool IS (a sticky note for a workshop whiteboard, a tree for a mind-mapper), never its logo,
// since vendor trademarks are not used (docs/specs/004-interface-design/iconography.md); an accent tone; and three
// short highlight chips for its card. Tailwind classes are written out in full so the build sees them.
// competitor-look.test.ts pins one entry per ALTERNATIVES slug.

export type CompetitorLook = {
  icon: ReturnType<typeof lucideGlyph>;
  // The card's header wash and the glyph's colour.
  panel: string;
  glyph: string;
  // Three short chips: what livediagram offers that this comparison turns on.
  highlights: [string, string, string];
};

export const COMPETITOR_LOOK: Record<string, CompetitorLook> = {
  'microsoft-whiteboard': {
    icon: lucideGlyph(lucideHighlighter, 22),
    panel: 'from-sky-100 to-indigo-50 dark:from-sky-500/15 dark:to-indigo-500/5',
    glyph: 'text-sky-600 dark:text-sky-300',
    highlights: ['Imports your boards', 'No Microsoft account', 'Pressure-sensitive ink'],
  },
  miro: {
    icon: lucideGlyph(lucideStickyNote, 22),
    panel: 'from-amber-100 to-yellow-50 dark:from-amber-500/15 dark:to-yellow-500/5',
    glyph: 'text-amber-600 dark:text-amber-300',
    highlights: ['Free, no tiers', 'No sign-up', 'Self-hostable'],
  },
  xmind: {
    icon: lucideGlyph(lucideListTree, 22),
    panel: 'from-rose-100 to-orange-50 dark:from-rose-500/15 dark:to-orange-500/5',
    glyph: 'text-rose-600 dark:text-rose-300',
    highlights: ['Mind maps and more', 'Nothing to install', 'Open source'],
  },
  excalidraw: {
    icon: lucideGlyph(lucidePencil, 22),
    panel: 'from-violet-100 to-fuchsia-50 dark:from-violet-500/15 dark:to-fuchsia-500/5',
    glyph: 'text-violet-600 dark:text-violet-300',
    highlights: ['91 templates', 'Tabs and folders', '.excalidraw in and out'],
  },
  drawio: {
    icon: lucideGlyph(lucideWorkflow, 22),
    panel: 'from-orange-100 to-amber-50 dark:from-orange-500/15 dark:to-amber-500/5',
    glyph: 'text-orange-600 dark:text-orange-300',
    highlights: ['Real-time by default', 'Imports .drawio', 'One-click themes'],
  },
  'google-slides': {
    icon: lucideGlyph(lucideAppWindow, 22),
    panel: 'from-yellow-100 to-lime-50 dark:from-yellow-500/15 dark:to-lime-500/5',
    glyph: 'text-yellow-700 dark:text-yellow-300',
    highlights: ['Connectors that route', 'Infinite canvas', 'Present from it'],
  },
  figjam: {
    icon: lucideGlyph(lucideShapes, 22),
    panel: 'from-fuchsia-100 to-pink-50 dark:from-fuchsia-500/15 dark:to-pink-500/5',
    glyph: 'text-fuchsia-600 dark:text-fuchsia-300',
    highlights: ['No seats', 'No sign-up', 'API and MCP'],
  },
  lucidchart: {
    icon: lucideGlyph(lucideNetwork, 22),
    panel: 'from-emerald-100 to-teal-50 dark:from-emerald-500/15 dark:to-teal-500/5',
    glyph: 'text-emerald-600 dark:text-emerald-300',
    highlights: ['No shape limits', 'No sign-up', 'Open source'],
  },
};
