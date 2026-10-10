// The landing page's two "inset" bands, the template gallery and the privacy promises
// (docs/specs/019-marketing/marketing-site.md). They step out of the story's rhythm of white and
// brand-tinted beats: a neutral slate band with white cards in light, and the page's
// deepest tone under slate-900 cards in dark, so they read as a different kind of section
// in either appearance.

export const BAND_SECTION =
  'border-t border-slate-200/70 bg-slate-100 dark:border-slate-800/70 dark:bg-slate-950';

export const BAND_TITLE =
  'mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100';

export const BAND_LEAD = 'mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300';

/** A small uppercase heading inside the band (a carousel's category, "More categories"). */
export const BAND_LABEL =
  'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export const BAND_CARD =
  'rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900';

/** A card or chip that is a control: hover lifts its border to the brand. */
export const BAND_CONTROL_HOVER =
  'transition hover:border-brand-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:border-brand-500/60 dark:hover:bg-slate-800';
