// Accent colour for a tab pill in the bar, lifted out of TabBar so the
// legibility rule is unit-testable (mirroring how the canvas geometry /
// cursor helpers live in their own modules). Each tab's theme stroke is
// reused on its pill to tie the bar visually to the tab content.

import {
  MIN_TEXT_CONTRAST,
  contrastRatio,
  isLightColor,
  shade,
  tint,
  type Tab,
} from '@liveplanner/document';
import { getTheme } from './themes';

// A theme that paints no stroke — Default, and any unthemed tab —
// falls through to this palette accent so the bar still reads. Written as
// #rrggbb on purpose: that is the only notation `legibleColor` parses, and
// while this was `rgb(2 132 199)` the most common accent in the app was the
// one accent the legibility rule silently skipped.
const DEFAULT_TAB_ACCENT = '#0284c7'; // brand-600

// The theme's element stroke, or the palette default when the theme sets none.
function tabAccent(tab: Tab): string {
  return getTheme(tab.theme).elementStroke ?? DEFAULT_TAB_ACCENT;
}

// Push a colour into the legible half for the current bar surface (white in
// light mode, slate-900 in dark): a custom theme's white stroke is invisible on
// the light bar, a near-black one on the dark bar. Keep the hue but darken a
// too-light colour on the light bar, lighten a too-dark one on the dark bar.
// isLightColor/tint/shade only parse `#rrggbb`, so a non-hex colour (like the
// default accent) falls through untouched — it already reads on both. Pure (no
// theme lookup) so the rule is unit-tested in isolation.
// Then, keeping the hue, it is nudged in steps until the pill's label reads at WCAG AA (4.5:1) on the
// pill's own surface (white, or slate-800 in dark): the default accent sat at 4.1:1 on white
// (issue #863).
export function legibleColor(raw: string, isDark: boolean): string {
  const half = isDark
    ? isLightColor(raw)
      ? raw
      : tint(raw, 0.6)
    : isLightColor(raw)
      ? shade(raw, 0.6)
      : raw;
  return toAaContrast(half, isDark);
}

// The active pill's surfaces (TabPill): white, and slate-800 in dark.
const PILL_LIGHT = '#ffffff';
const PILL_DARK = '#1d293d';
// Each nudge mixes 10% toward black or white; ten reach either, so the loop is bounded.
const NUDGE = 0.1;
const MAX_NUDGES = 10;

function toAaContrast(colour: string, isDark: boolean): string {
  const surface = isDark ? PILL_DARK : PILL_LIGHT;
  let c = colour;
  for (let i = 0; i < MAX_NUDGES; i += 1) {
    // NaN (not #rrggbb) fails `<` and leaves the colour as it is.
    if (!(contrastRatio(c, surface) < MIN_TEXT_CONTRAST)) return c;
    c = isDark ? tint(c, NUDGE) : shade(c, NUDGE);
  }
  return c;
}

export function legibleTabAccent(tab: Tab, isDark: boolean): string {
  return legibleColor(tabAccent(tab), isDark);
}
