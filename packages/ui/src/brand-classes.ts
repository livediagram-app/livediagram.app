// White text on a solid brand fill, in dark mode (docs/specs/004-interface-design/color-scheme.md, Dark
// palette (Steel)): the fill sits on brand-600, white on #3a6599 being 6.0:1. Appended beside a
// component's light classes, which stay exactly as they are. `apps/live/app/dark-palette.test.ts`
// fails any solid brand fill under white text that carries neither.

/** A static fill: a badge, an avatar disc, a filled step circle, a "live" pill. */
export const SOLID_BRAND_DARK = 'dark:bg-brand-600';

/** A clickable fill: a primary button, an active segment. Hovers one step deeper. */
export const SOLID_BRAND_DARK_CONTROL = 'dark:bg-brand-600 dark:hover:bg-brand-700';

/**
 * The selected option of a segmented control (a two- or more-way switch, a tab strip drawn as
 * segments): a solid brand fill under white text, so the selection reads at a glance in both
 * appearances. A near-surface fill (white on slate-100, slate-900 on slate-800) is ~1.1:1 against
 * its track, too faint to mark a state.
 */
export const ACTIVE_SEGMENT = `bg-brand-600 text-white shadow-sm ${SOLID_BRAND_DARK_CONTROL}`;

/**
 * The track an `ACTIVE_SEGMENT` sits in: the deepest surface in dark mode, so the brand fill reads
 * at 3:1 against it (brand-600 on slate-950 is ~3.2:1; on slate-800 only ~2.7:1).
 */
export const SEGMENT_TRACK = 'bg-slate-100 dark:bg-slate-950';
