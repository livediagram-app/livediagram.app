// The sidebar's look (docs/specs/013-workspace/explorer-structure.md "Look"; blueprint "Presentation and UX"): the
// toned tiles of the top-level Overview and Spaces rows and the raised pill of the current row. Classes only, so
// the rows and their tests read one table.

export type SidebarTone = 'sky' | 'violet' | 'amber' | 'emerald' | 'indigo' | 'rose';

/** A resting tile: the tone's 100 tint under its 700 ink; in dark its 400 at 15 % under its 300 ink. */
export const SIDEBAR_TONES: Record<SidebarTone, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
};

/** The tile of the current row, whatever its tone. */
export const SIDEBAR_TILE_CURRENT = 'bg-violet-600 text-white dark:bg-violet-500';

/** The tile's box. */
// Its icon drawn at 14 px, so the 24 px tile centres it on whole pixels (a 13 px icon would sit on a half pixel and
// fail the optical audit, optical-alignment.md).
export const SIDEBAR_TILE =
  'grid size-6 shrink-0 place-items-center rounded-lg [&>svg]:block [&>svg]:size-3.5';

/** The current row: a raised white pill; in dark a glass pill with a violet hairline inside its edge. */
export const SIDEBAR_CURRENT =
  'border-violet-200 bg-white shadow-[0_6px_18px_-8px_rgba(124,58,237,0.35)] dark:border-transparent dark:bg-transparent dark:bg-gradient-to-r dark:from-violet-400/[0.18] dark:to-violet-400/[0.04] dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-violet-400/35';

/** Every other row: a transparent edge (so selecting moves nothing) and a soft hover wash. */
export const SIDEBAR_RESTING = 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800';
