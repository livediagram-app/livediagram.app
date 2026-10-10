// The classes Home's parts share (docs/specs/013-workspace/blueprints/explorer-home-view.md
// "Presentation and UX"), so the sections read as one page.

/** A section's heading row: the title, its quiet link at the end, and the hairline rule under it
 *  in the page's line colour (Headings with a rule). */
export const SECTION_HEADER =
  'flex items-baseline justify-between gap-4 border-b border-slate-200 pb-2 dark:border-slate-700';

/** A section's title: Jump back in, What happened. */
export const SECTION_HEADING = 'text-base font-semibold text-slate-900 dark:text-slate-100';

/** The quiet link at the end of a heading row: See more, See timeline. Its line box is padded
 *  to the 24 px target. */
export const SECTION_LINK =
  'inline-flex min-h-6 items-center rounded-sm text-sm font-medium text-brand-700 hover:underline dark:text-brand-300';

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

// ---- Jump back in's tiles, shared by the tiles and their skeletons ----

/** A grid tile's thumbnail: the section's share of the width, a fixed 80 px high. */
export const GRID_THUMB = 'h-20 w-full';
/** A strip tile: 128 px wide, the thumbnail 128 × 80. */
export const STRIP_TILE = 'w-32 shrink-0';
export const STRIP_THUMB = 'h-20 w-32';
/** Two grid tile rows: 2 × 100 px + the 12 px gap. The grid, its skeleton and its empty line all
 *  hold it, so fewer documents never shift what follows. */
export const GRID_MIN_HEIGHT = 'min-h-[13.25rem]';
/** The grid: 4 columns, filled from the top. */
export const GRID = `grid ${GRID_MIN_HEIGHT} grid-cols-4 content-start gap-3`;
/** The strip's height: a tile (100 px) plus the scroller's padding for focus rings. */
export const STRIP_HEIGHT = 'h-28';
