import { describe, expect, it } from 'vitest';
import { contrastRatio, rgbToHex } from '@liveworkspace/brand/colour';
import { SHARE_SWEEP } from './ShareVisibilityButton';

// The Share button's words read at WCAG AA (4.5:1) in every part (docs/specs/007-editor/editor-app.md "Header
// actions"): each state's hue alone, and every point of a combination's sweep, on the corner card (white, dark
// slate-900) and its hover wash (slate-100, dark slate-800). Tailwind v4 draws its gradients `in oklab`, so the sweep is
// sampled the same way, from the palette's own oklch values (tailwindcss/theme.css).
const OKLCH: Record<string, [number, number, number]> = {
  'blue-700': [0.488, 0.243, 264.376],
  'blue-300': [0.809, 0.105, 251.813],
  'violet-700': [0.491, 0.27, 292.581],
  'violet-300': [0.811, 0.111, 293.571],
  'pink-700': [0.525, 0.223, 3.958],
  'pink-300': [0.823, 0.12, 346.018],
  'slate-100': [0.968, 0.007, 247.896],
  'slate-800': [0.279, 0.041, 260.031],
  'slate-900': [0.208, 0.042, 265.755],
};

type Lab = [number, number, number];

function lab(name: string): Lab {
  const [l, c, h] = OKLCH[name]!;
  const r = (h * Math.PI) / 180;
  return [l, c * Math.cos(r), c * Math.sin(r)];
}

// OKLab to sRGB hex (CSS Color 4), clipped to the gamut as browsers paint it.
function hex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, bl] = lin.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
  });
  return rgbToHex({ r: r!, g: g!, b: bl! });
}

// Every colour on a sweep through these stops, sampled finely.
function sweep(stops: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = lab(stops[i]!);
    const to = lab(stops[i + 1]!);
    for (let t = 0; t <= 1; t += 0.05)
      out.push(hex(from.map((v, k) => v + (to[k]! - v) * t) as Lab));
  }
  return out;
}

// A sweep's stops, as its class string names them (light, or dark), in order: from, via, to.
function stopsOf(classes: string, dark: boolean): string[] {
  const pick = (slot: string) =>
    new RegExp(`(?:^|\\s)${dark ? 'dark:' : ''}\\[&>span\\]:${slot}-([a-z]+-\\d+)`).exec(
      classes,
    )?.[1];
  return ['from', 'via', 'to'].map(pick).filter((s): s is string => !!s);
}

const LIGHT_GROUNDS = ['#ffffff', hex(lab('slate-100'))];
const DARK_GROUNDS = [hex(lab('slate-900')), hex(lab('slate-800'))];

describe('the Share button’s ink', () => {
  it('names a sweep for every combination, in ladder order, light and dark', () => {
    expect(Object.keys(SHARE_SWEEP)).toEqual([
      'shared team',
      'shared community',
      'team community',
      'shared team community',
    ]);
    expect(stopsOf(SHARE_SWEEP['shared team community']!, false)).toEqual([
      'blue-700',
      'violet-700',
      'pink-700',
    ]);
    expect(stopsOf(SHARE_SWEEP['shared team community']!, true)).toEqual([
      'blue-300',
      'violet-300',
      'pink-300',
    ]);
    for (const classes of Object.values(SHARE_SWEEP)) {
      expect(stopsOf(classes, false).length).toBeGreaterThanOrEqual(2);
      expect(stopsOf(classes, true).length).toBe(stopsOf(classes, false).length);
    }
  });

  it.each(Object.entries(SHARE_SWEEP))(
    'reads 4.5:1 at every point of the %s sweep, resting and hovered, in both looks',
    (_combo, classes) => {
      let least = Infinity;
      for (const [dark, grounds] of [
        [false, LIGHT_GROUNDS],
        [true, DARK_GROUNDS],
      ] as const)
        for (const ink of sweep(stopsOf(classes, dark)))
          for (const ground of grounds) least = Math.min(least, contrastRatio(ink, ground));
      expect(least).toBeGreaterThanOrEqual(4.5);
    },
  );
});
