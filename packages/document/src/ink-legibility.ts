// Colours that read on what they sit on: a colour lightened or darkened, keeping its hue, until it
// clears a WCAG contrast, and two colours mixed as a CSS gradient mixes them. Pure.
import { contrastRatio, hexToRgb, isLightColor, rgbToHex, shade, tint } from './colors';

// The least contrast `legibleOn` keeps a colour at by default: WCAG 2.2 SC 1.4.3 large text.
const LEGIBLE_FLOOR = 3;
// What it re-inks a colour to when it falls below the floor: WCAG 2.2 SC 1.4.3 AA.
const LEGIBLE_TARGET = 4.5;

/** Two `#rrggbb` colours mixed channel by channel, `t` of the way from `a` to `b` (as a CSS
 *  gradient interpolates them). */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  return rgbToHex({
    r: x.r + (y.r - x.r) * t,
    g: x.g + (y.g - x.g) * t,
    b: x.b + (y.b - x.b) * t,
  });
}

/** A colour that reads on `tone`: the same hue lightened on a dark tone or darkened on a light one,
 *  stepwise until it reaches AA contrast (or `floor`, where that is higher); unchanged while it
 *  already clears `floor` (3:1 by default: a colour of its own that still reads is kept). */
export function legibleOn(color: string, tone: string, floor: number = LEGIBLE_FLOOR): string {
  const ratio = contrastRatio(color, tone);
  if (Number.isNaN(ratio) || ratio >= floor) return color;
  const target = Math.max(LEGIBLE_TARGET, floor);
  const lighten = !isLightColor(tone);
  for (let amount = 0.2; amount <= 1.0001; amount += 0.1) {
    const next = lighten ? tint(color, amount) : shade(color, amount);
    if (contrastRatio(next, tone) >= target) return next;
  }
  return lighten ? '#ffffff' : '#0f172a';
}
