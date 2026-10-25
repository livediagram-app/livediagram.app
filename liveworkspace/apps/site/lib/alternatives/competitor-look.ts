import {
  lucideAppWindow,
  lucideBookOpen,
  lucideCircleCheck,
  lucideDatabase,
  lucideHighlighter,
  lucideLayoutGrid,
  lucideListChecks,
  lucideListTodo,
  lucideListTree,
  lucideNetwork,
  lucidePencil,
  lucidePenTool,
  lucideShapes,
  lucideSquareKanban,
  lucideStickyNote,
  lucideTable,
  lucideWorkflow,
} from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';

// How each competitor is drawn on the comparison pages (liveworkspace/docs/comparison-pages.md): a
// generic glyph of what the tool IS (a sticky note for a workshop whiteboard, a kanban board for a
// task board), never its logo, since vendor trademarks are not used; an accent tone; and three short
// highlight chips for its card. Tailwind classes are written out in full so the build sees them.
// competitor-look.test.ts pins one entry per comparison, each with its own glyph and tone.

type CompetitorLook = {
  icon: ReturnType<typeof lucideGlyph>;
  // The card's header wash and the glyph's colour.
  panel: string;
  glyph: string;
  // Three short chips: what we offer that this comparison turns on.
  highlights: [string, string, string];
};

export const COMPETITOR_LOOK: Record<string, CompetitorLook> = {
  // livediagram's.
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
    highlights: ['Free, no tiers', 'No sign-up', 'Open source'],
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
    highlights: ['Hand-drawn finishes', 'Free presentations', '.excalidraw in and out'],
  },
  drawio: {
    icon: lucideGlyph(lucideWorkflow, 22),
    panel: 'from-orange-100 to-amber-50 dark:from-orange-500/15 dark:to-amber-500/5',
    glyph: 'text-orange-600 dark:text-orange-300',
    highlights: ['Real-time by default', 'Imports .drawio', 'One-click themes'],
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
    highlights: ['No plan limits', 'No sign-up', 'Open source'],
  },

  // liveplanner's. Tones that livediagram's already use are shifted, so every card is its own.
  trello: {
    icon: lucideGlyph(lucideSquareKanban, 22),
    panel: 'from-blue-100 to-cyan-50 dark:from-blue-500/15 dark:to-cyan-500/5',
    glyph: 'text-blue-600 dark:text-blue-300',
    highlights: ['WIP limits', 'Sheets beside the board', 'No sign-up'],
  },
  asana: {
    icon: lucideGlyph(lucideListChecks, 22),
    panel: 'from-red-100 to-rose-50 dark:from-red-500/15 dark:to-rose-500/5',
    glyph: 'text-red-600 dark:text-red-300',
    highlights: ['No seats', 'Live Gantt chart', 'No trackers'],
  },
  monday: {
    icon: lucideGlyph(lucideLayoutGrid, 22),
    panel: 'from-yellow-100 to-orange-50 dark:from-yellow-500/15 dark:to-orange-500/5',
    glyph: 'text-yellow-700 dark:text-yellow-300',
    highlights: ['Free, no tiers', 'Live dashboards', 'Export anytime'],
  },
  notion: {
    icon: lucideGlyph(lucideBookOpen, 22),
    panel: 'from-stone-100 to-slate-50 dark:from-stone-500/15 dark:to-slate-500/5',
    glyph: 'text-stone-700 dark:text-stone-300',
    highlights: ['Real spreadsheets', 'Boards with WIP limits', 'Forms to cards'],
  },
  jira: {
    icon: lucideGlyph(lucideListTodo, 22),
    panel: 'from-indigo-100 to-blue-50 dark:from-indigo-500/15 dark:to-blue-500/5',
    glyph: 'text-indigo-600 dark:text-indigo-300',
    highlights: ['Nothing to configure', 'Bug reports to cards', 'API, MCP and CLI'],
  },
  clickup: {
    icon: lucideGlyph(lucideCircleCheck, 22),
    panel: 'from-pink-100 to-purple-50 dark:from-pink-500/15 dark:to-purple-500/5',
    glyph: 'text-pink-600 dark:text-pink-300',
    highlights: ['Less to learn', 'Live for everyone', 'No sign-up'],
  },
  airtable: {
    icon: lucideGlyph(lucideDatabase, 22),
    panel: 'from-teal-100 to-cyan-50 dark:from-teal-500/15 dark:to-cyan-500/5',
    glyph: 'text-teal-600 dark:text-teal-300',
    highlights: ['Cards as rows', '150+ functions', 'Free, no seats'],
  },
  smartsheet: {
    icon: lucideGlyph(lucideTable, 22),
    panel: 'from-green-100 to-lime-50 dark:from-green-500/15 dark:to-lime-500/5',
    glyph: 'text-green-600 dark:text-green-300',
    highlights: ['Gantt from your cards', 'Live dashboards', 'Free, no seats'],
  },

  // livedocuments'.
  'google-slides': {
    icon: lucideGlyph(lucideAppWindow, 22),
    panel: 'from-lime-100 to-yellow-50 dark:from-lime-500/15 dark:to-yellow-500/5',
    glyph: 'text-lime-700 dark:text-lime-300',
    highlights: ['Slide layouts', 'Present any page', 'No account'],
  },

  // livedesign's.
  figma: {
    icon: lucideGlyph(lucidePenTool, 22),
    panel: 'from-violet-100 to-rose-50 dark:from-violet-500/15 dark:to-rose-500/5',
    glyph: 'text-violet-700 dark:text-violet-300',
    highlights: ['Logo Kit export', 'Photo layers and PSD', 'No account'],
  },
};
