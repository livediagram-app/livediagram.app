// The page tree row's look (docs/specs/030-knowledgebase/blueprints/page-tree.md "The sidebar"), shared by a page's
// row (PageTreeRow) and a connected file's (ConnectedTreeRow), so the two stand in one list as one kind of row.

// The row's left inset before its first level's indent.
export const ROW_INSET = 8;

export const ROW =
  'group relative flex w-full shrink-0 cursor-pointer select-none items-center gap-1 rounded-md pr-1 text-[13px] leading-5 outline-none motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 [-webkit-touch-callout:none]';
// The current page: the brand tint (brand-900 on brand-100 is over 4.5:1, page-tree-contrast.test.ts).
export const ROW_CURRENT =
  'bg-brand-100 font-medium text-brand-900 dark:bg-brand-500/20 dark:text-brand-100';
// A row's buttons while it is not pointed at: there, but faint, so a long tree stays calm.
export const QUIET = 'text-slate-400/70 dark:text-slate-400/60';
export const ROW_REST =
  'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-800';
export const ROW_NEST = 'ring-2 ring-inset ring-brand-500';
export const ROW_BUTTON =
  'flex shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-300/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100';
// Where a dragged page will land among its siblings: a 2px brand line on that edge of the row.
export const INSERT_LINE =
  'pointer-events-none absolute right-1 z-10 h-0.5 rounded-full bg-brand-500';

/** The field a page is renamed in, in its row. */
export const PAGE_RENAME_FIELD =
  'h-6 min-w-0 flex-1 rounded bg-white px-1.5 text-[13px] font-medium text-slate-900 outline-none ring-2 ring-brand-400 dark:bg-slate-800 dark:text-slate-100';
