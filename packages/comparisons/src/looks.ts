import {
  AppWindowIcon,
  BookOpenIcon,
  CircleCheckIcon,
  DatabaseIcon,
  HighlighterIcon,
  type Icon,
  LayoutGridIcon,
  ListChecksIcon,
  ListTodoIcon,
  ListTreeIcon,
  NetworkIcon,
  PencilIcon,
  PenToolIcon,
  ShapesIcon,
  SquareKanbanIcon,
  StickyNoteIcon,
  TableIcon,
  WorkflowIcon,
} from './icons';

// How each competitor is drawn (README.md "Page shape"): a generic glyph of what the tool IS (a
// sticky note for a workshop whiteboard, a kanban board for a task board), never its logo, since
// vendor trademarks are not used, and a tone of its own for its card. Every app's competitors are
// here, so no two cards anywhere share a tone; the words on a card are the app's (`highlights` in
// its list). Tailwind classes are written out in full so each app's build sees them.

export type CompetitorLook = {
  icon: Icon;
  // The card's header wash.
  panel: string;
  // The glyph's colour.
  glyph: string;
};

export const COMPETITOR_LOOK: Record<string, CompetitorLook> = {
  // livediagram's.
  'microsoft-whiteboard': {
    icon: HighlighterIcon,
    panel: 'from-sky-100 to-indigo-50 dark:from-sky-500/15 dark:to-indigo-500/5',
    glyph: 'text-sky-600 dark:text-sky-300',
  },
  miro: {
    icon: StickyNoteIcon,
    panel: 'from-amber-100 to-yellow-50 dark:from-amber-500/15 dark:to-yellow-500/5',
    glyph: 'text-amber-600 dark:text-amber-300',
  },
  xmind: {
    icon: ListTreeIcon,
    panel: 'from-rose-100 to-orange-50 dark:from-rose-500/15 dark:to-orange-500/5',
    glyph: 'text-rose-600 dark:text-rose-300',
  },
  excalidraw: {
    icon: PencilIcon,
    panel: 'from-violet-100 to-fuchsia-50 dark:from-violet-500/15 dark:to-fuchsia-500/5',
    glyph: 'text-violet-600 dark:text-violet-300',
  },
  drawio: {
    icon: WorkflowIcon,
    panel: 'from-orange-100 to-amber-50 dark:from-orange-500/15 dark:to-amber-500/5',
    glyph: 'text-orange-600 dark:text-orange-300',
  },
  figjam: {
    icon: ShapesIcon,
    panel: 'from-fuchsia-100 to-pink-50 dark:from-fuchsia-500/15 dark:to-pink-500/5',
    glyph: 'text-fuchsia-600 dark:text-fuchsia-300',
  },
  lucidchart: {
    icon: NetworkIcon,
    panel: 'from-emerald-100 to-teal-50 dark:from-emerald-500/15 dark:to-teal-500/5',
    glyph: 'text-emerald-600 dark:text-emerald-300',
  },

  // liveplanner's. Tones that livediagram's already use are shifted, so every card is its own.
  trello: {
    icon: SquareKanbanIcon,
    panel: 'from-blue-100 to-cyan-50 dark:from-blue-500/15 dark:to-cyan-500/5',
    glyph: 'text-blue-600 dark:text-blue-300',
  },
  asana: {
    icon: ListChecksIcon,
    panel: 'from-red-100 to-rose-50 dark:from-red-500/15 dark:to-rose-500/5',
    glyph: 'text-red-600 dark:text-red-300',
  },
  monday: {
    icon: LayoutGridIcon,
    panel: 'from-yellow-100 to-orange-50 dark:from-yellow-500/15 dark:to-orange-500/5',
    glyph: 'text-yellow-700 dark:text-yellow-300',
  },
  notion: {
    icon: BookOpenIcon,
    panel: 'from-stone-100 to-slate-50 dark:from-stone-500/15 dark:to-slate-500/5',
    glyph: 'text-stone-700 dark:text-stone-300',
  },
  jira: {
    icon: ListTodoIcon,
    panel: 'from-indigo-100 to-blue-50 dark:from-indigo-500/15 dark:to-blue-500/5',
    glyph: 'text-indigo-600 dark:text-indigo-300',
  },
  clickup: {
    icon: CircleCheckIcon,
    panel: 'from-pink-100 to-purple-50 dark:from-pink-500/15 dark:to-purple-500/5',
    glyph: 'text-pink-600 dark:text-pink-300',
  },
  airtable: {
    icon: DatabaseIcon,
    panel: 'from-teal-100 to-cyan-50 dark:from-teal-500/15 dark:to-cyan-500/5',
    glyph: 'text-teal-600 dark:text-teal-300',
  },
  smartsheet: {
    icon: TableIcon,
    panel: 'from-green-100 to-lime-50 dark:from-green-500/15 dark:to-lime-500/5',
    glyph: 'text-green-600 dark:text-green-300',
  },

  // livedocuments'.
  'google-slides': {
    icon: AppWindowIcon,
    panel: 'from-lime-100 to-yellow-50 dark:from-lime-500/15 dark:to-yellow-500/5',
    glyph: 'text-lime-700 dark:text-lime-300',
  },

  // livedesign's.
  figma: {
    icon: PenToolIcon,
    panel: 'from-violet-100 to-rose-50 dark:from-violet-500/15 dark:to-rose-500/5',
    glyph: 'text-violet-700 dark:text-violet-300',
  },
};

// A competitor without an entry yet still draws: a neutral card and no glyph. check.ts fails an app
// whose list names one, so it never ships that way.
export const NEUTRAL_LOOK: Omit<CompetitorLook, 'icon'> & { icon?: Icon } = {
  panel: 'from-slate-100 to-white dark:from-slate-800 dark:to-slate-900',
  glyph: 'text-slate-500',
};

export function lookOf(slug: string): Omit<CompetitorLook, 'icon'> & { icon?: Icon } {
  return COMPETITOR_LOOK[slug] ?? NEUTRAL_LOOK;
}
