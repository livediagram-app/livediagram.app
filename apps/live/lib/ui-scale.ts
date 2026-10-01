import type { CSSProperties } from 'react';
import type { UserPreferences } from './user-preferences';

// UI scale (docs/specs/007-editor/ui-scale.md): the factor the panels, the
// toolbar and the corner buttons are drawn at, via CSS `zoom` on each
// surface's root. Nothing else scales. One master value (`uiScale`) sets all
// three parts; a part's own key overrides it for that part alone.

// 80% is the floor; the range is symmetric about 100%, so 100% sits in the
// middle of the slider and going smaller is as easy as going bigger.
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.2;
export const UI_SCALE_STEP = 0.05;
export const UI_SCALE_DEFAULT = 1;

// The separately scalable parts of the chrome, in Settings order.
export const UI_SCALE_PARTS = [
  // Every panel (floating, docked, popover), the Quick Style panel.
  { id: 'panels', key: 'uiScalePanels' },
  // The Toolbar layout's strip and menu button.
  { id: 'toolbar', key: 'uiScaleToolbar' },
  // The bottom-right row: Activity, undo / redo, Layers, theme, zoom.
  { id: 'cornerButtons', key: 'uiScaleCornerButtons' },
] as const satisfies readonly { id: string; key: keyof UserPreferences }[];

export type UiScalePart = (typeof UI_SCALE_PARTS)[number]['id'];
export type UiScales = Record<UiScalePart, number>;

export const UNSCALED: UiScales = { panels: 1, toolbar: 1, cornerButtons: 1 };

// One stored value, resolved: junk reads as the default; anything else is
// clamped into range and snapped to a step, rounded so 1.15 is not
// 1.1500000000000001.
function resolveValue(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return UI_SCALE_DEFAULT;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, raw));
  const snapped = Math.round(clamped / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.round(snapped * 100) / 100;
}

// The master scale, as the UI Scale slider shows it.
export function resolveUiScale(prefs: UserPreferences): number {
  return resolveValue(prefs.uiScale);
}

// A part's scale as its slider shows it: its own value, else the master's.
export function resolveUiScalePart(prefs: UserPreferences, part: UiScalePart): number {
  const key = UI_SCALE_PARTS.find((p) => p.id === part)!.key;
  const own = prefs[key];
  return own === undefined ? resolveUiScale(prefs) : resolveValue(own);
}

// The scales in force. A phone always draws at 100% (its layout is already
// sized to the screen).
export function resolveUiScales(prefs: UserPreferences, view: { mobile: boolean }): UiScales {
  if (view.mobile) return UNSCALED;
  return {
    panels: resolveUiScalePart(prefs, 'panels'),
    toolbar: resolveUiScalePart(prefs, 'toolbar'),
    cornerButtons: resolveUiScalePart(prefs, 'cornerButtons'),
  };
}

// The master slider means "everything at this size": it sets the master and
// clears every part's own value. Returns only the changed keys, so it doubles
// as the live preview's patch.
export function uiScalePatch(value: number): Partial<UserPreferences> {
  const patch: Partial<UserPreferences> = { uiScale: value };
  for (const part of UI_SCALE_PARTS) patch[part.key] = undefined;
  return patch;
}

export function uiScalePartPatch(part: UiScalePart, value: number): Partial<UserPreferences> {
  return { [UI_SCALE_PARTS.find((p) => p.id === part)!.key]: value };
}

// Applies a patch, dropping the keys it clears rather than storing undefined.
export function withUiScalePatch(
  prefs: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  const next: UserPreferences = { ...prefs, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key as keyof UserPreferences];
  }
  return next;
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
