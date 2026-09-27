// White text on a solid brand fill, in dark mode (docs/specs/004-interface-design/color-scheme.md, Dark
// palette (Steel)): the fill sits on brand-600, white on #3a6599 being 6.0:1. Appended beside a
// component's light classes, which stay exactly as they are. `apps/live/app/dark-palette.test.ts`
// fails any solid brand fill under white text that carries neither.

/** A static fill: a badge, an avatar disc, a filled step circle, a "live" pill. */
export const SOLID_BRAND_DARK = 'dark:bg-brand-600';

/** A clickable fill: a primary button, an active segment. Hovers one step deeper. */
export const SOLID_BRAND_DARK_CONTROL = 'dark:bg-brand-600 dark:hover:bg-brand-700';
