import {
  lucideBookOpen,
  lucideCircleCheck,
  lucideDatabase,
  lucideLayoutGrid,
  lucideListChecks,
  lucideListTodo,
  lucideSquareKanban,
  lucideTable,
} from '@liveplanner/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';

// How each competitor is drawn on the comparison pages (docs/specs/019-marketing/comparison-pages.md): a generic
// glyph of what the tool IS (a kanban board for a board tool, a database for a database), never its logo,
// since vendor trademarks are not used (docs/specs/004-interface-design/iconography.md); an accent tone; and three
// short highlight chips for its card. Tailwind classes are written out in full so the build sees them.
// competitor-look.test.ts pins one entry per ALTERNATIVES slug.

type CompetitorLook = {
  icon: ReturnType<typeof lucideGlyph>;
  // The card's header wash and the glyph's colour.
  panel: string;
  glyph: string;
  // Three short chips: what liveplanner offers that this comparison turns on.
  highlights: [string, string, string];
};

export const COMPETITOR_LOOK: Record<string, CompetitorLook> = {
  trello: {
    icon: lucideGlyph(lucideSquareKanban, 22),
    panel: 'from-blue-100 to-cyan-50 dark:from-blue-500/15 dark:to-cyan-500/5',
    glyph: 'text-blue-600 dark:text-blue-300',
    highlights: ['WIP limits', 'Sheets beside the board', 'No sign-up'],
  },
  asana: {
    icon: lucideGlyph(lucideListChecks, 22),
    panel: 'from-rose-100 to-orange-50 dark:from-rose-500/15 dark:to-orange-500/5',
    glyph: 'text-rose-600 dark:text-rose-300',
    highlights: ['No seats', 'Live Gantt chart', 'No trackers'],
  },
  monday: {
    icon: lucideGlyph(lucideLayoutGrid, 22),
    panel: 'from-amber-100 to-yellow-50 dark:from-amber-500/15 dark:to-yellow-500/5',
    glyph: 'text-amber-600 dark:text-amber-300',
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
    panel: 'from-fuchsia-100 to-pink-50 dark:from-fuchsia-500/15 dark:to-pink-500/5',
    glyph: 'text-fuchsia-600 dark:text-fuchsia-300',
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
    panel: 'from-emerald-100 to-lime-50 dark:from-emerald-500/15 dark:to-lime-500/5',
    glyph: 'text-emerald-600 dark:text-emerald-300',
    highlights: ['Gantt from your cards', 'Live dashboards', 'Free, no seats'],
  },
};
