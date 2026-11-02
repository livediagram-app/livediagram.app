import type { UserPreferences } from './user-preferences';

// The element indicator style (docs/specs/008-canvas/element-indicators.md): Top unless the
// person chose Footer, or Off (no indicators drawn at all).
export const ELEMENT_INDICATOR_STYLES = ['top', 'footer', 'off'] as const;
export type ElementIndicatorStyle = (typeof ELEMENT_INDICATOR_STYLES)[number];

export function readElementIndicatorStyle(prefs: UserPreferences): ElementIndicatorStyle {
  const stored = prefs.elementIndicatorStyle;
  return stored === 'footer' || stored === 'off' ? stored : 'top';
}

export function withElementIndicatorStyle(
  prefs: UserPreferences,
  style: ElementIndicatorStyle,
): UserPreferences {
  return { ...prefs, elementIndicatorStyle: style };
}
