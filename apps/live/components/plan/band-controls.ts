// A maximised element's header controls in a card (docs/specs/026-plan/plan-board.md "The header holds the top row"):
// while the header holds the top row, its controls (a view's own, Maximise or Restore, the cog, ⋯) sit together in a
// rounded card at its right end, matching the menu box at its left, in the element's own colours so they always read.
// Pure CSS keyed on CanvasCover's `data-header-band`: on the canvas the group is as it was. `data-band-controls` is what
// the band measures (canvas-layer-insets BAND_CONTROLS_SELECTOR): the palette stops 12 px short of it.
import type { CSSProperties } from 'react';
import type { PlanPalette } from './plan-palette';

export const BAND_CONTROLS_CLASS =
  '[[data-header-band]_&]:rounded-xl [[data-header-band]_&]:border [[data-header-band]_&]:border-[var(--band-card-line)] [[data-header-band]_&]:bg-[var(--band-card-bg)] [[data-header-band]_&]:p-1 [[data-header-band]_&]:shadow-md [[data-header-band]_&]:shadow-slate-900/5';

export function bandControlsProps(palette: PlanPalette): {
  'data-band-controls': '';
  style: CSSProperties;
} {
  return {
    'data-band-controls': '',
    style: {
      '--band-card-bg': palette.surface,
      '--band-card-line': palette.border,
    } as CSSProperties,
  };
}
