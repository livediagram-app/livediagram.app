import type { CanvasSurface } from '@livediagram/document';

// The colours of the two "selection box" rectangles the editor draws: the
// drag-select marquee on the canvas and the Map's current-view window
// (docs/specs/008-canvas/canvas-and-palette.md "Marquee select", docs/specs/008-canvas/minimap.md).
// One helper so the two boxes always look alike.
//
// Both take the tab theme's accent (its element stroke). The paper decides how
// loud that accent is: on light paper it is drawn at full strength, but the
// same saturated border + tint on dark paper glares, so there it is softened
// (a translucent border, a fainter wash) to sit with the dark selection ring
// (element-variant.ts, blue-500/80). Keyed on the PAPER, not the viewer's
// Appearance: a Midnight-schemed tab is dark paper in light chrome.

// A theme that sets no stroke (Default, unthemed tabs) falls back per paper:
// the brand sky on light, and on dark the blue-500 of the dark selection ring,
// which reads calmer on near-black than sky's cyan.
export const SELECTION_BOX_FALLBACK: Record<CanvasSurface, string> = {
  light: '#0ea5e9', // sky-500
  dark: '#3b82f6', // blue-500
};

// How much of the accent each part keeps, per paper (percent, color-mix).
// Border: 100 = the accent itself. Fill: the faint wash inside the box.
const BORDER_PCT: Record<CanvasSurface, number> = { light: 100, dark: 80 };
const FILL_PCT: Record<CanvasSurface, number> = { light: 12, dark: 10 };

export type SelectionBoxColors = { stroke: string; fill: string };

// color-mix rather than hex alpha, so any colour format a theme (or a custom
// theme) uses still works.
function withAlpha(color: string, pct: number): string {
  return pct >= 100 ? color : `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function selectionBoxColors(
  themeStroke: string | null | undefined,
  surface: CanvasSurface,
): SelectionBoxColors {
  const accent = themeStroke ?? SELECTION_BOX_FALLBACK[surface];
  return {
    stroke: withAlpha(accent, BORDER_PCT[surface]),
    fill: withAlpha(accent, FILL_PCT[surface]),
  };
}
