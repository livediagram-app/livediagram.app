// The classes Home's parts share (docs/specs/013-workspace/blueprints/explorer-home-view.md
// "Presentation and UX"), so the columns read as one page.

/** A column's heading: Recent, Timeline. */
export const SECTION_HEADING = 'text-sm font-semibold text-slate-900 dark:text-slate-100';

/** A section inside Recent: Jump back in, What happened. */
export const SUB_HEADING =
  'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

/** Quiet words: places, times, counts. Slate-500 on the page meets 4.5:1; slate-400 in dark. */
export const MUTED = 'text-slate-500 dark:text-slate-400';

/** Every link and button on Home. */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

/** A row that opens something: a What happened entry. */
export const ROW = 'rounded-lg px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/70';

/** The page behind Home, for overlays that blend into it (the strip's fade, the avatar rings). */
export const PAGE_RING = 'ring-2 ring-slate-50 dark:ring-slate-900';

/** A placeholder block. */
export const SKELETON = 'rounded-md bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-800';

// ---- The Timeline column's entry box, shared by the entries and their skeletons ----

/** One entry's box: the thumbnail and the name below it. Shared with the skeletons. */
export const ENTRY_THUMB = 'h-20 w-32 md:h-16 md:w-24 lg:h-20 lg:w-32';
export const ENTRY_NAME_WIDTH = 'w-32 md:w-24 lg:w-32';
/** One entry's height: the thumbnail, 4 px, one 16 px line. The paging slot holds it. */
export const ENTRY_HEIGHT = 'h-[6.25rem] md:h-[5.25rem] lg:h-[6.25rem]';
/** Level with the thumbnail's middle: the marker (20 px) and the time (16 px line). */
export const MARKER_OFFSET = 'mt-[30px] md:mt-[22px] lg:mt-[30px]';
export const TIME_OFFSET = 'mt-[32px] md:mt-[24px] lg:mt-[32px]';
export const ENTRY_GRID = 'grid grid-cols-[1fr_1.5rem_1fr] items-start gap-x-2';
