// The colour arithmetic of re-inking a page's content (docs/specs/007-editor/illustrate-pages.md
// "Re-inking"): the least change to a colour, keeping its hue, that reaches a contrast against
// every tone it may sit on. Pure.
import { contrastRatio, hexToRgb, rgbToHex, shade, tint } from './colors';

// The search for the least change: this many even steps toward white (or black), then this many
// halvings inside the first step that reaches the target. 20 x 0.05, then 8 halvings: the amount
// is found to within 0.0002, finer than one channel step (1/255).
const INK_SEARCH_STEPS = 20;
const INK_REFINE_STEPS = 8;

/** Whether a stored colour is one re-inking can measure and move: a `#rrggbb` hex. Anything else
 *  (transparent, a CSS name, an 8-digit hex with alpha) is left as it is. */
export function isOpaqueHex(color: string | undefined): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

/** The least contrast a colour makes against any of the tones (NaN when none can be read). */
export function worstContrast(color: string, tones: readonly string[]): number {
  let worst = Infinity;
  for (const tone of tones) {
    const r = contrastRatio(color, tone);
    if (Number.isNaN(r)) return NaN;
    worst = Math.min(worst, r);
  }
  return worst === Infinity ? NaN : worst;
}

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

type Toward = { color: string; amount: number; contrast: number };

// The least amount toward white (`lighten`) or black that reaches the target against every tone;
// else the far end and its contrast (amount past 1 marks "never reaches").
function leastToward(color: string, tones: readonly string[], target: number, lighten: boolean) {
  const at = (amount: number) => (lighten ? tint(color, amount) : shade(color, amount));
  let prev = 0;
  for (let i = 1; i <= INK_SEARCH_STEPS; i += 1) {
    const amount = i / INK_SEARCH_STEPS;
    if (worstContrast(at(amount), tones) >= target) {
      // Inside (prev, amount]: halve toward the least amount that still reaches it.
      let lo = prev;
      let hi = amount;
      for (let k = 0; k < INK_REFINE_STEPS; k += 1) {
        const mid = (lo + hi) / 2;
        if (worstContrast(at(mid), tones) >= target) hi = mid;
        else lo = mid;
      }
      const out = at(hi);
      return { color: out, amount: hi, contrast: worstContrast(out, tones) } satisfies Toward;
    }
    prev = amount;
  }
  const end = at(1);
  return { color: end, amount: 2, contrast: worstContrast(end, tones) } satisfies Toward;
}

/**
 * A colour that reads on the tones: unchanged while its worst contrast against them is at least
 * `floor`; else the same hue lightened or darkened, whichever needs the smaller change, by the
 * least amount whose worst contrast reaches `target`. When neither way reaches it (a gradient from
 * black to white under the element), the end (white or black) that reads best.
 */
export function inkToward(
  color: string,
  tones: readonly string[],
  floor: number,
  target: number,
): string {
  if (!isOpaqueHex(color) || tones.length === 0) return color;
  const now = worstContrast(color, tones);
  if (Number.isNaN(now) || now >= floor) return color;
  const goal = Math.max(floor, target);
  const up = leastToward(color, tones, goal, true);
  const down = leastToward(color, tones, goal, false);
  const reached = [up, down].filter((t) => t.amount <= 1);
  if (reached.length > 0) {
    // The smaller change; on a tie, the lighter.
    reached.sort((a, b) => a.amount - b.amount);
    return reached[0]!.color;
  }
  return up.contrast >= down.contrast ? up.color : down.color;
}
