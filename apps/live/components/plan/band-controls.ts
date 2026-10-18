// A maximised element's header controls (docs/specs/026-plan/plan-board.md "The header holds the top row"): while the
// header holds the top row, its controls (a view's own, Maximise or Restore, the cog, ⋯) sit together at its right
// end, straight on the header with no card of their own, as the menu box's do at its left (BAND_FLUSH), the header's
// right end as far in as the menu's left (BAND_HEADER_END), so the band reads as the element's own header.
// Pure CSS keyed on CanvasCover's `data-header-band`: on the canvas the group is as it was. `data-band-controls` is what
// the band measures (canvas-layer-insets BAND_CONTROLS_SELECTOR): the palette stops 12 px short of it.

// Its buttons are the palette's tile size (36 px) there, the group the menu box's height (BAND_CARD_PX).
export const BAND_CONTROLS_CLASS =
  '[[data-header-band]_&]:h-[var(--plan-band-card-h,46px)] [[data-header-band]_&]:p-1 [[data-header-band]_&_button:not([data-widget-zone]_button)]:h-9 [[data-header-band]_&_button:not([data-widget-zone]_button)]:min-w-9';

// The header's own right padding in a band: a hairline, so the last control stands as far in from the element's right
// edge as the menu box's first does from its left (the box's 4 px inset and hairline, from a 12 px canvas inset that is
// also the element's).
export const BAND_HEADER_END = '[[data-header-band]_&]:pr-px';

// The menu box's height (TOOLBAR_CARD: 36 px controls, a 4 px inset and a hairline), which the controls and the
// Sheet's toolbar in a header band match (a board's widgets ride in the menu box itself).
export const BAND_CARD_PX = 46;

// What the band measures (canvas-layer-insets BAND_CONTROLS_SELECTOR): the palette stops 12 px short of it.
export function bandControlsProps(): { 'data-band-controls': '' } {
  return { 'data-band-controls': '' };
}
