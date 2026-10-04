// The look every floating toolbar card shares (docs/specs/007-editor/toolbar-layout.md): the Toolbar
// layout's strip, and the page toolbar of an article page, so a bar of controls reads as one
// product wherever it sits.

/** The card: white, hairline border, a soft shadow, a 4px inset around 36px controls. */
export const TOOLBAR_CARD =
  'flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40';

/** The hairline between groups of controls. */
export const TOOLBAR_DIVIDER = 'mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700';

/** A control at rest, and pressed (on, or its menu open). */
export const TOOLBAR_CONTROL_REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
export const TOOLBAR_CONTROL_PRESSED =
  'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200';
