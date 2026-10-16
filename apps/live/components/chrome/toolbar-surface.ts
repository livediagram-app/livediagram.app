// The look every floating toolbar card shares (docs/specs/007-editor/toolbar-layout.md): the Toolbar
// layout's strip, and the page toolbar of an article page, so a bar of controls reads as one
// product wherever it sits.

/** The card: white, hairline border, a soft shadow, a 4px inset around 36px controls. */
export const TOOLBAR_CARD =
  'flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40';

/** A maximised board's or sheet's hue on the chrome in its header band (docs/specs/026-plan/plan-board.md "The
 *  header holds the top row"): the menu box and the palette take a whisper of it, mixed into the chrome's own light
 *  or dark card so their ink still reads. Keyed on `data-band-tint` and `--band-tint`, set on the canvas by
 *  CanvasCover; elsewhere nothing changes. */
export const BAND_TINT =
  '[--band-chrome:#ffffff] dark:[--band-chrome:var(--color-slate-900)] [[data-band-tint]_&]:bg-[color-mix(in_srgb,var(--band-tint)_10%,var(--band-chrome))] [[data-band-tint]_&]:border-[color-mix(in_srgb,var(--band-tint)_40%,var(--band-chrome))]';

/** A maximised board's, view's or sheet's own surface and border on the chrome in its header band, flat (no shadow), so
 *  the top row reads as part of it (docs/specs/026-plan/plan-board.md "The header holds the top row"). Keyed on
 *  `data-band-blend`, `--band-surface` and `--band-line`, set on the canvas by CanvasCover. */
export const BAND_BLEND =
  '[[data-band-blend]_&]:bg-[var(--band-surface)]! [[data-band-blend]_&]:border-[var(--band-line)]! [[data-band-blend]_&]:shadow-none!';

/** The hairline between groups of controls. */
export const TOOLBAR_DIVIDER = 'mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700';

/** A control at rest, and pressed (on, or its menu open). */
export const TOOLBAR_CONTROL_REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
export const TOOLBAR_CONTROL_PRESSED =
  'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200';
