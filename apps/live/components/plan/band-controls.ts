// A maximised element's header controls in a card (docs/specs/026-plan/plan-board.md "The header holds the top row"):
// while the header holds the top row, its controls (a view's own, Maximise or Restore, the cog, ⋯) sit together in a
// rounded card at its right end, matching the menu box at its left, in the element's own colours and flat (no shadow),
// so the band reads as part of the element.
// Pure CSS keyed on CanvasCover's `data-header-band`: on the canvas the group is as it was. `data-band-controls` is what
// the band measures (canvas-layer-insets BAND_CONTROLS_SELECTOR): the palette stops 12 px short of it.
import type { CSSProperties } from 'react';
import type { PlanPalette } from './plan-palette';

// Its buttons are the palette's tile size (36 px) there, so the cards beside them and the cog match the menu box.
// (BAND_CARD_PX.)
export const BAND_CONTROLS_CLASS =
  '[[data-header-band]_&]:h-[var(--plan-band-card-h,46px)] [[data-header-band]_&]:rounded-xl [[data-header-band]_&]:border [[data-header-band]_&]:border-[var(--band-card-line)] [[data-header-band]_&]:bg-[var(--band-card-bg)] [[data-header-band]_&]:p-1 [[data-header-band]_&_button:not([data-widget-zone]_button)]:h-9 [[data-header-band]_&_button:not([data-widget-zone]_button)]:min-w-9';

// The menu box's height (TOOLBAR_CARD: 36 px controls, a 4 px inset and a hairline), which every card in a header
// band matches: the controls card and the Sheet's toolbar (a board's widgets ride in the menu box itself).
export const BAND_CARD_PX = 46;

function bandCardStyle(palette: PlanPalette): CSSProperties {
  return {
    '--band-card-bg': palette.surface,
    '--band-card-line': palette.border,
  } as CSSProperties;
}

export function bandControlsProps(palette: PlanPalette): {
  'data-band-controls': '';
  style: CSSProperties;
} {
  return {
    'data-band-controls': '',
    style: bandCardStyle(palette),
  };
}
