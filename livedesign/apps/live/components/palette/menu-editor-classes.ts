// The compact controls the element menus' row editors share (chart slices and series, web rows,
// agenda and decision rows): one source so their fields and Add buttons stay alike.

/** A small bordered cell in an editable row. */
export const MENU_CELL_INPUT =
  'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

/** The full-width "+ Add …" button under a row list. */
export const MENU_ADD_ROW_BUTTON =
  'mt-1.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15';
