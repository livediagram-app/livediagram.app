import type { UserPreferences } from './user-preferences';

// The element indicator style (docs/specs/008-canvas/element-indicators.md): Corner unless the
// person chose Footer.
export const ELEMENT_INDICATOR_STYLES = ['corner', 'footer'] as const;
export type ElementIndicatorStyle = (typeof ELEMENT_INDICATOR_STYLES)[number];

export function readElementIndicatorStyle(prefs: UserPreferences): ElementIndicatorStyle {
  return prefs.elementIndicatorStyle === 'footer' ? 'footer' : 'corner';
}

export function withElementIndicatorStyle(
  prefs: UserPreferences,
  style: ElementIndicatorStyle,
): UserPreferences {
  return { ...prefs, elementIndicatorStyle: style };
}
