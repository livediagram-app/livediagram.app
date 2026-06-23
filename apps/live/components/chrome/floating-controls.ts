// Floating circular canvas controls (the quick-connect plus + its
// radial ring, the resize handles) share one size + visual
// family so they read as a set. Lifted out of the old PlusButton so the
// constants have a neutral home that any control can import without
// pulling in a component.

// Control diameter in screen px (counter-scaled against the zoom so it
// stays a constant size at any zoom level).
export const FLOATING_CONTROL_SIZE = 24;
// How far, in screen px, a control sits beyond the element edge.
export const FLOATING_CONTROL_GAP = 12;
export const FLOATING_CONTROL_CLASS =
  'rounded-full border border-brand-200 bg-white text-brand-600 shadow-md dark:border-brand-500/50 dark:bg-slate-900 dark:text-brand-200';
// Shared hover treatment so every floating control lights up the same
// way on pointer-over.
export const FLOATING_CONTROL_HOVER_CLASS =
  'transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 hover:shadow-lg dark:hover:border-brand-400 dark:hover:bg-slate-800 dark:hover:text-brand-100';
