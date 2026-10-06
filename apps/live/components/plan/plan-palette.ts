// The Plan board's colours (docs/specs/026-plan/plan-board.md "Theme and style") come from
// @livediagram/document, shared with the SVG export; this module adds the editor's own bits.
import type { CSSProperties } from 'react';
import { liftAccent, type ShapeElement } from '@livediagram/document';

export { PRIORITY_COLOURS, accentOn, planPalette, type PlanPalette } from '@livediagram/document';

// A board's or card's own colours, as planPalette reads them.
export const planOwnColours = (el: ShapeElement) => ({
  fill: el.fillColor,
  stroke: el.strokeColor,
  text: el.textColor,
});

// A type accent in the app's own chrome (panels, popovers, the palette): the colour as chosen, and in
// dark mode the lifted one, so Project's black still shows (docs/specs/026-plan/item-types.md). The
// element carries the variables; the classes below paint from them.
export const accentVars = (color: string) =>
  ({ '--accent': color, '--accent-lift': liftAccent(color) }) as CSSProperties;
export const ACCENT_TEXT = 'text-[var(--accent)] dark:text-[var(--accent-lift)]';
export const ACCENT_BG = 'bg-[var(--accent)] dark:bg-[var(--accent-lift)]';
export const ACCENT_TINT =
  'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] dark:bg-[color-mix(in_srgb,var(--accent-lift)_20%,transparent)]';
