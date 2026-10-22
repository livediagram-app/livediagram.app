// A theme's accent (docs/specs/030-forms/forms.md): the colour a form's cover and a document's accent are drawn from.
// Pure.
import type { ThemeDefinition } from './index';

// The accent a theme without its own stroke paints in (the brand blue).
export const FALLBACK_THEME_ACCENT = '#0ea5e9';

const isHex = (c: string | null | undefined): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The tab theme's accent: its element stroke, else its first palette colour, else the brand blue. */
export function themeAccent(
  theme: Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>,
): string {
  return isHex(theme.elementStroke)
    ? theme.elementStroke
    : isHex(theme.palette?.[0]?.stroke)
      ? theme.palette[0].stroke
      : FALLBACK_THEME_ACCENT;
}
