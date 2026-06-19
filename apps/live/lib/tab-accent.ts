// Accent colour for a tab pill in the bar, lifted out of TabBar so the
// legibility rule is unit-testable (mirroring how the canvas geometry /
// cursor helpers live in their own modules). Each tab's theme stroke is
// reused on its pill to tie the bar visually to the tab content.

import { isLightColor, shade, tint, type Tab } from '@livediagram/diagram';
import { getTheme } from './themes';

// Themes without a stroke override (e.g. brand) fall through to this palette
// default so the bar still reads.
const DEFAULT_TAB_ACCENT = 'rgb(2 132 199)';

// The theme's element stroke, or the palette default when the theme sets none.
export function tabAccent(tab: Tab): string {
  return getTheme(tab.theme).elementStroke ?? DEFAULT_TAB_ACCENT;
}

// The raw accent can vanish against the bar's surface (white in light mode,
// slate-900 in dark): a custom theme's white stroke is invisible on the light
// bar, a near-black one on the dark bar. Keep the accent's hue but push it into
// the legible half for the current surface — darken a too-light accent on the
// light bar, lighten a too-dark one on the dark bar. isLightColor/tint/shade
// only parse `#rrggbb`, so the non-hex DEFAULT_TAB_ACCENT falls through
// untouched (it already reads on both).
export function legibleTabAccent(tab: Tab, isDark: boolean): string {
  const raw = tabAccent(tab);
  if (isDark) return isLightColor(raw) ? raw : tint(raw, 0.6);
  return isLightColor(raw) ? shade(raw, 0.6) : raw;
}
