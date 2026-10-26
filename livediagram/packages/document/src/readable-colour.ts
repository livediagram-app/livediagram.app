// Readable colour pairs (docs/specs/011-theme/light-and-dark.md): walking a colour's lightness until it reads on
// another. Shared by the theme halves (tuning a theme's text and lines) and the style presets (a label on its fill).
import { contrastRatio, isLightColor, normaliseHex, shade } from './colors';
import { hexOklch, oklchHex } from './pen-colours';

/** The WCAG 2.2 AA floors: text on its fill, and outlines / arrows (non-text) on the canvas. */
export const THEME_TEXT_CONTRAST = 4.5;
export const THEME_LINE_CONTRAST = 3;

/** How far a step moves a colour's OKLCH lightness, and how many steps it may take (0.02 x 50 spans the range). */
const REACH_STEP = 0.02;
const REACH_STEPS = 50;

/** `fg` with its lightness walked away from `bg` until it reaches `min` contrast (or the end of the range). */
export function reachContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const o = hexOklch(fg);
  const b = hexOklch(bg);
  if (!o || !b) return fg;
  const walk = (step: number): string => {
    let l = o.l;
    let out = fg;
    for (let i = 0; i < REACH_STEPS; i++) {
      l = Math.min(1, Math.max(0, l + step));
      out = oklchHex(l, o.c, o.h);
      if (contrastRatio(out, bg) >= min || l === 0 || l === 1) break;
    }
    return out;
  };
  const step = b.l >= 0.6 ? -REACH_STEP : REACH_STEP;
  const out = walk(step);
  if (contrastRatio(out, bg) >= min) return out;
  // A mid-tone backdrop just under the turn (#777777) sent white lighter, where it cannot go, and it stayed at 4.48:1:
  // walked the other way, it reaches the floor on the far side of the backdrop (black reads 4.69:1 there).
  const other = walk(-step);
  return contrastRatio(other, bg) > contrastRatio(out, bg) ? other : out;
}

/** A label for a filled tile: white on a dark fill, a deep shade of the fill on a light one. When that misses the text
 *  floor (white on a mid sky blue is 2.8:1), whichever of the two reads better is walked on until it reaches it. */
export function labelOn(written: string): string {
  // A shorthand or named fill (`#fff`, `red`) as `#rrggbb`, which the OKLCH walk below reads; an unreadable one as is.
  const fill = normaliseHex(written) ?? written;
  const deep = shade(fill, 0.6);
  const first = isLightColor(fill) ? deep : '#ffffff';
  if (contrastRatio(first, fill) >= THEME_TEXT_CONTRAST) return first;
  const best = contrastRatio('#ffffff', fill) >= contrastRatio(deep, fill) ? '#ffffff' : deep;
  return reachContrast(best, fill, THEME_TEXT_CONTRAST);
}
