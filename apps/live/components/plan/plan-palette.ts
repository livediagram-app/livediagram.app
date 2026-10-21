// The Plan board's colours (docs/specs/026-plan/plan-board.md "Theme and style") come from
// @liveplanner/document, shared with the SVG export; this module adds the editor's own bits.
import type { CSSProperties } from 'react';
import {
  liftAccent,
  planOwnColoursOf,
  planPresetColours,
  type ShapeElement,
} from '@liveplanner/document';

export { PRIORITY_COLOURS, accentOn, planPalette, type PlanPalette } from '@liveplanner/document';

// A board's or card's own colours, as planPalette reads them (its preset included).
export const planOwnColours = (el: ShapeElement) => planOwnColoursOf(el);

// The hue a maximised board, view or sheet lends the chrome in its header band (toolbar-surface BAND_TINT): its
// preset's hue, else its own border colour; none for an element in the theme's neutral colours.
export const planBandTint = (el: ShapeElement): string | undefined =>
  planPresetColours(el.colorPreset, 'light')?.hue ?? el.strokeColor ?? undefined;

// A type accent in the app's own chrome (panels, popovers, the palette): the colour as chosen, and in
// dark mode the lifted one, so Project's black still shows (docs/specs/026-plan/item-types.md). The
// element carries the variables; the classes below paint from them.
export const accentVars = (color: string) =>
  ({ '--accent': color, '--accent-lift': liftAccent(color) }) as CSSProperties;
export const ACCENT_TEXT = 'text-[var(--accent)] dark:text-[var(--accent-lift)]';
export const ACCENT_BG = 'bg-[var(--accent)] dark:bg-[var(--accent-lift)]';
export const ACCENT_TINT =
  'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] dark:bg-[color-mix(in_srgb,var(--accent-lift)_20%,transparent)]';
