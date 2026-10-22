// The bottom-corner clusters' look (Undo/Redo, Layers, Collaborate and the popover buttons): one
// strip card and one resting control, so the clusters read as a single set.

/** The rounded strip a cluster's buttons sit in. */
export const CLUSTER_STRIP =
  'pointer-events-auto flex animate-fade-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40';

/** A cluster button at rest (not pressed, its popover closed). */
export const CLUSTER_CONTROL_REST =
  'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
