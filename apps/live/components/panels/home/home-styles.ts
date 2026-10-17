// The classes Home's parts share (docs/specs/013-workspace/blueprints/explorer-home-view.md
// "Presentation and UX"), so the sections read as one page.

/** A section's heading row: the display title and its quiet link at the end, no rule (Display headings). */
export const SECTION_HEADER = 'flex items-baseline justify-between gap-4';

/** A section's title: Jump back in, What happened. */
export const SECTION_HEADING =
  'text-2xl font-extrabold tracking-[-0.03em] text-[#17153a] dark:text-slate-100';

/** The quiet link at the end of a heading row: See more, See timeline. Its line box is padded
 *  to the 24 px target. */
export const SECTION_LINK =
  'inline-flex min-h-6 items-center rounded-sm text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300';

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

// ---- Jump back in's cards (desktop and tablet), shared by the cards and their skeletons ----

/** A group's label: Most used, Recent. */
export const GROUP_LABEL =
  'mb-2.5 h-4 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-slate-500 dark:text-slate-400';

/** A card's surface at rest; it lifts to a sky edge on hover. */
export const CARD_SURFACE =
  'border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-micro hover:border-sky-300 hover:shadow-[0_0_0_4px_rgba(125,211,252,0.25),0_18px_36px_-16px_rgba(2,132,199,0.45)] motion-safe:hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-400/60';

/** A most used card: 200 px high, its thumbnail 128 px. */
export const LARGE_CARD = 'h-[12.5rem]';
export const LARGE_THUMB = 'h-32 w-full';
/** A recent card: 62 px high, its thumbnail 64 × 44. */
export const COMPACT_CARD = 'h-[3.875rem]';
export const COMPACT_THUMB = 'h-11 w-16 shrink-0';

/** The two groups' lists: four across from `lg`, two below. */
export const MOST_USED_GRID = 'grid grid-cols-2 gap-4 lg:grid-cols-4';
export const RECENT_GRID = 'grid grid-cols-2 gap-2.5 lg:grid-cols-4';

/** Both groups' height whatever lands in them (D168): at `lg` a label and a row of each (26 + 200, 16, 26 + 62);
 *  below it two rows of each (26 + 416, 16, 26 + 134). Their skeleton and empty state hold it too. */
export const JUMP_BACK_IN_MIN_HEIGHT = 'min-h-[38.625rem] lg:min-h-[20.625rem]';

/** An empty list's one slot, the size of the item it stands in for: a dashed edge on a faint card. */
export const EMPTY_SLOT =
  'border border-dashed border-slate-300 bg-white/60 dark:border-slate-600 dark:bg-slate-800/50';

/** What happened's days sit in one panel. */
export const WHAT_HAPPENED_PANEL =
  'rounded-[20px] border border-slate-200 bg-white px-3 py-2 sm:px-5 dark:border-slate-700 dark:bg-slate-800';
/** A strip tile: 128 px wide, the thumbnail 128 × 80. */
export const STRIP_TILE = 'w-32 shrink-0';
export const STRIP_THUMB = 'h-20 w-32';
/** The strip's height: a tile (100 px) plus the scroller's padding for focus rings. */
export const STRIP_HEIGHT = 'h-28';
