// The reading pane's button looks and key caps (InboxReader, SuggestionPane): one brand primary, one quiet secondary,
// 36 px tall (44 px under 768 px), and the key a verb answers to, hidden on a touch screen.

export const KBD =
  'ml-1 inline-flex min-w-[1.25rem] [@media(pointer:coarse)]:hidden items-center justify-center rounded border border-current/25 px-1 font-sans text-[10px] font-medium leading-4 opacity-70';

const PANE_BUTTON =
  'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-micro motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-11';
export const PRIMARY = `${PANE_BUTTON} bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500`;
export const SECONDARY = `${PANE_BUTTON} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
