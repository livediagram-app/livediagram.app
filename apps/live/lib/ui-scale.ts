import type { CSSProperties } from 'react';
import type { UserPreferences } from './user-preferences';

// UI scale (docs/specs/007-editor/ui-scale.md): the factor the panels, the
// Palette toolbar and the bottom-right cluster are drawn at, via CSS `zoom` on
// each surface's root. Nothing else scales.

// Below 80% the chrome's 10px labels drop under 8px and stop being readable.
export const UI_SCALE_MIN = 0.8;
// Above 150% the Palette and a corner stack of panels no longer fit a laptop.
export const UI_SCALE_MAX = 1.5;
export const UI_SCALE_STEP = 0.05;
export const UI_SCALE_DEFAULT = 1;

// The scale in force. A phone always draws at 100% (its layout is already
// sized to the screen); junk reads as the default; anything else is clamped
// into range and snapped to a step, rounded so 1.15 is not 1.1500000000000001.
export function resolveUiScale(prefs: UserPreferences, view: { mobile: boolean }): number {
  const raw = prefs.uiScale;
  if (view.mobile || typeof raw !== 'number' || !Number.isFinite(raw)) return UI_SCALE_DEFAULT;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, raw));
  const snapped = Math.round(clamped / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.round(snapped * 100) / 100;
}

// The style a scaled surface spreads onto its root. Nothing at 100%, so an
// unscaled editor's DOM is unchanged.
export function uiScaleStyle(scale: number): CSSProperties | undefined {
  return scale === 1 ? undefined : { zoom: scale };
}

// Inside a zoomed surface every length, its own left / top / insets included,
// is multiplied by the zoom, while measurements (getBoundingClientRect,
// clientX) are in screen px. Converts a screen-px length to the px to write.
export function toSurfacePx(px: number, scale: number): number {
  return px / scale;
}
