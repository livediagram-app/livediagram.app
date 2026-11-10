// The element indicator style (docs/specs/008-canvas/element-indicators.md): Top unless the
// person chose Footer, or Off (no indicators drawn at all).
export const ELEMENT_INDICATOR_STYLES = ['top', 'footer', 'off'] as const;
export type ElementIndicatorStyle = (typeof ELEMENT_INDICATOR_STYLES)[number];

// The preference as each editor stores it among the person's preferences (lib/user-preferences.ts).
type IndicatorPreference = { elementIndicatorStyle?: string };

export function readElementIndicatorStyle(prefs: IndicatorPreference): ElementIndicatorStyle {
  const stored = prefs.elementIndicatorStyle;
  return stored === 'footer' || stored === 'off' ? stored : 'top';
}

export function withElementIndicatorStyle<P extends IndicatorPreference>(
  prefs: P,
  style: ElementIndicatorStyle,
): P {
  return { ...prefs, elementIndicatorStyle: style };
}
