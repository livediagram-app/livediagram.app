// Who can see an item, one hue each and the same in every app (owner 2026-11-19: "unique to each other and
// illustrative at a glance"): Offline grey (never synced, nothing reaches anyone), Private green (yours, safe on the
// server), Shared blue (a link), Team violet (your team), Public pink (everyone, the Community's own). None is an app's
// accent. The Explorer's badge, the Offline pill, the Share button's words and its legend all read this table.
// Words 4.5:1 on their fill in both looks; the ring 3:1 against the row.

export type VisibilityTone = 'private' | 'shared' | 'team' | 'public' | 'browser';

export const VISIBILITY_TONE: Record<
  VisibilityTone,
  { chip: string; ink: string; dot: string; solid: string; wash: string }
> = {
  private: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    ink: 'text-emerald-700 dark:text-emerald-300',
    dot: 'text-emerald-500',
    solid:
      'bg-emerald-600 text-white ring-emerald-200 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-500/40',
    wash: 'from-emerald-50 to-white dark:from-emerald-500/15 dark:to-slate-900',
  },
  shared: {
    chip: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
    ink: 'text-blue-700 dark:text-blue-300',
    dot: 'text-blue-500',
    solid:
      'bg-blue-600 text-white ring-blue-200 dark:bg-blue-400 dark:text-blue-950 dark:ring-blue-500/40',
    wash: 'from-blue-50 to-white dark:from-blue-500/15 dark:to-slate-900',
  },
  team: {
    chip: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
    ink: 'text-violet-700 dark:text-violet-300',
    dot: 'text-violet-500',
    solid:
      'bg-violet-600 text-white ring-violet-200 dark:bg-violet-400 dark:text-violet-950 dark:ring-violet-500/40',
    wash: 'from-violet-50 to-white dark:from-violet-500/15 dark:to-slate-900',
  },
  public: {
    chip: 'bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:ring-pink-500/30',
    ink: 'text-pink-700 dark:text-pink-300',
    dot: 'text-pink-500',
    solid:
      'bg-pink-600 text-white ring-pink-200 dark:bg-pink-400 dark:text-pink-950 dark:ring-pink-500/40',
    wash: 'from-pink-50 to-white dark:from-pink-500/15 dark:to-slate-900',
  },
  browser: {
    chip: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    ink: 'text-slate-600 dark:text-slate-300',
    dot: 'text-slate-400',
    solid:
      'bg-slate-600 text-white ring-slate-200 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-600',
    wash: 'from-slate-100 to-white dark:from-slate-800 dark:to-slate-900',
  },
};
