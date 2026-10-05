// The look the search box's three menus share (Category, Tags, Sort; docs/specs/025-community/community.md "Gallery"):
// one panel and one row style, so they read as a family.

export const SEARCH_MENU_PANEL =
  'flex animate-fade-in flex-col gap-px rounded-lg border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/60';

// A menu row; the checked one is tinted and set in medium weight.
export function searchMenuRow(checked: boolean): string {
  return `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
    checked
      ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;
}
