// Class strings the Explorer's surfaces repeat, copied from liveplanner's (surface-classes.ts, cardGrid.ts,
// brand-classes.ts) so a tweak reaches every one. Colours are Tailwind's slate and the host app's `brand`
// ramp (`--color-brand-*`), so each app's accent applies without the package knowing it.

/** A bordered card that holds a list of rows (Explorer views, Trash, Inbox). */
export const LIST_CARD =
  'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';

/** One column on a phone, two from `sm:`, three from `lg:`. */
export const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

export const CARD_SHELL =
  'group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/50';

/** A fixed-height letterbox, so every card is the same height whatever its picture. */
export const CARD_PREVIEW =
  'flex h-48 w-full items-center justify-center overflow-hidden border-b border-slate-100 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-900/30';

/** A solid brand control's dark-mode fill, a step lighter so it holds its contrast on a dark page. */
export const SOLID_BRAND_DARK_CONTROL = 'dark:bg-brand-600 dark:hover:bg-brand-500';

export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export const MUTED = 'text-slate-500 dark:text-slate-400';

export const RENAME_INPUT =
  'rounded border border-brand-300 bg-white px-1 py-0 text-sm font-medium text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100';

/** The uppercase column header band over a list. */
export const LIST_HEADER =
  'items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400';

/** The ring a drop target wears while something is dragged over it. */
export const DROP_TARGET_RING = 'ring-2 ring-brand-400 ring-inset';
